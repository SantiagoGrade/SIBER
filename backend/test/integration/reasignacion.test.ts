import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { resetDb, prisma, crearCurso, crearFormador, crearReservaDirecta, SEMANA_COMPLETA, proximoDia } from "./helpers";
import {
  solicitarReasignacion, reemplazosPara, aprobarReasignacion, rechazarReasignacion,
  proponerNuevaFecha, aceptarPropuesta, rechazarPropuesta,
} from "../../src/services/reasignacion.service";
import { crearCuenta } from "./helpers";
import { generarToken, hashToken } from "../../src/utils/tokens";
import { DateTime } from "luxon";

beforeAll(resetDb);
beforeEach(resetDb);

async function escenario() {
  const curso = await crearCurso();
  const f1 = await crearFormador({ usuario: "f1", correo: "f1@t.co", franjas: SEMANA_COMPLETA, cursoIds: [curso.id] });
  const f2 = await crearFormador({ usuario: "f2", correo: "f2@t.co", franjas: SEMANA_COMPLETA, cursoIds: [curso.id] });
  const admin = await crearCuenta({ usuario: "admin", correo: "a@t.co", rol: "ADMIN" });
  const { inicio, fin } = proximoDia(2, 10, 60);
  const reserva = await crearReservaDirecta({ cursoId: curso.id, formadorId: f1.formadorId, inicio, fin });
  return { curso, f1, f2, admin, reserva, inicio, fin };
}

describe("Reasignaciones por calamidad", () => {
  it("solicitud del formador propietario queda PENDIENTE y marca incidencia", async () => {
    const { f1, reserva } = await escenario();
    const s = await solicitarReasignacion(f1.formadorId, reserva.id, "Calamidad doméstica", "No puedo asistir", f1.cuenta.id);
    expect(s.estado).toBe("PENDIENTE");
    const r = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } });
    expect(r.incidenciaPendiente).toBe(true);
    expect(r.estado).toBe("CONFIRMADA"); // no cambia el estado principal
    // Aviso a administradores encolado
    expect((await prisma.notificacion.findMany()).some(n => n.tipo === "SOLICITUD_REASIGNACION_ADMIN")).toBe(true);
  });

  it("un formador no puede solicitar reasignación de reserva ajena", async () => {
    const { f2, reserva } = await escenario();
    await expect(solicitarReasignacion(f2.formadorId, reserva.id, "X", undefined, f2.cuenta.id))
      .rejects.toMatchObject({ status: 403 });
  });

  it("rechaza una segunda solicitud sobre la misma reserva", async () => {
    const { f1, reserva } = await escenario();
    await solicitarReasignacion(f1.formadorId, reserva.id, "Motivo", undefined, f1.cuenta.id);
    await expect(solicitarReasignacion(f1.formadorId, reserva.id, "Otro", undefined, f1.cuenta.id))
      .rejects.toMatchObject({ status: 409 });
  });

  it("reemplazosPara excluye al solicitante y exige cobertura completa", async () => {
    const { curso, f1, f2, reserva } = await escenario();
    // f3 sin cobertura en el horario de la reserva
    const f3 = await crearFormador({
      usuario: "f3", correo: "f3@t.co", cursoIds: [curso.id],
      franjas: [{ diaSemana: 1, horaInicio: 480, horaFin: 540 }],
    });
    const s = await solicitarReasignacion(f1.formadorId, reserva.id, "Motivo", undefined, f1.cuenta.id);
    const reemplazos = await reemplazosPara(s.id);
    const ids = reemplazos.map(r => r.formadorId);
    expect(ids).toContain(f2.formadorId);
    expect(ids).not.toContain(f1.formadorId);
    expect(ids).not.toContain(f3.formadorId);
  });

  it("aprobación: cambia el formador, conserva la reserva y deja historial", async () => {
    const { f1, f2, admin, reserva } = await escenario();
    const s = await solicitarReasignacion(f1.formadorId, reserva.id, "Motivo", undefined, f1.cuenta.id);
    await aprobarReasignacion(s.id, f2.formadorId, admin.id);
    const r = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id }, include: { historial: true } });
    expect(r.id).toBe(reserva.id); // mismo identificador
    expect(r.formadorId).toBe(f2.formadorId);
    expect(r.incidenciaPendiente).toBe(false);
    expect(r.historial.some(h => h.evento === "REASIGNADA")).toBe(true);
    const sol = await prisma.solicitudReasignacion.findUniqueOrThrow({ where: { id: s.id } });
    expect(sol.estado).toBe("APROBADA");
  });

  it("aprobación rechaza un reemplazo sin disponibilidad", async () => {
    const { curso, f1, admin, reserva, inicio, fin } = await escenario();
    const f3 = await crearFormador({
      usuario: "f3", correo: "f3@t.co", cursoIds: [curso.id],
      franjas: [{ diaSemana: 1, horaInicio: 480, horaFin: 540 }],
    });
    const s = await solicitarReasignacion(f1.formadorId, reserva.id, "Motivo", undefined, f1.cuenta.id);
    await expect(aprobarReasignacion(s.id, f3.formadorId, admin.id))
      .rejects.toMatchObject({ status: 409 });
    const r = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } });
    expect(r.formadorId).toBe(f1.formadorId); // sin cambios
  });

  it("rechazo administrativo libera la incidencia", async () => {
    const { f1, admin, reserva } = await escenario();
    const s = await solicitarReasignacion(f1.formadorId, reserva.id, "Motivo", undefined, f1.cuenta.id);
    await rechazarReasignacion(s.id, "No aplica", admin.id);
    const sol = await prisma.solicitudReasignacion.findUniqueOrThrow({ where: { id: s.id } });
    expect(sol.estado).toBe("RECHAZADA");
    const r = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } });
    expect(r.incidenciaPendiente).toBe(false);
  });

  it("propuesta aceptada: nueva fecha + nuevo formador + QR reprogramado + token consumido", async () => {
    const { f1, admin, reserva } = await escenario();
    const s = await solicitarReasignacion(f1.formadorId, reserva.id, "Motivo", undefined, f1.cuenta.id);
    const nuevoInicio = proximoDia(4, 10, 0).inicio;
    const { propuestaId } = await proponerNuevaFecha(s.id, nuevoInicio.toJSDate(), nuevoInicio.plus({ hours: 1 }).toJSDate(), admin.id);

    // Recuperar el token como lo haría el docente desde el correo
    const tokenRow = await prisma.tokenSeguro.findFirst({ where: { propuestaId, tipo: "PROPUESTA_FECHA" } });
    expect(tokenRow).not.toBeNull();
    // Simular el token crudo: regenerar no es posible (hash); para el test creamos uno equivalente
    // Usamos un token nuevo y sobreescribimos el hash como haría el flujo real:
    const tokenCrudo = generarToken();
    await prisma.tokenSeguro.update({ where: { id: tokenRow!.id }, data: { hash: hashToken(tokenCrudo) } });

    await aceptarPropuesta(tokenCrudo);
    const r = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id }, include: { qr: true } });
    expect(DateTime.fromJSDate(r.iniciaAt).toMillis()).toBe(nuevoInicio.toMillis());
    expect(r.incidenciaPendiente).toBe(false);
    // QR reprogramado a inicio+30 de la nueva fecha
    const dif = DateTime.fromJSDate(r.qr!.fechaEnvioProgramado).diff(nuevoInicio, "minutes").minutes;
    expect(Math.round(dif)).toBe(30);
    // El token no se puede reusar
    await expect(aceptarPropuesta(tokenCrudo)).rejects.toMatchObject({ status: 409 });
  });

  it("propuesta rechazada: la solicitud vuelve a revisión sin cambiar la reserva", async () => {
    const { f1, admin, reserva, inicio } = await escenario();
    const s = await solicitarReasignacion(f1.formadorId, reserva.id, "Motivo", undefined, f1.cuenta.id);
    const nuevoInicio = proximoDia(4, 10, 0).inicio;
    const { propuestaId } = await proponerNuevaFecha(s.id, nuevoInicio.toJSDate(), nuevoInicio.plus({ hours: 1 }).toJSDate(), admin.id);
    const tokenRow = await prisma.tokenSeguro.findFirstOrThrow({ where: { propuestaId } });
    const tokenCrudo = generarToken();
    await prisma.tokenSeguro.update({ where: { id: tokenRow.id }, data: { hash: hashToken(tokenCrudo) } });

    await rechazarPropuesta(tokenCrudo);
    const r = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } });
    expect(DateTime.fromJSDate(r.iniciaAt).toMillis()).toBe(inicio.toMillis()); // sin cambios
    const sol = await prisma.solicitudReasignacion.findUniqueOrThrow({ where: { id: s.id } });
    expect(sol.estado).toBe("SIN_REEMPLAZO"); // pendiente de resolución administrativa
  });

  it("mientras la solicitud está pendiente la franja del formador original sigue ocupada", async () => {
    const { curso, f1, f2, reserva, inicio, fin } = await escenario();
    await solicitarReasignacion(f1.formadorId, reserva.id, "Motivo", undefined, f1.cuenta.id);
    // Una nueva reserva en la misma franja NO puede tomar al formador original:
    // su franja no se libera hasta que haya resolución válida.
    const { crearReserva } = await import("../../src/services/reserva.service");
    const { reserva: nueva } = await crearReserva({
      docenteNombre: "D2", docenteCorreo: "d2@t.co", cursoId: curso.id,
      iniciaAt: inicio.toJSDate(), terminaAt: fin.toJSDate(),
    });
    expect(nueva.formadorId).toBe(f2.formadorId);
    expect(nueva.formadorId).not.toBe(f1.formadorId);
  });
});
