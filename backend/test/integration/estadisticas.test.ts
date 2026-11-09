import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { resetDb, prisma, crearCurso, crearFormador, crearReservaDirecta, SEMANA_COMPLETA, proximoDia } from "./helpers";
import { estadisticasAdmin, estadisticasFormador } from "../../src/services/estadisticas.service";
import { DateTime } from "luxon";
import { ZONA } from "../../src/config/env";

beforeAll(resetDb);
beforeEach(resetDb);

async function seed() {
  const curso1 = await crearCurso("Curso A");
  const curso2 = await crearCurso("Curso B");
  const f1 = await crearFormador({ usuario: "f1", correo: "f1@t.co", franjas: SEMANA_COMPLETA, cursoIds: [curso1.id, curso2.id] });
  const f2 = await crearFormador({ usuario: "f2", correo: "f2@t.co", franjas: SEMANA_COMPLETA, cursoIds: [curso1.id] });
  const programa = await prisma.programaAcademico.create({ data: { nombre: "Lic" } });
  return { curso1, curso2, f1, f2, programa };
}

async function registrar(documento: string, reservaId: string, programaId: string, ev: {
  g: number;
}) {
  const a = await prisma.asistencia.create({
    data: {
      reservaId, nombreCompleto: "Est", documento, correo: `${documento}@t.co`,
      programaAcademicoId: programaId, aceptaTratamiento: true,
    },
  });
  await prisma.evaluacionFormacion.create({
    data: {
      reservaId, asistenciaId: a.id,
      calificacionGeneral: ev.g,
    },
  });
}

describe("Estadísticas", () => {
  it("calcula promedios desde registros persistidos", async () => {
    const { curso1, f1, programa } = await seed();
    const r1 = await crearReservaDirecta({
      cursoId: curso1.id, formadorId: f1.formadorId,
      inicio: proximoDia(1).inicio.minus({ days: 7 }), fin: proximoDia(1).fin.minus({ days: 7 }),
      estado: "FINALIZADA",
    });
    await registrar("1", r1.id, programa.id, { g: 5 });
    await registrar("2", r1.id, programa.id, { g: 3 });
    await registrar("3", r1.id, programa.id, { g: 4 });
    // asistente sin evaluar? el flujo real las crea juntas; añadimos uno solo con asistencia
    await prisma.asistencia.create({
      data: { reservaId: r1.id, nombreCompleto: "Sin eval", documento: "9", correo: "x@t.co", programaAcademicoId: programa.id, aceptaTratamiento: true },
    });

    const s = await estadisticasAdmin({});
    expect(s.satisfaccion.calificacionGeneral.promedio).toBe(4); // (5+3+4)/3
    expect(s.satisfaccion.calificacionGeneral.respuestas).toBe(3);
    expect(s.satisfaccion.totalEvaluaciones).toBe(3);
    expect(s.totalAsistentes).toBe(4);
    expect(s.satisfaccion.tasaRespuesta).toBe(75); // 3 evaluaciones / 4 asistencias
  });

  it("no presenta promedio cuando no hay evaluaciones", async () => {
    const { curso1, f1 } = await seed();
    await crearReservaDirecta({
      cursoId: curso1.id, formadorId: f1.formadorId,
      inicio: proximoDia(1).inicio, fin: proximoDia(1).fin,
    });
    const s = await estadisticasAdmin({});
    expect(s.satisfaccion.calificacionGeneral.promedio).toBeNull();
    expect(s.satisfaccion.tasaRespuesta).toBeNull();
  });

  it("no incluye formaciones canceladas en las estadísticas de satisfacción", async () => {
    const { curso1, f1, programa } = await seed();
    const cancelada = await crearReservaDirecta({
      cursoId: curso1.id, formadorId: f1.formadorId,
      inicio: proximoDia(1).inicio, fin: proximoDia(1).fin, estado: "CANCELADA",
    });
    // evaluación "huérfana" asociada a la cancelada (no debería pasar por el flujo, pero el cálculo lo excluye)
    const a = await prisma.asistencia.create({
      data: { reservaId: cancelada.id, nombreCompleto: "E", documento: "5", correo: "e@t.co", programaAcademicoId: programa.id, aceptaTratamiento: true },
    });
    await prisma.evaluacionFormacion.create({
      data: { reservaId: cancelada.id, asistenciaId: a.id, calificacionGeneral: 1 },
    });
    const s = await estadisticasAdmin({});
    expect(s.satisfaccion.calificacionGeneral.promedio).toBeNull();
    expect(s.reservas.canceladas).toBe(1);
  });

  it("filtros por curso y por fecha funcionan", async () => {
    const { curso1, curso2, f1, programa } = await seed();
    const enero = DateTime.fromISO("2026-01-15T10:00", { zone: ZONA });
    const junio = DateTime.fromISO("2026-06-15T10:00", { zone: ZONA });
    const r1 = await crearReservaDirecta({ cursoId: curso1.id, formadorId: f1.formadorId, inicio: enero, fin: enero.plus({ hours: 2 }), estado: "FINALIZADA" });
    const r2 = await crearReservaDirecta({ cursoId: curso2.id, formadorId: f1.formadorId, inicio: junio, fin: junio.plus({ hours: 2 }), estado: "FINALIZADA" });
    await registrar("1", r1.id, programa.id, { g: 2 });
    await registrar("2", r2.id, programa.id, { g: 5 });

    const porCurso = await estadisticasAdmin({ cursoId: curso1.id });
    expect(porCurso.satisfaccion.calificacionGeneral.promedio).toBe(2);
    expect(porCurso.reservas.solicitadas).toBe(1);

    const porMes = await estadisticasAdmin({ anio: 2026, mes: 6 });
    expect(porMes.satisfaccion.calificacionGeneral.promedio).toBe(5);
    expect(porMes.reservas.solicitadas).toBe(1);
  });

  it("promedio por formador distingue a cada uno", async () => {
    const { curso1, f1, f2, programa } = await seed();
    const r1 = await crearReservaDirecta({ cursoId: curso1.id, formadorId: f1.formadorId, inicio: proximoDia(1).inicio.minus({ days: 7 }), fin: proximoDia(1).fin.minus({ days: 7 }), estado: "FINALIZADA" });
    const r2 = await crearReservaDirecta({ cursoId: curso1.id, formadorId: f2.formadorId, inicio: proximoDia(2).inicio.minus({ days: 7 }), fin: proximoDia(2).fin.minus({ days: 7 }), estado: "FINALIZADA" });
    await registrar("1", r1.id, programa.id, { g: 2 });
    await registrar("2", r2.id, programa.id, { g: 5 });

    const s = await estadisticasAdmin({});
    const pf1 = s.satisfaccion.porFormador.find(p => p.formadorId === f1.formadorId)!;
    const pf2 = s.satisfaccion.porFormador.find(p => p.formadorId === f2.formadorId)!;
    expect(pf1.promedio).toBe(2);
    expect(pf2.promedio).toBe(5);
  });

  it("dashboard del formador refleja solo sus datos", async () => {
    const { curso1, f1, f2, programa } = await seed();
    const r1 = await crearReservaDirecta({ cursoId: curso1.id, formadorId: f1.formadorId, inicio: proximoDia(1).inicio.minus({ days: 7 }), fin: proximoDia(1).fin.minus({ days: 7 }), estado: "FINALIZADA" });
    await crearReservaDirecta({ cursoId: curso1.id, formadorId: f2.formadorId, inicio: proximoDia(2).inicio.minus({ days: 7 }), fin: proximoDia(2).fin.minus({ days: 7 }), estado: "FINALIZADA" });
    await registrar("1", r1.id, programa.id, { g: 4 });

    const s = await estadisticasFormador(f1.formadorId, {});
    expect(s.satisfaccion.calificacionGeneral.promedio).toBe(4);
    expect(s.satisfaccion.totalEvaluaciones).toBe(1);
    expect(s.formacionesImpartidas).toBe(1);
  });

  it("finalizadas sin evaluación se reportan para revisión", async () => {
    const { curso1, f1 } = await seed();
    await crearReservaDirecta({ cursoId: curso1.id, formadorId: f1.formadorId, inicio: proximoDia(1).inicio.minus({ days: 7 }), fin: proximoDia(1).fin.minus({ days: 7 }), estado: "FINALIZADA" });
    const s = await estadisticasAdmin({});
    expect(s.satisfaccion.finalizadasSinEvaluacion).toBe(1);
  });
});
