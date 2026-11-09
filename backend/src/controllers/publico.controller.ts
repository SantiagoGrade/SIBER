import { Request, Response } from "express";
import { ah } from "../middleware/asyncHandler";
import { prisma } from "../repositories/prisma";
import { crearReserva, cancelarConToken, vistaPreviaCancelacion } from "../services/reserva.service";
import { vistaPreviaPropuesta, aceptarPropuesta, rechazarPropuesta } from "../services/reasignacion.service";
import { resolverTokenQr } from "../services/qr.service";
import { registrarAsistenciaYEvaluacion } from "../services/asistencia.service";
import { franjasUnion, reservasUnion } from "../services/disponibilidad.service";
import { restarIntervalos } from "../utils/disponibilidad";
import { aBogota } from "../utils/tiempo";
import { badRequest } from "../utils/errors";
import { obtenerConfigNum } from "../services/configuracion.service";

/** Catálogos públicos */
export const cursosActivos = ah(async (_req: Request, res: Response) => {
  const cursos = await prisma.curso.findMany({
    where: { activo: true }, select: { id: true, nombre: true, descripcion: true },
    orderBy: { nombre: "asc" },
  });
  res.json(cursos);
});

export const facultadesActivas = ah(async (_req: Request, res: Response) => {
  res.json(await prisma.facultad.findMany({
    where: { activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" },
  }));
});

export const programasActivos = ah(async (_req: Request, res: Response) => {
  res.json(await prisma.programaAcademico.findMany({
    where: { activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" },
  }));
});


/**
 * Disponibilidad pública: unión de franjas efectivas de los formadores
 * habilitados del curso (`libres`) y tramos ya ocupados por reservas que
 * ningún otro formador cubre (`ocupados`). No revela formadores, docentes
 * ni motivos.
 */
export const disponibilidadPublica = ah(async (req: Request, res: Response) => {
  const { cursoId, desde, hasta } = req.query as unknown as { cursoId: string; desde: Date; hasta: Date };
  const curso = await prisma.curso.findUnique({
    where: { id: cursoId },
    include: { formadores: { include: { formador: { include: { cuenta: true } } } } },
  });
  if (!curso || !curso.activo) throw badRequest("Curso inválido");

  const ids = curso.formadores.filter(fc => fc.formador.cuenta.activo).map(fc => fc.formadorId);
  const inicio = aBogota(desde);
  const fin = aBogota(hasta);
  if (fin <= inicio || fin.diff(inicio, "days").days > 62) {
    throw badRequest("Rango de consulta inválido (máx. 62 días)");
  }
  const [libres, ocupadosBrutos, anticipacionMinimaDias] = await Promise.all([
    franjasUnion(prisma, ids, inicio, fin),
    reservasUnion(prisma, ids, inicio, fin),
    obtenerConfigNum("anticipacion_minima_dias"),
  ]);
  const ocupados = restarIntervalos(ocupadosBrutos, libres);
  res.json({
    libres: libres.map(f => ({ inicio: f.inicio.toISO(), fin: f.fin.toISO() })),
    ocupados: ocupados.map(f => ({ inicio: f.inicio.toISO(), fin: f.fin.toISO() })),
    anticipacionMinimaDias,
  });
});

/** Creación de reserva por el docente (pública, sin login). */
export const crearReservaPublica = ah(async (req: Request, res: Response) => {
  const { idempotencyKey, ...input } = req.body;
  const resultado = await crearReserva(input, idempotencyKey, req.ip);
  const r = resultado.reserva as { codigo: string; iniciaAt: Date; terminaAt: Date };
  res.status(resultado.duplicada ? 200 : 201).json({
    codigo: r.codigo,
    iniciaAt: r.iniciaAt,
    terminaAt: r.terminaAt,
    mensaje: "Reserva confirmada. Recibirás un correo con los detalles.",
  });
});

/** Cancelación pública */
export const previaCancelacion = ah(async (req: Request, res: Response) => {
  res.json(await vistaPreviaCancelacion(req.query.token as string));
});
export const ejecutarCancelacion = ah(async (req: Request, res: Response) => {
  await cancelarConToken(req.body.token, req.ip);
  res.json({ ok: true, mensaje: "Reserva cancelada" });
});

/** Propuesta de nueva fecha */
export const previaPropuesta = ah(async (req: Request, res: Response) => {
  res.json(await vistaPreviaPropuesta(req.query.token as string));
});
export const responderPropuesta = ah(async (req: Request, res: Response) => {
  if (req.body.aceptar) await aceptarPropuesta(req.body.token, req.ip);
  else await rechazarPropuesta(req.body.token, req.ip);
  res.json({ ok: true });
});

/** QR de asistencia: resolución y envío del formulario */
export const resolverQr = ah(async (req: Request, res: Response) => {
  const estado = await resolverTokenQr(req.params.token, req.ip);
  res.json(estado);
});
export const enviarAsistencia = ah(async (req: Request, res: Response) => {
  const { nombreCompleto, documento, correo, programaAcademicoId, evaluacion } = req.body;
  const r = await registrarAsistenciaYEvaluacion({
    token: req.params.token,
    nombreCompleto, documento, correo, programaAcademicoId,
    evaluacion,
  }, req.ip);
  res.status(201).json({ ok: true, asistenciaId: r.asistenciaId, mensaje: "Asistencia y evaluación registradas" });
});
