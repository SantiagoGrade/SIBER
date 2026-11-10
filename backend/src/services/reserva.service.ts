import { prisma, Tx } from "../repositories/prisma";
import { DateTime } from "luxon";
import { aBogota, ahora } from "../utils/tiempo";
import { badRequest, conflict, notFound, AppError } from "../utils/errors";
import { generarCodigoReserva, generarToken, hashToken } from "../utils/tokens";
import { mejorCandidato } from "./asignacion.service";
import { encolar } from "./notificacion.service";
import { obtenerConfigNum } from "./configuracion.service";
import { programarQrPara } from "./qr.service";
import { env } from "../config/env";

export interface SolicitudReservaInput {
  docenteNombre: string;
  docenteCorreo: string;
  docenteTelefono?: string;
  aula?: string;
  facultadId?: string;
  cursoId: string;
  iniciaAt: Date;
  terminaAt: Date;
  idempotencyKey?: string;
}

function fmt(d: DateTime) { return d.toFormat("dd/MM/yyyy"); }
function fmtHora(d: DateTime) { return d.toFormat("HH:mm"); }

/**
 * Crea una reserva con confirmación automática:
 * valida anticipación, selecciona el formador por menor ocupación semanal y
 * persiste todo (reserva + QR programado + token de cancelación + outbox +
 * historial) en una transacción serializable.
 */
export async function crearReserva(input: SolicitudReservaInput, idempotencyKey?: string, ip?: string) {
  const inicio = aBogota(input.iniciaAt);
  const fin = aBogota(input.terminaAt);
  if (!inicio.isValid || !fin.isValid) throw badRequest("Fechas inválidas");
  if (fin <= inicio) throw badRequest("La hora de finalización debe ser posterior a la de inicio");

  const anticipacionDias = await obtenerConfigNum("anticipacion_minima_dias");
  const limite = ahora().startOf("day").plus({ days: anticipacionDias });
  if (inicio < limite) {
    throw badRequest(`La reserva requiere una anticipación mínima de ${anticipacionDias} día${anticipacionDias === 1 ? "" : "s"} de calendario`);
  }
  if (inicio <= ahora()) throw badRequest("No se puede reservar en una fecha u hora pasada");

  const reintentos = 3;
  for (let intento = 0; intento < reintentos; intento++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Idempotencia: si ya existe una reserva con la misma clave, devolverla
        if (idempotencyKey) {
          const previa = await tx.reserva.findUnique({ where: { idempotencyKey } });
          if (previa) return { reserva: previa, duplicada: true };
        }

        const curso = await tx.curso.findUnique({ where: { id: input.cursoId } });
        if (!curso) throw notFound("Curso no encontrado");
        if (!curso.activo) throw badRequest("El curso no está activo");

        if (input.facultadId) {
          const fac = await tx.facultad.findUnique({ where: { id: input.facultadId } });
          if (!fac || !fac.activo) throw badRequest("Facultad inválida");
        }

        const elegido = await mejorCandidato(tx, input.cursoId, inicio, fin);
        if (!elegido) {
          throw new AppError(409, "No hay formadores disponibles en la franja seleccionada", "SIN_CANDIDATOS");
        }

        // Bloqueo serializado por (formador, día) para revalidar bajo el lock
        // y evitar carreras entre solicitudes simultáneas.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${elegido.formadorId}))`;

        const solape = await tx.reserva.findFirst({
          where: {
            formadorId: elegido.formadorId,
            estado: { in: ["CONFIRMADA", "EN_CURSO", "FINALIZADA"] },
            iniciaAt: { lt: fin.toJSDate() },
            terminaAt: { gt: inicio.toJSDate() },
          },
        });
        if (solape) throw new AppError(409, "La franja acaba de ser ocupada por otra reserva", "SOLAPE");

        const tokenCancelacion = generarToken();
        const reserva = await tx.reserva.create({
          data: {
            codigo: generarCodigoReserva(),
            idempotencyKey: idempotencyKey ?? null,
            cursoId: input.cursoId,
            formadorId: elegido.formadorId,
            docenteNombre: input.docenteNombre,
            docenteCorreo: input.docenteCorreo,
            docenteTelefono: input.docenteTelefono ?? null,
            aula: input.aula ?? null,
            facultadId: input.facultadId ?? null,
            iniciaAt: inicio.toJSDate(),
            terminaAt: fin.toJSDate(),
            estado: "CONFIRMADA",
          },
          include: { curso: true, formador: { include: { cuenta: true } } },
        });

        await tx.historialReserva.create({
          data: {
            reservaId: reserva.id,
            evento: "CREADA",
            detalle: { formadorId: elegido.formadorId, ocupacion: elegido.ocupacion } as object,
          },
        });

        await tx.tokenSeguro.create({
          data: {
            tipo: "CANCELACION_RESERVA",
            hash: hashToken(tokenCancelacion),
            reservaId: reserva.id,
            expiraAt: inicio.toJSDate(),
          },
        });

        const datosCorreo = {
          curso: reserva.curso.nombre,
          fecha: fmt(inicio),
          horaInicio: fmtHora(inicio),
          horaFin: fmtHora(fin),
          formador: reserva.formador.cuenta.nombreCompleto,
          codigoReserva: reserva.codigo,
          aula: reserva.aula ?? undefined,
          docenteTelefono: reserva.docenteTelefono ?? undefined,
        };

        await encolar(tx, {
          tipo: "CONFIRMACION_RESERVA",
          destinatario: reserva.docenteCorreo,
          datos: {
            ...datosCorreo,
            nombreDestinatario: reserva.docenteNombre,
            enlaceAccion: `${env.publicAppUrl}/cancelar-reserva?token=${tokenCancelacion}`,
          },
          dedupKey: `confirmacion:${reserva.id}`,
        });
        await encolar(tx, {
          tipo: "NUEVA_FORMACION_ASIGNADA",
          destinatario: reserva.formador.cuenta.correo,
          datos: { ...datosCorreo, nombreDestinatario: reserva.formador.cuenta.nombreCompleto },
          dedupKey: `asignacion:${reserva.id}`,
        });

        // QR de asistencia: se programa su envío para inicio + 30 min
        await programarQrPara(tx, reserva.id);

        return { reserva, tokenCancelacion, duplicada: false };
      }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 20_000 });
    } catch (e) {
      const esReintentable =
        (e instanceof AppError && e.code === "SOLAPE")
        || (e as { code?: string }).code === "P2034"
        || (e as { message?: string }).message?.includes("could not serialize")
        || (e as { message?: string }).message?.includes("excl_solape_formador");
      if (esReintentable && intento < reintentos - 1) continue;
      if (esReintentable) throw conflict("La franja dejó de estar disponible, elige otro horario");
      throw e;
    }
  }
  throw conflict("No fue posible crear la reserva");
}

/**
 * Cancelación por enlace del docente: válida hasta `cancelacion_min_horas`
 * antes del inicio. El token se consume una sola vez.
 */
export async function cancelarConToken(token: string, ip?: string) {
  const hash = hashToken(token);
  return prisma.$transaction(async (tx) => {
    const t = await tx.tokenSeguro.findUnique({ where: { hash }, include: { reserva: true } });
    if (!t || t.tipo !== "CANCELACION_RESERVA") throw badRequest("Enlace inválido");
    if (t.usadoAt) throw conflict("Este enlace ya fue utilizado");
    const reserva = t.reserva!;
    if (reserva.estado === "CANCELADA") throw conflict("La reserva ya está cancelada");
    if (reserva.estado === "FINALIZADA") throw conflict("La reserva ya finalizó");

    const limiteHoras = await obtenerConfigNum("cancelacion_min_horas");
    const limite = aBogota(reserva.iniciaAt).minus({ hours: limiteHoras });
    if (ahora() >= limite) {
      throw conflict(`El plazo de cancelación terminó ${limiteHoras} h antes del inicio`);
    }

    await tx.tokenSeguro.update({ where: { id: t.id }, data: { usadoAt: new Date() } });
    await efectuarCancelacion(tx, reserva.id, "Cancelada por el docente", null, ip);
    return reserva.id;
  }, { isolationLevel: "Serializable" });
}

/** Cancelación administrativa con registro de motivo y actor. */
export async function cancelarComoAdmin(reservaId: string, motivo: string, actorCuentaId: string, ip?: string) {
  return prisma.$transaction(async (tx) => {
    const reserva = await tx.reserva.findUnique({ where: { id: reservaId } });
    if (!reserva) throw notFound("Reserva no encontrada");
    if (reserva.estado !== "CONFIRMADA") throw conflict("Solo se cancelan reservas confirmadas");
    await efectuarCancelacion(tx, reservaId, motivo, actorCuentaId, ip);
  }, { isolationLevel: "Serializable" });
}

async function efectuarCancelacion(tx: Tx, reservaId: string, motivo: string, actorCuentaId: string | null, ip?: string) {
  const reserva = await tx.reserva.update({
    where: { id: reservaId },
    data: { estado: "CANCELADA", canceladaAt: new Date(), motivoCancelacion: motivo, incidenciaPendiente: false },
    include: { curso: true, formador: { include: { cuenta: true } } },
  });

  // Invalidar el QR de asistencia y omitir su envío si estaba programado
  await tx.registroQrFormacion.updateMany({
    where: { reservaId, estado: { not: "INVALIDADO" } },
    data: { estado: "INVALIDADO", estadoEnvio: "OMITIDO", ultimoError: "Reserva cancelada" },
  });

  // Solicitudes de reasignación pendientes quedan resueltas por la cancelación
  await tx.solicitudReasignacion.updateMany({
    where: { reservaId, estado: { in: ["PENDIENTE", "SIN_REEMPLAZO", "PENDIENTE_RESPUESTA_DOCENTE"] } },
    data: { estado: "RESUELTA", resueltaAt: new Date() },
  });

  const inicio = aBogota(reserva.iniciaAt);
  const datos = {
    curso: reserva.curso.nombre,
    fecha: inicio.toFormat("dd/MM/yyyy"),
    horaInicio: inicio.toFormat("HH:mm"),
    horaFin: aBogota(reserva.terminaAt).toFormat("HH:mm"),
    formador: reserva.formador.cuenta.nombreCompleto,
    codigoReserva: reserva.codigo,
    motivo,
  };
  await encolar(tx, {
    tipo: "CANCELACION_RESERVA", destinatario: reserva.docenteCorreo,
    datos: { ...datos, nombreDestinatario: reserva.docenteNombre },
    dedupKey: `cancelacion:${reserva.id}:docente`,
  });
  await encolar(tx, {
    tipo: "CANCELACION_RESERVA", destinatario: reserva.formador.cuenta.correo,
    datos: { ...datos, nombreDestinatario: reserva.formador.cuenta.nombreCompleto },
    dedupKey: `cancelacion:${reserva.id}:formador`,
  });
  await tx.historialReserva.create({
    data: { reservaId, evento: "CANCELADA", detalle: { motivo } as object, actorCuentaId },
  });
}

/**
 * Marca EN_CURSO las reservas cuya hora de inicio ya llegó.
 * Idempotente; solo CONFIRMADA → EN_CURSO.
 */
export async function iniciarVigentes(): Promise<number> {
  const ahoraDate = new Date();
  const candidatas = await prisma.reserva.findMany({
    where: { estado: "CONFIRMADA", iniciaAt: { lte: ahoraDate }, terminaAt: { gt: ahoraDate } },
    select: { id: true },
    take: 200,
  });
  let n = 0;
  for (const c of candidatas) {
    const r = await prisma.reserva.updateMany({
      where: { id: c.id, estado: "CONFIRMADA" },
      data: { estado: "EN_CURSO" },
    });
    if (r.count > 0) {
      await prisma.historialReserva.create({ data: { reservaId: c.id, evento: "EN_CURSO" } });
      n++;
    }
  }
  return n;
}

/**
 * Finaliza reservas cuyo horario terminó. Idempotente; CONFIRMADA/EN_CURSO → FINALIZADA.
 * (CONFIRMADA se conserva como red de seguridad por si la transición a EN_CURSO no corrió.)
 */
export async function finalizarVencidas(): Promise<number> {
  const ahoraDate = new Date();
  const candidatas = await prisma.reserva.findMany({
    where: { estado: { in: ["CONFIRMADA", "EN_CURSO"] }, terminaAt: { lt: ahoraDate } },
    select: { id: true },
    take: 200,
  });
  let n = 0;
  for (const c of candidatas) {
    const r = await prisma.reserva.updateMany({
      where: { id: c.id, estado: { in: ["CONFIRMADA", "EN_CURSO"] } },
      data: { estado: "FINALIZADA", finalizadaAt: ahoraDate },
    });
    if (r.count > 0) {
      await prisma.historialReserva.create({ data: { reservaId: c.id, evento: "FINALIZADA" } });
      // Solo se cierra el registro aún PROGRAMADO: el ABIERTO sigue vigente
      // hasta su fechaCierre (fin del curso + margen configurado).
      await prisma.registroQrFormacion.updateMany({
        where: { reservaId: c.id, estado: "PROGRAMADO" },
        data: { estado: "CERRADO" },
      });
      n++;
    }
  }
  // Barrido: cierra registros cuya ventana ya venció (fin + asistencia_cierre_minutos)
  await prisma.registroQrFormacion.updateMany({
    where: { estado: "ABIERTO", fechaCierre: { lt: ahoraDate } },
    data: { estado: "CERRADO" },
  });
  return n;
}

/**
 * Ciclo de vida completo según el horario: CONFIRMADA → EN_CURSO → FINALIZADA.
 * Lo corre el job y también los listados para reflejar el estado en tiempo real.
 */
export async function sincronizarEstadosReservas(): Promise<number> {
  return (await iniciarVigentes()) + (await finalizarVencidas());
}

/** Consulta del token de cancelación: datos mínimos para mostrar antes de confirmar. */
export async function vistaPreviaCancelacion(token: string) {
  const t = await prisma.tokenSeguro.findUnique({
    where: { hash: hashToken(token) },
    include: { reserva: { include: { curso: true, formador: { include: { cuenta: true } } } } },
  });
  if (!t || t.tipo !== "CANCELACION_RESERVA" || !t.reserva) throw badRequest("Enlace inválido");
  const r = t.reserva;
  const limiteHoras = await obtenerConfigNum("cancelacion_min_horas");
  return {
    curso: r.curso.nombre,
    fecha: aBogota(r.iniciaAt).toFormat("dd/MM/yyyy"),
    horaInicio: aBogota(r.iniciaAt).toFormat("HH:mm"),
    horaFin: aBogota(r.terminaAt).toFormat("HH:mm"),
    estado: r.estado,
    usado: Boolean(t.usadoAt),
    puedeCancelar: r.estado === "CONFIRMADA" && !t.usadoAt && ahora() < aBogota(r.iniciaAt).minus({ hours: limiteHoras }),
    limiteHoras,
  };
}
