import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { resetDb, prisma, crearCurso, crearFormador, crearReservaDirecta, crearQrPara, SEMANA_COMPLETA, proximoDia } from "./helpers";
import { SmtpCaptura } from "./smtp-test";
import { procesarEnviosQr, programarQrPara, resolverTokenQr } from "../../src/services/qr.service";
import { crearReserva } from "../../src/services/reserva.service";
import { reiniciarTransporte } from "../../src/services/correo.service";
import { DateTime } from "luxon";
import { ZONA } from "../../src/config/env";

const smtp = new SmtpCaptura(3525);

beforeAll(async () => { await smtp.iniciar(); await resetDb(); });
afterAll(async () => { await smtp.detener(); });
beforeEach(async () => { smtp.limpiar(); await resetDb(); reiniciarTransporte(); });

async function escenarioQR() {
  const curso = await crearCurso();
  const f1 = await crearFormador({ usuario: "f1", correo: "formador1@t.co", franjas: SEMANA_COMPLETA, cursoIds: [curso.id] });
  const f2 = await crearFormador({ usuario: "f2", correo: "formador2@t.co", franjas: SEMANA_COMPLETA, cursoIds: [curso.id] });
  return { curso, f1, f2 };
}

describe("Job de envío del QR (inicio + 30 min, persistente)", () => {
  it("programa el envío exactamente 30 minutos después del inicio", async () => {
    const { curso } = await escenarioQR();
    const { inicio, fin } = proximoDia(2, 8, 120); // 8:00-10:00
    const { reserva } = await crearReserva({
      docenteNombre: "D", docenteCorreo: "d@t.co", cursoId: curso.id,
      iniciaAt: inicio.toJSDate(), terminaAt: fin.toJSDate(),
    });
    const qr = await prisma.registroQrFormacion.findUniqueOrThrow({ where: { reservaId: reserva.id } });
    const dif = DateTime.fromJSDate(qr.fechaEnvioProgramado).diff(inicio, "minutes").minutes;
    expect(Math.round(dif)).toBe(30); // 8:00 → 8:30
  });

  it("no envía antes de cumplirse los 30 minutos", async () => {
    const { curso, f1 } = await escenarioQR();
    const inicio = DateTime.now().setZone(ZONA).plus({ minutes: 40 });
    const reserva = await crearReservaDirecta({ cursoId: curso.id, formadorId: f1.formadorId, inicio, fin: inicio.plus({ hours: 2 }) });
    await crearQrPara(reserva.id, inicio); // envío programado a inicio+30 (en 70 min)

    await procesarEnviosQr();
    expect(smtp.mensajes).toHaveLength(0);
    const qr = await prisma.registroQrFormacion.findUniqueOrThrow({ where: { reservaId: reserva.id } });
    expect(qr.estadoEnvio).toBe("PENDIENTE");
  });

  it("envía al formador cuando el tiempo programado ya venció", async () => {
    const { curso, f1 } = await escenarioQR();
    const inicio = DateTime.now().setZone(ZONA).minus({ minutes: 40 });
    const reserva = await crearReservaDirecta({ cursoId: curso.id, formadorId: f1.formadorId, inicio, fin: inicio.plus({ hours: 3 }) });
    await crearQrPara(reserva.id, inicio); // envío vencido hace 10 min

    await procesarEnviosQr();
    expect(smtp.mensajesPara("formador1@t.co")).toHaveLength(1);
    const qr = await prisma.registroQrFormacion.findUniqueOrThrow({ where: { reservaId: reserva.id } });
    expect(qr.estadoEnvio).toBe("ENVIADO");
    expect(qr.fechaEnvioReal).not.toBeNull();
    expect(qr.destinatario).toBe("formador1@t.co");
    expect(qr.estado).toBe("ABIERTO");
    // El correo contiene el asunto institucional y el QR adjunto
    const mensaje = smtp.mensajesPara("formador1@t.co")[0];
    expect(mensaje.datos).toContain("SIBER");
    expect(mensaje.datos).toContain("asistencia");
  });

  it("reinicio del servidor: procesa pendientes vencidos (comportamiento persistente)", async () => {
    const { curso, f1 } = await escenarioQR();
    // Simula: el envío venció mientras el servidor estaba apagado
    const inicio = DateTime.now().setZone(ZONA).minus({ minutes: 60 });
    const reserva = await crearReservaDirecta({ cursoId: curso.id, formadorId: f1.formadorId, inicio, fin: inicio.plus({ hours: 4 }) });
    await crearQrPara(reserva.id, inicio);

    // "Reinicio": solo correr el job de nuevo — el estado estaba persistido
    await procesarEnviosQr();
    expect(smtp.mensajesPara("formador1@t.co")).toHaveLength(1);
  });

  it("no envía el QR de una formación cancelada (queda OMITIDO)", async () => {
    const { curso, f1 } = await escenarioQR();
    const inicio = DateTime.now().setZone(ZONA).minus({ minutes: 40 });
    const reserva = await crearReservaDirecta({
      cursoId: curso.id, formadorId: f1.formadorId, inicio,
      fin: inicio.plus({ hours: 3 }), estado: "CANCELADA",
    });
    await crearQrPara(reserva.id, inicio);

    await procesarEnviosQr();
    expect(smtp.mensajes).toHaveLength(0);
    const qr = await prisma.registroQrFormacion.findUniqueOrThrow({ where: { reservaId: reserva.id } });
    expect(qr.estadoEnvio).toBe("OMITIDO");
    expect(qr.estado).toBe("INVALIDADO");
  });

  it("formación reasignada: el QR llega al formador vigente, no al original", async () => {
    const { curso, f1, f2 } = await escenarioQR();
    const inicio = DateTime.now().setZone(ZONA).minus({ minutes: 40 });
    const reserva = await crearReservaDirecta({ cursoId: curso.id, formadorId: f1.formadorId, inicio, fin: inicio.plus({ hours: 3 }) });
    await crearQrPara(reserva.id, inicio);

    // Reasignación antes del envío (el QR original de f1 se elimina por la
    // exclusión: f1 conserva otras reservas pero esta pasa a f2)
    await prisma.reserva.update({ where: { id: reserva.id }, data: { formadorId: f2.formadorId } });
    await procesarEnviosQr();

    expect(smtp.mensajesPara("formador2@t.co")).toHaveLength(1);
    expect(smtp.mensajesPara("formador1@t.co")).toHaveLength(0);
    const qr = await prisma.registroQrFormacion.findUniqueOrThrow({ where: { reservaId: reserva.id } });
    expect(qr.destinatario).toBe("formador2@t.co");
  });

  it("cambio de fecha/hora: reprogramarQrPara recalcula el momento del envío", async () => {
    const { curso, f1 } = await escenarioQR();
    const inicio = proximoDia(2, 8, 120).inicio;
    const reserva = await crearReservaDirecta({ cursoId: curso.id, formadorId: f1.formadorId, inicio, fin: inicio.plus({ hours: 2 }) });
    await crearQrPara(reserva.id, inicio);

    const nuevoInicio = inicio.plus({ hours: 3 }); // 8:00 → 11:00
    await prisma.reserva.update({
      where: { id: reserva.id },
      data: { iniciaAt: nuevoInicio.toJSDate(), terminaAt: nuevoInicio.plus({ hours: 2 }).toJSDate() },
    });
    await prisma.$transaction(async (tx) => { await programarQrPara(tx, reserva.id); });

    const qr = await prisma.registroQrFormacion.findUniqueOrThrow({ where: { reservaId: reserva.id } });
    const dif = DateTime.fromJSDate(qr.fechaEnvioProgramado).diff(nuevoInicio, "minutes").minutes;
    expect(Math.round(dif)).toBe(30); // 11:00 → 11:30
    expect(qr.estadoEnvio).toBe("PENDIENTE"); // nunca antes del nuevo momento
  });

  it("fallo SMTP: conserva el envío pendiente y reintenta automáticamente", async () => {
    const { curso, f1 } = await escenarioQR();
    const inicio = DateTime.now().setZone(ZONA).minus({ minutes: 40 });
    const reserva = await crearReservaDirecta({ cursoId: curso.id, formadorId: f1.formadorId, inicio, fin: inicio.plus({ hours: 3 }) });
    await crearQrPara(reserva.id, inicio);

    // Apagar SMTP → el envío falla
    await smtp.detener();
    reiniciarTransporte();
    await procesarEnviosQr();
    let qr = await prisma.registroQrFormacion.findUniqueOrThrow({ where: { reservaId: reserva.id } });
    expect(qr.estadoEnvio).toBe("PENDIENTE");
    expect(qr.intentosEnvio).toBe(1);
    expect(qr.ultimoError).toBeTruthy();
    expect(qr.fechaEnvioProgramado.getTime()).toBeGreaterThan(Date.now()); // reprogramado con backoff

    // Recuperar SMTP y forzar la fecha → reintento exitoso
    await smtp.iniciar();
    reiniciarTransporte();
    await prisma.registroQrFormacion.update({
      where: { id: qr.id }, data: { fechaEnvioProgramado: new Date(Date.now() - 1000) },
    });
    await procesarEnviosQr();
    qr = await prisma.registroQrFormacion.findUniqueOrThrow({ where: { reservaId: reserva.id } });
    expect(qr.estadoEnvio).toBe("ENVIADO");
    expect(smtp.mensajesPara("formador1@t.co")).toHaveLength(1);
  });

  it("no genera correos duplicados aunque el job corra varias veces", async () => {
    const { curso, f1 } = await escenarioQR();
    const inicio = DateTime.now().setZone(ZONA).minus({ minutes: 40 });
    const reserva = await crearReservaDirecta({ cursoId: curso.id, formadorId: f1.formadorId, inicio, fin: inicio.plus({ hours: 3 }) });
    await crearQrPara(reserva.id, inicio);

    await procesarEnviosQr();
    await procesarEnviosQr();
    await procesarEnviosQr();
    expect(smtp.mensajesPara("formador1@t.co")).toHaveLength(1);
  });

  it("no envía el QR de una formación ya terminada: registra incidencia", async () => {
    const { curso, f1 } = await escenarioQR();
    const inicio = DateTime.now().setZone(ZONA).minus({ hours: 5 });
    const reserva = await crearReservaDirecta({ cursoId: curso.id, formadorId: f1.formadorId, inicio, fin: inicio.plus({ hours: 1 }) });
    await crearQrPara(reserva.id, inicio);

    await procesarEnviosQr();
    expect(smtp.mensajes).toHaveLength(0);
    const qr = await prisma.registroQrFormacion.findUniqueOrThrow({ where: { reservaId: reserva.id } });
    expect(qr.estadoEnvio).toBe("INCIDENCIA");
    expect(qr.ultimoError).toBeTruthy();
  });
});

describe("Vigencia del formulario de asistencia", () => {
  it("rechaza antes del momento habilitado", async () => {
    const { curso, f1 } = await escenarioQR();
    const inicio = DateTime.now().setZone(ZONA).plus({ hours: 5 });
    const reserva = await crearReservaDirecta({ cursoId: curso.id, formadorId: f1.formadorId, inicio, fin: inicio.plus({ hours: 2 }) });
    const { token } = await crearQrPara(reserva.id, inicio);
    await expect(resolverTokenQr(token)).rejects.toMatchObject({ status: 400 });
    // el intento quedó registrado
    expect(await prisma.registroIntentoQr.count()).toBe(1);
  });

  it("acepta dentro de la ventana y rechaza token inexistente", async () => {
    const { curso, f1 } = await escenarioQR();
    const inicio = DateTime.now().setZone(ZONA).minus({ minutes: 60 });
    const reserva = await crearReservaDirecta({ cursoId: curso.id, formadorId: f1.formadorId, inicio, fin: inicio.plus({ hours: 4 }) });
    const { token } = await crearQrPara(reserva.id, inicio);
    const estado = await resolverTokenQr(token);
    expect(estado.ok).toBe(true);
    if (estado.ok) expect(estado.curso).toBe("Curso de prueba");
    await expect(resolverTokenQr("token-inexistente")).rejects.toMatchObject({ status: 404 });
  });

  it("rechaza cuando el registro está cerrado", async () => {
    const { curso, f1 } = await escenarioQR();
    const inicio = DateTime.now().setZone(ZONA).minus({ minutes: 60 });
    const reserva = await crearReservaDirecta({ cursoId: curso.id, formadorId: f1.formadorId, inicio, fin: inicio.plus({ hours: 4 }) });
    const { token } = await crearQrPara(reserva.id, inicio);
    await prisma.registroQrFormacion.updateMany({ where: { reservaId: reserva.id }, data: { estado: "CERRADO" } });
    await expect(resolverTokenQr(token)).rejects.toMatchObject({ status: 400 });
  });

  it("rechaza cuando la formación fue cancelada", async () => {
    const { curso, f1 } = await escenarioQR();
    const inicio = DateTime.now().setZone(ZONA).minus({ minutes: 60 });
    const reserva = await crearReservaDirecta({ cursoId: curso.id, formadorId: f1.formadorId, inicio, fin: inicio.plus({ hours: 4 }), estado: "CANCELADA" });
    const { token } = await crearQrPara(reserva.id, inicio);
    await prisma.registroQrFormacion.updateMany({ where: { reservaId: reserva.id }, data: { estado: "INVALIDADO" } });
    await expect(resolverTokenQr(token)).rejects.toMatchObject({ status: 400 });
  });
});
