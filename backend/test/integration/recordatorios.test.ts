import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { resetDb, prisma, crearCurso, crearFormador, crearReservaDirecta, SEMANA_COMPLETA } from "./helpers";
import { SmtpCaptura } from "./smtp-test";
import { procesarRecordatorios } from "../../src/services/recordatorio.service";
import { procesarOutbox } from "../../src/services/notificacion.service";
import { reiniciarTransporte } from "../../src/services/correo.service";
import { DateTime } from "luxon";
import { ZONA } from "../../src/config/env";

const smtp = new SmtpCaptura(3525);

beforeAll(async () => { await smtp.iniciar(); await resetDb(); });
afterAll(async () => { await smtp.detener(); });
beforeEach(async () => { smtp.limpiar(); await resetDb(); reiniciarTransporte(); });

/** Simula que el job corre a las 12:30 de hoy (hora Bogotá). */
const ahora1230 = () => DateTime.now().setZone(ZONA).set({ hour: 12, minute: 30, second: 0 });
/** Mañana a `hora`:00 (día calendario Bogotá). */
const manana = (hora: number) =>
  DateTime.now().setZone(ZONA).startOf("day").plus({ days: 1 }).set({ hour: hora, minute: 0 });

async function escenario() {
  const curso = await crearCurso();
  const f1 = await crearFormador({ usuario: "f1", correo: "formador1@t.co", franjas: SEMANA_COMPLETA, cursoIds: [curso.id] });
  const f2 = await crearFormador({ usuario: "f2", correo: "formador2@t.co", franjas: SEMANA_COMPLETA, cursoIds: [curso.id] });
  return { curso, f1, f2 };
}

function payloadItems(n: { payload: unknown }): { codigoReserva?: string }[] {
  return (n.payload as { datos?: { items?: { codigoReserva?: string }[] } }).datos?.items ?? [];
}

describe("Recordatorios del día anterior (12:00, agrupados)", () => {
  it("no encola nada antes de la hora configurada", async () => {
    const { curso, f1 } = await escenario();
    const inicio = manana(10);
    await crearReservaDirecta({ cursoId: curso.id, formadorId: f1.formadorId, inicio, fin: inicio.plus({ hours: 2 }) });

    const n = await procesarRecordatorios(ahora1230().set({ hour: 11 }));
    expect(n).toBe(0);
    expect(await prisma.notificacion.count()).toBe(0);
  });

  it("docente con una reserva mañana recibe un recordatorio", async () => {
    const { curso, f1 } = await escenario();
    const inicio = manana(10);
    await crearReservaDirecta({
      cursoId: curso.id, formadorId: f1.formadorId, inicio, fin: inicio.plus({ hours: 2 }),
      docenteCorreo: "docente1@t.co",
    });

    expect(await procesarRecordatorios(ahora1230())).toBe(2); // docente + formador
    await procesarOutbox();

    expect(smtp.mensajesPara("docente1@t.co")).toHaveLength(1);
    expect(smtp.mensajesPara("formador1@t.co")).toHaveLength(1);
    const correoDocente = await prisma.notificacion.findFirst({ where: { tipo: "RECORDATORIO_DOCENTE" } });
    expect(correoDocente?.destinatario).toBe("docente1@t.co");
    expect(correoDocente?.asunto).toContain("mañana");
  });

  it("docente con varias reservas mañana recibe un solo correo agrupado", async () => {
    const { curso, f1, f2 } = await escenario();
    const r1 = await crearReservaDirecta({
      cursoId: curso.id, formadorId: f1.formadorId, inicio: manana(9), fin: manana(11),
      docenteCorreo: "docente1@t.co",
    });
    const r2 = await crearReservaDirecta({
      cursoId: curso.id, formadorId: f2.formadorId, inicio: manana(14), fin: manana(16),
      docenteCorreo: "docente1@t.co",
    });

    await procesarRecordatorios(ahora1230());
    await procesarOutbox();

    const mensajes = smtp.mensajesPara("docente1@t.co");
    expect(mensajes).toHaveLength(1);
    const notif = await prisma.notificacion.findFirstOrThrow({ where: { tipo: "RECORDATORIO_DOCENTE" } });
    const codigos = payloadItems(notif).map(i => i.codigoReserva);
    expect(codigos).toEqual(expect.arrayContaining([r1.codigo, r2.codigo]));
  });

  it("docentes distintos reciben correos separados", async () => {
    const { curso, f1, f2 } = await escenario();
    await crearReservaDirecta({
      cursoId: curso.id, formadorId: f1.formadorId, inicio: manana(9), fin: manana(11),
      docenteCorreo: "docente1@t.co",
    });
    await crearReservaDirecta({
      cursoId: curso.id, formadorId: f2.formadorId, inicio: manana(14), fin: manana(16),
      docenteCorreo: "docente2@t.co",
    });

    await procesarRecordatorios(ahora1230());
    await procesarOutbox();

    expect(smtp.mensajesPara("docente1@t.co")).toHaveLength(1);
    expect(smtp.mensajesPara("docente2@t.co")).toHaveLength(1);
    expect(await prisma.notificacion.count({ where: { tipo: "RECORDATORIO_DOCENTE" } })).toBe(2);
  });

  it("formador con varias reservas recibe un solo correo con aula, correo y teléfono del docente", async () => {
    const { curso, f1 } = await escenario();
    await crearReservaDirecta({
      cursoId: curso.id, formadorId: f1.formadorId, inicio: manana(9), fin: manana(11),
      docenteCorreo: "docente1@t.co", docenteNombre: "Ana Docente", docenteTelefono: "3001112233", aula: "Aula 101",
    });
    await crearReservaDirecta({
      cursoId: curso.id, formadorId: f1.formadorId, inicio: manana(14), fin: manana(16),
      docenteCorreo: "docente2@t.co", docenteNombre: "Luis Docente", docenteTelefono: "3004445566", aula: "Aula 202",
    });

    await procesarRecordatorios(ahora1230());
    await procesarOutbox();

    const mensajes = smtp.mensajesPara("formador1@t.co");
    expect(mensajes).toHaveLength(1);
    const notif = await prisma.notificacion.findFirstOrThrow({ where: { tipo: "RECORDATORIO_FORMADOR" } });
    const html = (notif.payload as { html: string }).html;
    expect(html).toContain("Aula 101");
    expect(html).toContain("Aula 202");
    expect(html).toContain("docente1@t.co");
    expect(html).toContain("docente2@t.co");
    expect(html).toContain("3001112233");
    expect(html).toContain("Curso de prueba");
    expect(smtp.mensajesPara("formador2@t.co")).toHaveLength(0);
  });

  it("correr el job varias veces no duplica correos", async () => {
    const { curso, f1 } = await escenario();
    await crearReservaDirecta({
      cursoId: curso.id, formadorId: f1.formadorId, inicio: manana(10), fin: manana(12),
      docenteCorreo: "docente1@t.co",
    });

    await procesarRecordatorios(ahora1230());
    await procesarRecordatorios(ahora1230().plus({ minutes: 5 }));
    await procesarRecordatorios(ahora1230().plus({ hours: 3 }));
    await procesarOutbox();

    expect(smtp.mensajesPara("docente1@t.co")).toHaveLength(1);
    expect(smtp.mensajesPara("formador1@t.co")).toHaveLength(1);
    expect(await prisma.notificacion.count()).toBe(2);
  });

  it("una reserva incorporada tarde a mañana recibe su propio correo sin repetir las ya recordadas", async () => {
    const { curso, f1 } = await escenario();
    const r1 = await crearReservaDirecta({
      cursoId: curso.id, formadorId: f1.formadorId, inicio: manana(9), fin: manana(11),
      docenteCorreo: "docente1@t.co",
    });
    await procesarRecordatorios(ahora1230());

    // Simula una reserva reagendada a mañana después de las 12:00
    const r2 = await crearReservaDirecta({
      cursoId: curso.id, formadorId: f1.formadorId, inicio: manana(15), fin: manana(17),
      docenteCorreo: "docente1@t.co",
    });
    await procesarRecordatorios(ahora1230().plus({ hours: 4 }));
    await procesarOutbox();

    const mensajes = smtp.mensajesPara("docente1@t.co");
    expect(mensajes).toHaveLength(2);
    const notifs = await prisma.notificacion.findMany({ where: { tipo: "RECORDATORIO_DOCENTE" }, orderBy: { createdAt: "asc" } });
    expect(notifs).toHaveLength(2);
    expect(payloadItems(notifs[0]).map(i => i.codigoReserva)).toEqual([r1.codigo]);
    expect(payloadItems(notifs[1]).map(i => i.codigoReserva)).toEqual([r2.codigo]);
  });

  it("excluye canceladas y reservas de otros días", async () => {
    const { curso, f1 } = await escenario();
    await crearReservaDirecta({
      cursoId: curso.id, formadorId: f1.formadorId, inicio: manana(9), fin: manana(11),
      docenteCorreo: "cancelada@t.co", estado: "CANCELADA",
    });
    const pasadoManana = manana(10).plus({ days: 1 });
    await crearReservaDirecta({
      cursoId: curso.id, formadorId: f1.formadorId, inicio: pasadoManana, fin: pasadoManana.plus({ hours: 2 }),
      docenteCorreo: "futuro@t.co",
    });

    expect(await procesarRecordatorios(ahora1230())).toBe(0);
    expect(await prisma.notificacion.count()).toBe(0);
  });
});
