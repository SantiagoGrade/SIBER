import { Request, Response } from "express";
import { ah } from "../middleware/asyncHandler";
import { prisma } from "../repositories/prisma";
import { forbidden, notFound } from "../utils/errors";
import { solicitarReasignacion } from "../services/reasignacion.service";
import { sincronizarEstadosReservas } from "../services/reserva.service";
import { estadisticasFormador, FiltroEstadisticas } from "../services/estadisticas.service";
import { franjasEfectivas } from "../services/disponibilidad.service";
import { aBogota } from "../utils/tiempo";
import { asistentesDe } from "../services/asistencia.service";
import { exportar } from "../services/export.service";

function formadorIdDe(req: Request): string {
  const fid = req.usuario?.formadorId;
  if (!fid) throw forbidden("La cuenta no tiene perfil de formador");
  return fid;
}

/** Calendario del formador: reservas + disponibilidad efectiva + excepciones */
export const miCalendario = ah(async (req: Request, res: Response) => {
  const fid = formadorIdDe(req);
  await sincronizarEstadosReservas();
  const desde = aBogota(new Date(req.query.desde as string));
  const hasta = aBogota(new Date(req.query.hasta as string));

  const [reservas, efectivas, excepciones] = await Promise.all([
    prisma.reserva.findMany({
      where: { formadorId: fid, iniciaAt: { lt: hasta.toJSDate() }, terminaAt: { gt: desde.toJSDate() } },
      include: { curso: true, facultad: true, _count: { select: { asistencias: true } } },
      orderBy: { iniciaAt: "asc" },
    }),
    franjasEfectivas(prisma, fid, desde, hasta),
    prisma.excepcionDisponibilidad.findMany({
      where: { formadorId: fid, iniciaAt: { lt: hasta.toJSDate() }, terminaAt: { gt: desde.toJSDate() } },
    }),
  ]);

  res.json({
    reservas: reservas.map(r => ({
      id: r.id, codigo: r.codigo, curso: r.curso.nombre,
      iniciaAt: r.iniciaAt, terminaAt: r.terminaAt, estado: r.estado,
      docenteNombre: r.docenteNombre, docenteCorreo: r.docenteCorreo,
      docenteTelefono: r.docenteTelefono, aula: r.aula,
      facultad: r.facultad?.nombre ?? null,
      asistentes: r._count.asistencias,
      incidenciaPendiente: r.incidenciaPendiente,
    })),
    disponible: efectivas.map(f => ({ inicio: f.inicio.toISO(), fin: f.fin.toISO() })),
    excepciones: excepciones.map(e => ({
      id: e.id, tipo: e.tipo, iniciaAt: e.iniciaAt, terminaAt: e.terminaAt, motivo: e.motivo,
    })),
  });
});

export const misReservas = ah(async (req: Request, res: Response) => {
  const fid = formadorIdDe(req);
  await sincronizarEstadosReservas();
  const f = req.query as unknown as FiltroEstadisticas;
  const reservas = await prisma.reserva.findMany({
    where: {
      formadorId: fid,
      ...(f.estado ? { estado: f.estado } : {}),
      ...(f.cursoId ? { cursoId: f.cursoId } : {}),
      ...(f.desde || f.hasta ? { iniciaAt: { ...(f.desde ? { gte: f.desde } : {}), ...(f.hasta ? { lt: f.hasta } : {}) } } : {}),
    },
    include: { curso: true, _count: { select: { asistencias: true } } },
    orderBy: { iniciaAt: f.orden ?? "desc" },
    take: 500,
  });
  res.json(reservas.map(r => ({
    id: r.id, codigo: r.codigo, curso: r.curso.nombre,
    iniciaAt: r.iniciaAt, terminaAt: r.terminaAt, estado: r.estado,
    docenteNombre: r.docenteNombre, docenteCorreo: r.docenteCorreo,
    docenteTelefono: r.docenteTelefono, aula: r.aula,
    incidenciaPendiente: r.incidenciaPendiente, asistentes: r._count.asistencias,
  })));
});

export const miDisponibilidad = ah(async (req: Request, res: Response) => {
  const fid = formadorIdDe(req);
  const [semanal, excepciones] = await Promise.all([
    prisma.disponibilidadSemanal.findMany({
      where: { formadorId: fid }, orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }],
    }),
    prisma.excepcionDisponibilidad.findMany({
      where: { formadorId: fid, terminaAt: { gt: new Date() } }, orderBy: { iniciaAt: "asc" },
    }),
  ]);
  res.json({ semanal, excepciones });
});

export const miDashboard = ah(async (req: Request, res: Response) => {
  const fid = formadorIdDe(req);
  res.json(await estadisticasFormador(fid, req.query as unknown as FiltroEstadisticas));
});

export const solicitarReasignacionCtrl = ah(async (req: Request, res: Response) => {
  const fid = formadorIdDe(req);
  const s = await solicitarReasignacion(
    fid, req.body.reservaId, req.body.motivo, req.body.observacion,
    req.usuario!.cuentaId, req.ip
  );
  res.status(201).json({ id: s.id });
});

export const misReasignaciones = ah(async (req: Request, res: Response) => {
  const fid = formadorIdDe(req);
  const lista = await prisma.solicitudReasignacion.findMany({
    where: { formadorSolicitanteId: fid },
    include: { reserva: { include: { curso: true } }, propuestas: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(lista.map(s => ({
    id: s.id, estado: s.estado, motivo: s.motivo, createdAt: s.createdAt,
    reserva: {
      codigo: s.reserva.codigo, curso: s.reserva.curso.nombre,
      iniciaAt: s.reserva.iniciaAt, terminaAt: s.reserva.terminaAt,
    },
    propuestas: s.propuestas,
  })));
});

async function verificarPropiedad(req: Request): Promise<string> {
  const fid = formadorIdDe(req);
  const r = await prisma.reserva.findUnique({ where: { id: req.params.id } });
  if (!r) throw notFound("Reserva no encontrada");
  if (r.formadorId !== fid && !["ADMIN", "SUPER_ADMIN"].includes(req.usuario!.rol)) {
    throw forbidden("La reserva no te pertenece");
  }
  return r.id;
}

export const asistentesMios = ah(async (req: Request, res: Response) => {
  await verificarPropiedad(req);
  res.json(await asistentesDe(req.params.id));
});

export const exportarAsistenciaMia = ah(async (req: Request, res: Response) => {
  await verificarPropiedad(req);
  const buffer = await exportar("asistencia", {}, req.params.id);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="sifoin-asistencia-${new Date().toISOString().slice(0, 10)}.xlsx"`);
  res.send(Buffer.from(buffer as ArrayBuffer));
});
