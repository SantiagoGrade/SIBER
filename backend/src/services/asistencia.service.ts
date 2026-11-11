import { prisma } from "../repositories/prisma";
import { badRequest, conflict } from "../utils/errors";
import { resolverTokenQr } from "./qr.service";

export interface RegistroAsistenciaInput {
  token: string;
  nombreCompleto: string;
  documento: string;
  correo: string;
  programaAcademicoId: string;
  evaluacion: {
    contenidoObjetivo: number;
    metodologiaAdecuada: number;
    dominioTema: number;
    coherenciaExposicion: number;
    calificacionGeneral: number;
    observaciones?: string;
  };
}

function validarCalificacion(v: number, campo: string) {
  if (!Number.isInteger(v) || v < 1 || v > 5) {
    throw badRequest(`${campo} debe ser un entero entre 1 y 5`);
  }
}

/**
 * Registro combinado de asistencia + evaluación en un único flujo.
 * Reglas: una asistencia y una evaluación por documento por formación;
 * el QR debe estar vigente; validación completa en backend.
 */
export async function registrarAsistenciaYEvaluacion(input: RegistroAsistenciaInput, ip?: string) {
  const estado = await resolverTokenQr(input.token, ip);
  if (!estado.ok) throw badRequest("Enlace inválido");

  const programa = await prisma.programaAcademico.findUnique({ where: { id: input.programaAcademicoId } });
  if (!programa || !programa.activo) throw badRequest("Programa académico inválido");

  const ev = input.evaluacion;
  validarCalificacion(ev.contenidoObjetivo, "La calificación del contenido");
  validarCalificacion(ev.metodologiaAdecuada, "La calificación de la metodología");
  validarCalificacion(ev.dominioTema, "La calificación del dominio del tema");
  validarCalificacion(ev.coherenciaExposicion, "La calificación de la coherencia");
  validarCalificacion(ev.calificacionGeneral, "La calificación general");

  const documento = input.documento.trim();
  if (!documento) throw badRequest("Documento requerido");
  const correo = input.correo.trim().toLowerCase();

  try {
    return await prisma.$transaction(async (tx) => {
      const existente = await tx.asistencia.findUnique({
        where: { reservaId_documento: { reservaId: estado.reservaId, documento } },
        include: { evaluacion: true },
      });
      if (existente) {
        throw conflict("Ya existe un registro con este documento para esta formación");
      }

      const reserva = await tx.reserva.findUniqueOrThrow({
        where: { id: estado.reservaId },
        select: { docenteCorreo: true },
      });
      const esDocente = correo === reserva.docenteCorreo.trim().toLowerCase();

      const asistencia = await tx.asistencia.create({
        data: {
          reservaId: estado.reservaId,
          nombreCompleto: input.nombreCompleto.trim(),
          documento,
          correo,
          programaAcademicoId: input.programaAcademicoId,
          esDocente,
        },
      });
      await tx.evaluacionFormacion.create({
        data: {
          reservaId: estado.reservaId,
          asistenciaId: asistencia.id,
          contenidoObjetivo: ev.contenidoObjetivo,
          metodologiaAdecuada: ev.metodologiaAdecuada,
          dominioTema: ev.dominioTema,
          coherenciaExposicion: ev.coherenciaExposicion,
          calificacionGeneral: ev.calificacionGeneral,
          observaciones: ev.observaciones?.trim() || null,
        },
      });
      return { asistenciaId: asistencia.id };
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      throw conflict("Ya existe un registro con este documento para esta formación");
    }
    throw e;
  }
}

/** Lista de asistentes (admin o formador propietario — validado en el controller). */
export async function asistentesDe(reservaId: string) {
  const asistencias = await prisma.asistencia.findMany({
    where: { reservaId },
    include: { programa: true, evaluacion: true },
    orderBy: { fechaRegistro: "asc" },
  });
  return asistencias.map(a => ({
    id: a.id,
    nombreCompleto: a.nombreCompleto,
    documento: a.documento,
    correo: a.correo,
    programa: a.programa.nombre,
    esDocente: a.esDocente,
    fechaRegistro: a.fechaRegistro,
    evaluacion: a.evaluacion
      ? {
          contenidoObjetivo: a.evaluacion.contenidoObjetivo,
          metodologiaAdecuada: a.evaluacion.metodologiaAdecuada,
          dominioTema: a.evaluacion.dominioTema,
          coherenciaExposicion: a.evaluacion.coherenciaExposicion,
          calificacionGeneral: a.evaluacion.calificacionGeneral,
          observaciones: a.evaluacion.observaciones,
        }
      : null,
  }));
}
