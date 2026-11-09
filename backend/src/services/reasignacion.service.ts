import { prisma, Tx } from "../repositories/prisma";
import { DateTime } from "luxon";
import { aBogota } from "../utils/tiempo";
import { badRequest, conflict, forbidden, notFound } from "../utils/errors";
import { candidatosPara, mejorCandidato } from "./asignacion.service";
import { encolar } from "./notificacion.service";
import { generarToken, hashToken } from "../utils/tokens";
import { programarQrPara } from "./qr.service";
import { Intervalo } from "../utils/disponibilidad";
import { cubreIntervalo } from "./disponibilidad.service";
import { env } from "../config/env";

function datosCorreoReserva(r: {
  codigo: string; iniciaAt: Date; terminaAt: Date;
  curso: { nombre: string };
  aula?: string | null; docenteTelefono?: string | null;
}) {
  const ini = aBogota(r.iniciaAt);
  return {
    curso: r.curso.nombre,
    fecha: ini.toFormat("dd/MM/yyyy"),
    horaInicio: ini.toFormat("HH:mm"),
    horaFin: aBogota(r.terminaAt).toFormat("HH:mm"),
    codigoReserva: r.codigo,
    aula: r.aula ?? undefined,
    docenteTelefono: r.docenteTelefono ?? undefined,
  };
}

async function notificarAdmins(tx: Tx, datos: Parameters<typeof encolar>[1]["datos"], dedupPrefix: string) {
  const admins = await tx.cuenta.findMany({
    where: { rol: "ADMIN", activo: true },
  });
  for (const a of admins) {
    await encolar(tx, {
      tipo: "SOLICITUD_REASIGNACION_ADMIN",
      destinatario: a.correo,
      datos: { ...datos, nombreDestinatario: a.nombreCompleto },
      dedupKey: `${dedupPrefix}:${a.id}`,
    });
  }
}

/** El formador solicita reasignación por calamidad de una reserva suya. */
export async function solicitarReasignacion(
  formadorId: string, reservaId: string, motivo: string, observacion: string | undefined,
  actorCuentaId: string, ip?: string
) {
  return prisma.$transaction(async (tx) => {
    const reserva = await tx.reserva.findUnique({
      where: { id: reservaId },
      include: { curso: true, formador: { include: { cuenta: true } } },
    });
    if (!reserva) throw notFound("Reserva no encontrada");
    if (reserva.formadorId !== formadorId) throw forbidden("La reserva no te pertenece");
    if (reserva.estado !== "CONFIRMADA") throw conflict("Solo se pueden reasignar reservas confirmadas");

    const pendiente = await tx.solicitudReasignacion.findFirst({
      where: {
        reservaId,
        estado: { in: ["PENDIENTE", "SIN_REEMPLAZO", "PENDIENTE_RESPUESTA_DOCENTE"] },
      },
    });
    if (pendiente) throw conflict("Ya existe una solicitud de reasignación en curso");

    const solicitud = await tx.solicitudReasignacion.create({
      data: {
        reservaId,
        formadorSolicitanteId: formadorId,
        motivo,
        observacion: observacion ?? null,
      },
    });
    await tx.reserva.update({
      where: { id: reservaId },
      data: { incidenciaPendiente: true },
    });
    await tx.historialReserva.create({
      data: {
        reservaId, evento: "REASIGNACION_SOLICITADA",
        detalle: { motivo, observacion, solicitudId: solicitud.id } as object,
        actorCuentaId,
      },
    });
    await notificarAdmins(tx, {
      ...datosCorreoReserva(reserva),
      formador: reserva.formador.cuenta.nombreCompleto,
      motivo, observacion,
    }, `solicitud-reasig:${solicitud.id}`);
    return solicitud;
  });
}

/** Reemplazos elegibles ordenados por menor ocupación semanal. */
export async function reemplazosPara(solicitudId: string) {
  const s = await prisma.solicitudReasignacion.findUnique({
    where: { id: solicitudId }, include: { reserva: true },
  });
  if (!s) throw notFound("Solicitud no encontrada");
  const r = s.reserva;
  return candidatosPara(
    prisma, r.cursoId, aBogota(r.iniciaAt), aBogota(r.terminaAt), s.formadorSolicitanteId
  );
}

/**
 * Fechas alternativas dentro de los próximos `dias` días donde exista al menos
 * un formador habilitado con la franja completa libre (misma hora de inicio/fin).
 */
export async function fechasAlternativas(solicitudId: string, dias = 14): Promise<Intervalo[]> {
  const s = await prisma.solicitudReasignacion.findUnique({
    where: { id: solicitudId },
    include: { reserva: { include: { curso: { include: { formadores: true } } } } },
  });
  if (!s) throw notFound("Solicitud no encontrada");
  const r = s.reserva;
  const ini = aBogota(r.iniciaAt);
  const fin = aBogota(r.terminaAt);
  const duracionMin = fin.diff(ini, "minutes").minutes;

  const formadorIds = r.curso.formadores
    .map(fc => fc.formadorId)
    .filter(id => id !== s.formadorSolicitanteId);

  const resultado: Intervalo[] = [];
  for (let d = 1; d <= dias; d++) {
    const dia = ini.plus({ days: d });
    const candidatoInicio = dia.startOf("day").plus({
      hours: ini.hour, minutes: ini.minute,
    });
    const candidatoFin = candidatoInicio.plus({ minutes: duracionMin });
    for (const fid of formadorIds) {
      const cubre = await cubreIntervalo(prisma, fid, candidatoInicio, candidatoFin, r.id);
      if (cubre) { resultado.push({ inicio: candidatoInicio, fin: candidatoFin }); break; }
    }
  }
  return resultado;
}

/** Aprobación administrativa: cambio transaccional de formador + notificaciones. */
export async function aprobarReasignacion(
  solicitudId: string, nuevoFormadorId: string, adminCuentaId: string, ip?: string
) {
  return prisma.$transaction(async (tx) => {
    const s = await tx.solicitudReasignacion.findUnique({
      where: { id: solicitudId },
      include: {
        reserva: { include: { curso: true, formador: { include: { cuenta: true } } } },
        solicitante: { include: { cuenta: true } },
      },
    });
    if (!s) throw notFound("Solicitud no encontrada");
    if (s.estado !== "PENDIENTE" && s.estado !== "SIN_REEMPLAZO") {
      throw conflict("La solicitud ya fue gestionada");
    }
    const reserva = s.reserva;
    if (reserva.estado !== "CONFIRMADA") throw conflict("La reserva ya no está activa");
    if (nuevoFormadorId === reserva.formadorId) throw badRequest("El reemplazo debe ser otro formador");

    // Revalidar elegibilidad del reemplazo justo antes de aplicar el cambio
    const cubre = await cubreIntervalo(
      tx, nuevoFormadorId, aBogota(reserva.iniciaAt), aBogota(reserva.terminaAt)
    );
    if (!cubre) throw conflict("El formador propuesto ya no tiene disponibilidad");

    const habilitado = await tx.formadorCurso.findUnique({
      where: { formadorId_cursoId: { formadorId: nuevoFormadorId, cursoId: reserva.cursoId } },
    });
    if (!habilitado) throw badRequest("El formador no está habilitado para este curso");
    const cuentaNuevo = await tx.cuenta.findUnique({
      where: { id: (await tx.formador.findUniqueOrThrow({ where: { id: nuevoFormadorId } })).cuentaId },
    });
    if (!cuentaNuevo?.activo) throw badRequest("El formador propuesto está inactivo");

    await tx.reserva.update({
      where: { id: reserva.id },
      data: { formadorId: nuevoFormadorId, incidenciaPendiente: false },
    });
    await tx.solicitudReasignacion.update({
      where: { id: s.id },
      data: {
        estado: "APROBADA",
        reemplazoSugeridoId: nuevoFormadorId,
        gestionadaPorId: adminCuentaId,
        resueltaAt: new Date(),
      },
    });
    await tx.historialReserva.create({
      data: {
        reservaId: reserva.id, evento: "REASIGNADA",
        detalle: { de: reserva.formadorId, a: nuevoFormadorId } as object,
        actorCuentaId: adminCuentaId,
      },
    });

    const datos = { ...datosCorreoReserva(reserva), formador: cuentaNuevo.nombreCompleto };
    // El docente no se notifica del cambio interno de formador: solo recibe
    // correo si la reserva termina cancelada por no poder reasignarse.
    await encolar(tx, {
      tipo: "REASIGNACION_APROBADA", destinatario: reserva.formador.cuenta.correo,
      datos: { ...datos, nombreDestinatario: reserva.formador.cuenta.nombreCompleto },
      dedupKey: `reasig-aprobada:${s.id}:original`,
    });
    await encolar(tx, {
      tipo: "NUEVA_FORMACION_ASIGNADA", destinatario: cuentaNuevo.correo,
      datos: { ...datos, nombreDestinatario: cuentaNuevo.nombreCompleto },
      dedupKey: `reasig-aprobada:${s.id}:nuevo`,
    });
  }, { isolationLevel: "Serializable" });
}

export async function rechazarReasignacion(solicitudId: string, motivo: string, adminCuentaId: string, ip?: string) {
  return prisma.$transaction(async (tx) => {
    const s = await tx.solicitudReasignacion.findUnique({
      where: { id: solicitudId },
      include: { reserva: { include: { curso: true } }, solicitante: { include: { cuenta: true } } },
    });
    if (!s) throw notFound("Solicitud no encontrada");
    if (s.estado !== "PENDIENTE" && s.estado !== "SIN_REEMPLAZO") throw conflict("La solicitud ya fue gestionada");

    await tx.solicitudReasignacion.update({
      where: { id: s.id },
      data: { estado: "RECHAZADA", gestionadaPorId: adminCuentaId, resueltaAt: new Date() },
    });
    await tx.reserva.update({ where: { id: s.reservaId }, data: { incidenciaPendiente: false } });
    await tx.historialReserva.create({
      data: {
        reservaId: s.reservaId, evento: "REASIGNACION_RECHAZADA",
        detalle: { motivo } as object, actorCuentaId: adminCuentaId,
      },
    });
    await encolar(tx, {
      tipo: "REASIGNACION_RECHAZADA", destinatario: s.solicitante.cuenta.correo,
      datos: {
        ...datosCorreoReserva(s.reserva), motivo,
        nombreDestinatario: s.solicitante.cuenta.nombreCompleto,
      },
      dedupKey: `reasig-rechazada:${s.id}`,
    });
  });
}

/** Marca SIN_REEMPLAZO cuando el admin constata que no hay candidato. */
export async function marcarSinReemplazo(solicitudId: string, adminCuentaId: string) {
  const s = await prisma.solicitudReasignacion.updateMany({
    where: { id: solicitudId, estado: "PENDIENTE" },
    data: { estado: "SIN_REEMPLAZO" },
  });
  if (s.count === 0) throw conflict("La solicitud no está pendiente");
}

/** El admin propone una nueva fecha al docente (enlace seguro por correo). */
export async function proponerNuevaFecha(
  solicitudId: string, iniciaAt: Date, terminaAt: Date, adminCuentaId: string, ip?: string
) {
  const inicio = aBogota(iniciaAt);
  const fin = aBogota(terminaAt);
  if (fin <= inicio) throw badRequest("Rango horario inválido");
  if (inicio < DateTime.now()) throw badRequest("No se puede proponer una fecha pasada");

  return prisma.$transaction(async (tx) => {
    const s = await tx.solicitudReasignacion.findUnique({
      where: { id: solicitudId }, include: { reserva: { include: { curso: true } } },
    });
    if (!s) throw notFound("Solicitud no encontrada");
    if (!["PENDIENTE", "SIN_REEMPLAZO", "PENDIENTE_RESPUESTA_DOCENTE"].includes(s.estado)) {
      throw conflict("La solicitud ya fue resuelta");
    }
    if (s.reserva.estado !== "CONFIRMADA") throw conflict("La reserva ya no está activa");

    // Debe existir al menos un formador elegible en la fecha propuesta
    const candidato = await mejorCandidato(
      tx, s.reserva.cursoId, inicio, fin, s.formadorSolicitanteId
    );
    if (!candidato) throw conflict("No hay formador disponible en la fecha propuesta");

    // Una sola propuesta vigente a la vez
    await tx.propuestaFecha.updateMany({
      where: { solicitudId: s.id, estado: "PENDIENTE" },
      data: { estado: "RECHAZADA", respondidaAt: new Date() },
    });

    const token = generarToken();
    const propuesta = await tx.propuestaFecha.create({
      data: { solicitudId: s.id, iniciaAt: inicio.toJSDate(), terminaAt: fin.toJSDate() },
    });
    await tx.tokenSeguro.create({
      data: {
        tipo: "PROPUESTA_FECHA", hash: hashToken(token),
        propuestaId: propuesta.id, reservaId: s.reservaId,
        expiraAt: s.reserva.iniciaAt, // deja de tener sentido una vez pasada la fecha original
      },
    });
    await tx.solicitudReasignacion.update({
      where: { id: s.id }, data: { estado: "PENDIENTE_RESPUESTA_DOCENTE" },
    });

    await encolar(tx, {
      tipo: "PROPUESTA_NUEVA_FECHA", destinatario: s.reserva.docenteCorreo,
      datos: {
        nombreDestinatario: s.reserva.docenteNombre,
        curso: s.reserva.curso.nombre,
        fecha: inicio.toFormat("dd/MM/yyyy"),
        horaInicio: inicio.toFormat("HH:mm"),
        horaFin: fin.toFormat("HH:mm"),
        codigoReserva: s.reserva.codigo,
        enlaceAccion: `${env.publicAppUrl}/propuesta-fecha?token=${token}`,
      },
      dedupKey: `propuesta:${propuesta.id}`,
    });
    return { propuestaId: propuesta.id };
  });
}

/** Datos mínimos de la propuesta para mostrar al docente antes de responder. */
export async function vistaPreviaPropuesta(token: string) {
  const t = await prisma.tokenSeguro.findUnique({
    where: { hash: hashToken(token) },
    include: {
      propuesta: { include: { solicitud: { include: { reserva: { include: { curso: true } } } } } },
    },
  });
  if (!t || t.tipo !== "PROPUESTA_FECHA" || !t.propuesta) throw badRequest("Enlace inválido");
  const p = t.propuesta;
  const r = p.solicitud.reserva;
  const ini = aBogota(p.iniciaAt);
  return {
    curso: r.curso.nombre,
    codigoReserva: r.codigo,
    fechaPropuesta: ini.toFormat("dd/MM/yyyy"),
    horaInicio: ini.toFormat("HH:mm"),
    horaFin: aBogota(p.terminaAt).toFormat("HH:mm"),
    estado: p.estado,
    usado: Boolean(t.usadoAt),
    expirado: t.expiraAt < new Date(),
  };
}

/** El docente acepta la propuesta → nueva fecha + nuevo formador + reprogramar QR. */
export async function aceptarPropuesta(token: string, ip?: string) {
  return prisma.$transaction(async (tx) => {
    const t = await tx.tokenSeguro.findUnique({
      where: { hash: hashToken(token) },
      include: {
        propuesta: {
          include: { solicitud: { include: { reserva: { include: { curso: true } } } } },
        },
      },
    });
    if (!t || t.tipo !== "PROPUESTA_FECHA" || !t.propuesta) throw badRequest("Enlace inválido");
    if (t.usadoAt) throw conflict("Este enlace ya fue utilizado");
    if (t.expiraAt < new Date()) throw conflict("La propuesta expiró");
    const p = t.propuesta;
    if (p.estado !== "PENDIENTE") throw conflict("La propuesta ya fue respondida");
    const s = p.solicitud;
    const r = s.reserva;
    if (r.estado !== "CONFIRMADA") throw conflict("La reserva ya no está activa");

    const inicio = aBogota(p.iniciaAt);
    const fin = aBogota(p.terminaAt);

    // Recalcular el formador al aceptar (puede haber cambiado la disponibilidad)
    const candidato = await mejorCandidato(tx, r.cursoId, inicio, fin, s.formadorSolicitanteId);
    if (!candidato) throw conflict("La fecha propuesta dejó de estar disponible");

    await tx.tokenSeguro.update({ where: { id: t.id }, data: { usadoAt: new Date() } });
    await tx.propuestaFecha.update({
      where: { id: p.id }, data: { estado: "ACEPTADA", respondidaAt: new Date() },
    });
    await tx.solicitudReasignacion.update({
      where: { id: s.id }, data: { estado: "RESUELTA", resueltaAt: new Date() },
    });
    await tx.reserva.update({
      where: { id: r.id },
      data: {
        iniciaAt: inicio.toJSDate(), terminaAt: fin.toJSDate(),
        formadorId: candidato.formadorId, incidenciaPendiente: false,
      },
    });

    // El QR se reprograma a la nueva fecha (y su envío también)
    await programarQrPara(tx, r.id);

    // El token de cancelación del docente se extiende a la nueva fecha
    await tx.tokenSeguro.updateMany({
      where: { reservaId: r.id, tipo: "CANCELACION_RESERVA", usadoAt: null },
      data: { expiraAt: inicio.toJSDate() },
    });

    const cuentaNuevo = await tx.cuenta.findFirst({ where: { formador: { id: candidato.formadorId } } });
    const datos = {
      curso: r.curso.nombre,
      fecha: inicio.toFormat("dd/MM/yyyy"),
      horaInicio: inicio.toFormat("HH:mm"),
      horaFin: fin.toFormat("HH:mm"),
      codigoReserva: r.codigo,
      formador: cuentaNuevo?.nombreCompleto,
    };
    await encolar(tx, {
      tipo: "CONFIRMACION_FECHA_MODIFICADA", destinatario: r.docenteCorreo,
      datos: { ...datos, nombreDestinatario: r.docenteNombre },
      dedupKey: `fecha-modificada:${r.id}`,
    });
    await encolar(tx, {
      tipo: "ACEPTACION_NUEVA_FECHA", destinatario: (await tx.cuenta.findFirst({ where: { formador: { id: s.formadorSolicitanteId } } }))!.correo,
      datos: { ...datos },
      dedupKey: `aceptacion-propuesta:${p.id}`,
    });
    if (cuentaNuevo) {
      await encolar(tx, {
        tipo: "NUEVA_FORMACION_ASIGNADA", destinatario: cuentaNuevo.correo,
        datos: { ...datos, nombreDestinatario: cuentaNuevo.nombreCompleto },
        dedupKey: `asignacion-propuesta:${p.id}`,
      });
    }
    await tx.historialReserva.create({
      data: {
        reservaId: r.id, evento: "FECHA_MODIFICADA",
        detalle: { iniciaAt: inicio.toISO(), terminaAt: fin.toISO(), formadorId: candidato.formadorId } as object,
      },
    });
  }, { isolationLevel: "Serializable" });
}

/** El docente rechaza la propuesta → vuelve a revisión administrativa. */
export async function rechazarPropuesta(token: string, ip?: string) {
  return prisma.$transaction(async (tx) => {
    const t = await prisma.tokenSeguro.findUnique({
      where: { hash: hashToken(token) },
      include: { propuesta: { include: { solicitud: { include: { reserva: { include: { curso: true } } } } } } },
    });
    if (!t || t.tipo !== "PROPUESTA_FECHA" || !t.propuesta) throw badRequest("Enlace inválido");
    if (t.usadoAt) throw conflict("Este enlace ya fue utilizado");
    const p = t.propuesta;
    if (p.estado !== "PENDIENTE") throw conflict("La propuesta ya fue respondida");

    await tx.tokenSeguro.update({ where: { id: t.id }, data: { usadoAt: new Date() } });
    await tx.propuestaFecha.update({
      where: { id: p.id }, data: { estado: "RECHAZADA", respondidaAt: new Date() },
    });
    // Vuelve a pendiente para que el admin proponga otra alternativa
    await tx.solicitudReasignacion.update({
      where: { id: p.solicitudId }, data: { estado: "SIN_REEMPLAZO" },
    });
    await tx.historialReserva.create({
      data: { reservaId: p.solicitud.reservaId, evento: "PROPUESTA_RECHAZADA" },
    });
    const r = p.solicitud.reserva;
    const solicitante = await tx.cuenta.findFirst({ where: { formador: { id: p.solicitud.formadorSolicitanteId } } });
    if (solicitante) {
      await encolar(tx, {
        tipo: "RECHAZO_PROPUESTA", destinatario: solicitante.correo,
        datos: { ...datosCorreoReserva(r), nombreDestinatario: solicitante.nombreCompleto },
        dedupKey: `rechazo-propuesta:${p.id}`,
      });
    }
  }, { isolationLevel: "Serializable" });
}
