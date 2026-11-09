import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { resetDb, prisma, crearCurso, crearFormador, SEMANA_COMPLETA, proximoDia, proximoHorarioCubierto } from "./helpers";
import { crearReserva, cancelarConToken, vistaPreviaCancelacion } from "../../src/services/reserva.service";
import { generarToken, hashToken } from "../../src/utils/tokens";
import { DateTime } from "luxon";
import { ZONA } from "../../src/config/env";

beforeAll(resetDb);
beforeEach(resetDb);

async function reservaConToken(inicio: DateTime, fin: DateTime) {
  const curso = await crearCurso();
  const f = await crearFormador({ usuario: "f", correo: "f@t.co", franjas: SEMANA_COMPLETA, cursoIds: [curso.id] });
  const { reserva, tokenCancelacion } = await crearReserva({
    docenteNombre: "D", docenteCorreo: "d@t.co", cursoId: curso.id,
    iniciaAt: inicio.toJSDate(), terminaAt: fin.toJSDate(),
  });
  return { curso, f, reserva, tokenCancelacion: tokenCancelacion as string };
}

describe("Cancelación por enlace del docente", () => {
  it("cancelación válida libera disponibilidad y consume el token", async () => {
    const { inicio, fin } = proximoDia(2, 10, 60);
    const { reserva, tokenCancelacion, f, curso } = await reservaConToken(inicio, fin);

    const id = await cancelarConToken(tokenCancelacion);
    const r = await prisma.reserva.findUniqueOrThrow({ where: { id } });
    expect(r.estado).toBe("CANCELADA");
    expect(r.canceladaAt).not.toBeNull();

    // QR invalidado
    const qr = await prisma.registroQrFormacion.findUnique({ where: { reservaId: r.id } });
    expect(qr!.estado).toBe("INVALIDADO");
    expect(qr!.estadoEnvio).toBe("OMITIDO");

    // La franja vuelve a estar libre: otra reserva puede tomarla
    const otra = await crearReserva({
      docenteNombre: "Otro", docenteCorreo: "o@t.co", cursoId: curso.id,
      iniciaAt: inicio.toJSDate(), terminaAt: fin.toJSDate(),
    });
    expect(otra.reserva.formadorId).toBe(f.formadorId);
  });

  it("exactamente 2 horas antes aún se permite (límite exclusivo)", async () => {
    const { inicio, fin } = proximoHorarioCubierto();
    const { reserva, tokenCancelacion } = await reservaConToken(inicio, fin);
    // Adelantamos la reserva para simular que faltan exactamente 2h
    const nuevoInicio = DateTime.now().setZone(ZONA).plus({ hours: 2, seconds: 5 });
    await prisma.reserva.update({
      where: { id: reserva.id },
      data: { iniciaAt: nuevoInicio.toJSDate(), terminaAt: nuevoInicio.plus({ hours: 1 }).toJSDate() },
    });
    const id = await cancelarConToken(tokenCancelacion);
    expect(id).toBe(reserva.id);
  });

  it("fuera del plazo (menos de 2 h) es rechazada", async () => {
    const { inicio, fin } = proximoHorarioCubierto();
    const { reserva, tokenCancelacion } = await reservaConToken(inicio, fin);
    await prisma.reserva.update({
      where: { id: reserva.id },
      data: { iniciaAt: DateTime.now().setZone(ZONA).plus({ minutes: 90 }).toJSDate() },
    });
    await expect(cancelarConToken(tokenCancelacion)).rejects.toMatchObject({ status: 409 });
    const r = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } });
    expect(r.estado).toBe("CONFIRMADA");
  });

  it("token inválido es rechazado", async () => {
    await expect(cancelarConToken("token-que-no-existe-en-db")).rejects.toMatchObject({ status: 400 });
  });

  it("token reutilizado es rechazado", async () => {
    const { inicio, fin } = proximoDia(3, 10, 60);
    const { tokenCancelacion } = await reservaConToken(inicio, fin);
    await cancelarConToken(tokenCancelacion);
    await expect(cancelarConToken(tokenCancelacion)).rejects.toMatchObject({ status: 409 });
  });

  it("solo se almacena el hash del token (nunca en texto plano)", async () => {
    const { inicio, fin } = proximoDia(3, 11, 60);
    const { tokenCancelacion, reserva } = await reservaConToken(inicio, fin);
    const t = await prisma.tokenSeguro.findFirst({ where: { reservaId: reserva.id } });
    expect(t!.hash).toBe(hashToken(tokenCancelacion));
    expect(t!.hash).not.toBe(tokenCancelacion);
  });

  it("la vista previa no cancela y devuelve datos mínimos", async () => {
    const { inicio, fin } = proximoDia(4, 10, 60);
    const { tokenCancelacion, reserva } = await reservaConToken(inicio, fin);
    const previa = await vistaPreviaCancelacion(tokenCancelacion);
    expect(previa.curso).toBe("Curso de prueba");
    expect(previa.puedeCancelar).toBe(true);
    const r = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } });
    expect(r.estado).toBe("CONFIRMADA"); // no cancelada por el GET
  });
});
