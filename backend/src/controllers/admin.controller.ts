import { Request, Response } from "express";
import { ah } from "../middleware/asyncHandler";
import { prisma } from "../repositories/prisma";
import { crearCuenta, actualizarCuenta, desactivarCuenta, activarCuenta } from "../services/cuenta.service";
import {
  crearCurso, actualizarCurso, habilitarFormador, deshabilitarFormador,
  establecerDisponibilidad, crearExcepcion, eliminarExcepcion,
} from "../services/catalogos.service";
import { cancelarComoAdmin, sincronizarEstadosReservas } from "../services/reserva.service";
import {
  reemplazosPara, fechasAlternativas, aprobarReasignacion, rechazarReasignacion,
  marcarSinReemplazo, proponerNuevaFecha,
} from "../services/reasignacion.service";
import { estadisticasAdmin, FiltroEstadisticas } from "../services/estadisticas.service";
import { exportar } from "../services/export.service";
import { estadoQrReserva, cerrarRegistro, abrirRegistro } from "../services/qr.service";
import { guardarConfig, obtenerConfig } from "../services/configuracion.service";
import { forbidden, notFound, badRequest } from "../utils/errors";

// ── Cuentas ──

export const listarCuentas = ah(async (_req: Request, res: Response) => {
  const cuentas = await prisma.cuenta.findMany({
    select: {
      id: true, usuario: true, correo: true, rol: true, nombreCompleto: true,
      activo: true, createdAt: true,
      formador: { select: { id: true, cursos: { select: { curso: { select: { nombre: true } } } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(cuentas.map(c => ({
    ...c, formador: c.formador
      ? { id: c.formador.id, cursos: c.formador.cursos.map(fc => fc.curso.nombre) }
      : null,
  })));
});

export const crearCuentaCtrl = ah(async (req: Request, res: Response) => {
  // Solo SUPER_ADMIN puede crear otros SUPER_ADMIN o ADMIN
  if (["SUPER_ADMIN", "ADMIN"].includes(req.body.rol) && req.usuario!.rol !== "SUPER_ADMIN") {
    throw forbidden("Solo el Super Administrador puede crear administradores");
  }
  const cuenta = await crearCuenta(req.body, req.usuario!.cuentaId, req.ip);
  res.status(201).json({ id: cuenta.id });
});

export const actualizarCuentaCtrl = ah(async (req: Request, res: Response) => {
  const objetivo = await prisma.cuenta.findUniqueOrThrow({ where: { id: req.params.id } });
  const rolFinal = req.body.rol ?? objetivo.rol;
  // Solo SUPER_ADMIN gestiona administradores o asigna esos roles
  if (["SUPER_ADMIN", "ADMIN"].includes(objetivo.rol) || ["SUPER_ADMIN", "ADMIN"].includes(rolFinal)) {
    if (req.usuario!.rol !== "SUPER_ADMIN") throw forbidden("Solo el Super Administrador gestiona administradores");
  }
  if (req.params.id === req.usuario!.cuentaId && req.body.rol && req.body.rol !== req.usuario!.rol) {
    throw badRequest("No puedes cambiar tu propio rol");
  }
  res.json(await actualizarCuenta(req.params.id, req.body, req.usuario!.cuentaId, req.ip));
});

export const desactivarCuentaCtrl = ah(async (req: Request, res: Response) => {
  const objetivo = await prisma.cuenta.findUniqueOrThrow({ where: { id: req.params.id } });
  if (["SUPER_ADMIN", "ADMIN"].includes(objetivo.rol) && req.usuario!.rol !== "SUPER_ADMIN") {
    throw forbidden("Solo el Super Administrador gestiona administradores");
  }
  await desactivarCuenta(req.params.id, req.usuario!.cuentaId, req.ip);
  res.json({ ok: true });
});

export const activarCuentaCtrl = ah(async (req: Request, res: Response) => {
  const objetivo = await prisma.cuenta.findUniqueOrThrow({ where: { id: req.params.id } });
  if (["SUPER_ADMIN", "ADMIN"].includes(objetivo.rol) && req.usuario!.rol !== "SUPER_ADMIN") {
    throw forbidden("Solo el Super Administrador gestiona administradores");
  }
  await activarCuenta(req.params.id, req.usuario!.cuentaId, req.ip);
  res.json({ ok: true });
});

// ── Cursos ──

export const listarCursos = ah(async (_req: Request, res: Response) => {
  res.json(await prisma.curso.findMany({
    include: { formadores: { include: { formador: { include: { cuenta: { select: { nombreCompleto: true } } } } } } },
    orderBy: { nombre: "asc" },
  }));
});
export const crearCursoCtrl = ah(async (req: Request, res: Response) => {
  const c = await crearCurso(req.body.nombre, req.body.descripcion, req.usuario!.cuentaId);
  res.status(201).json(c);
});
export const actualizarCursoCtrl = ah(async (req: Request, res: Response) => {
  res.json(await actualizarCurso(req.params.id, req.body, req.usuario!.cuentaId));
});
export const habilitarCtrl = ah(async (req: Request, res: Response) => {
  await habilitarFormador(req.params.id, req.body.formadorId, req.usuario!.cuentaId);
  res.json({ ok: true });
});
export const deshabilitarCtrl = ah(async (req: Request, res: Response) => {
  await deshabilitarFormador(req.params.id, req.params.formadorId, req.usuario!.cuentaId);
  res.json({ ok: true });
});

// ── Formadores: disponibilidad y excepciones ──

export const disponibilidadDe = ah(async (req: Request, res: Response) => {
  res.json(await prisma.disponibilidadSemanal.findMany({
    where: { formadorId: req.params.id }, orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }],
  }));
});
export const establecerDisponibilidadCtrl = ah(async (req: Request, res: Response) => {
  await establecerDisponibilidad(req.params.id, req.body.franjas, req.usuario!.cuentaId);
  res.json({ ok: true });
});
export const excepcionesDe = ah(async (req: Request, res: Response) => {
  res.json(await prisma.excepcionDisponibilidad.findMany({
    where: { formadorId: req.params.id }, orderBy: { iniciaAt: "desc" },
  }));
});
export const crearExcepcionCtrl = ah(async (req: Request, res: Response) => {
  res.status(201).json(await crearExcepcion({ formadorId: req.params.id, ...req.body }, req.usuario!.cuentaId));
});
export const eliminarExcepcionCtrl = ah(async (req: Request, res: Response) => {
  await eliminarExcepcion(req.params.excepcionId, req.usuario!.cuentaId);
  res.json({ ok: true });
});


// ── Reservas ──

export const listarReservas = ah(async (req: Request, res: Response) => {
  const f = req.query as unknown as FiltroEstadisticas;
  // Refleja el ciclo de vida (CONFIRMADA → EN_CURSO → FINALIZADA) aunque el job no haya corrido aún
  await sincronizarEstadosReservas();
  const reservas = await prisma.reserva.findMany({
    where: {
      ...(f.estado ? { estado: f.estado } : {}),
      ...(f.cursoId ? { cursoId: f.cursoId } : {}),
      ...(f.formadorId ? { formadorId: f.formadorId } : {}),
      ...(f.codigo ? { codigo: { contains: f.codigo, mode: "insensitive" } } : {}),
      ...(f.desde || f.hasta ? { iniciaAt: { ...(f.desde ? { gte: f.desde } : {}), ...(f.hasta ? { lt: f.hasta } : {}) } } : {}),
    },
    include: {
      curso: true, facultad: true, programa: true,
      formador: { include: { cuenta: { select: { nombreCompleto: true, correo: true } } } },
      _count: { select: { asistencias: true } },
    },
    orderBy: { iniciaAt: f.orden ?? "desc" },
    take: 500,
  });
  res.json(reservas.map(r => ({
    id: r.id, codigo: r.codigo, curso: r.curso.nombre, cursoId: r.cursoId,
    formador: r.formador.cuenta.nombreCompleto, formadorId: r.formadorId,
    formadorCorreo: r.formador.cuenta.correo,
    docenteNombre: r.docenteNombre, docenteCorreo: r.docenteCorreo,
    docenteTelefono: r.docenteTelefono, aula: r.aula,
    facultad: r.facultad?.nombre ?? null,
    programa: r.programa?.nombre ?? null,
    iniciaAt: r.iniciaAt, terminaAt: r.terminaAt, estado: r.estado,
    incidenciaPendiente: r.incidenciaPendiente,
    asistentes: r._count.asistencias,
    createdAt: r.createdAt,
  })));
});

export const detalleReserva = ah(async (req: Request, res: Response) => {
  const r = await prisma.reserva.findUnique({
    where: { id: req.params.id },
    include: {
      curso: true, facultad: true, programa: true,
      formador: { include: { cuenta: true } },
      historial: { orderBy: { createdAt: "desc" } },
      qr: true,
    },
  });
  if (!r) throw notFound("Reserva no encontrada");
  res.json({
    ...r,
    formadorNombre: r.formador.cuenta.nombreCompleto,
    formadorCorreo: r.formador.cuenta.correo,
    qr: r.qr ? { estado: r.qr.estado, estadoEnvio: r.qr.estadoEnvio, fechaEnvioProgramado: r.qr.fechaEnvioProgramado, fechaEnvioReal: r.qr.fechaEnvioReal } : null,
  });
});

export const cancelarReservaAdmin = ah(async (req: Request, res: Response) => {
  await cancelarComoAdmin(req.params.id, req.body.motivo, req.usuario!.cuentaId, req.ip);
  res.json({ ok: true });
});

export const asistentesReserva = ah(async (req: Request, res: Response) => {
  const { asistentesDe } = await import("../services/asistencia.service");
  res.json(await asistentesDe(req.params.id));
});

export const qrDeReserva = ah(async (req: Request, res: Response) => {
  res.json(await estadoQrReserva(req.params.id));
});
export const cerrarQrCtrl = ah(async (req: Request, res: Response) => {
  await cerrarRegistro(req.params.id);
  res.json({ ok: true });
});
export const abrirQrCtrl = ah(async (req: Request, res: Response) => {
  await abrirRegistro(req.params.id);
  res.json({ ok: true });
});

// ── Reasignaciones ──

export const listarReasignaciones = ah(async (_req: Request, res: Response) => {
  const lista = await prisma.solicitudReasignacion.findMany({
    include: {
      reserva: { include: { curso: true } },
      solicitante: { include: { cuenta: { select: { nombreCompleto: true } } } },
      reemplazoSugerido: { include: { cuenta: { select: { nombreCompleto: true } } } },
      propuestas: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(lista.map(s => ({
    id: s.id, estado: s.estado, motivo: s.motivo, observacion: s.observacion,
    createdAt: s.createdAt,
    reserva: {
      id: s.reservaId, codigo: s.reserva.codigo, curso: s.reserva.curso.nombre,
      iniciaAt: s.reserva.iniciaAt, terminaAt: s.reserva.terminaAt, estado: s.reserva.estado,
      docenteNombre: s.reserva.docenteNombre,
    },
    solicitante: s.solicitante.cuenta.nombreCompleto,
    reemplazoSugerido: s.reemplazoSugerido?.cuenta.nombreCompleto ?? null,
    propuestas: s.propuestas,
  })));
});

export const reemplazosCtrl = ah(async (req: Request, res: Response) => {
  res.json(await reemplazosPara(req.params.id));
});
export const alternativasCtrl = ah(async (req: Request, res: Response) => {
  const dias = Math.min(Number(req.query.dias) || 14, 30);
  const fechas = await fechasAlternativas(req.params.id, dias);
  res.json(fechas.map(f => ({ inicio: f.inicio.toISO(), fin: f.fin.toISO() })));
});
export const aprobarCtrl = ah(async (req: Request, res: Response) => {
  await aprobarReasignacion(req.params.id, req.body.formadorId, req.usuario!.cuentaId, req.ip);
  res.json({ ok: true });
});
export const rechazarCtrl = ah(async (req: Request, res: Response) => {
  await rechazarReasignacion(req.params.id, req.body.motivo, req.usuario!.cuentaId, req.ip);
  res.json({ ok: true });
});
export const sinReemplazoCtrl = ah(async (req: Request, res: Response) => {
  await marcarSinReemplazo(req.params.id, req.usuario!.cuentaId);
  res.json({ ok: true });
});
export const proponerFechaCtrl = ah(async (req: Request, res: Response) => {
  res.json(await proponerNuevaFecha(req.params.id, req.body.iniciaAt, req.body.terminaAt, req.usuario!.cuentaId, req.ip));
});

// ── Estadísticas, exportación, config ──

export const statsAdmin = ah(async (req: Request, res: Response) => {
  res.json(await estadisticasAdmin(req.query as unknown as FiltroEstadisticas));
});

export const exportarCtrl = ah(async (req: Request, res: Response) => {
  const tipo = req.params.tipo as "reservas" | "estadisticas" | "asistencia";
  if (!["reservas", "estadisticas", "asistencia"].includes(tipo)) throw badRequest("Tipo inválido");
  const buffer = await exportar(tipo, req.query as unknown as FiltroEstadisticas, req.query.reservaId as string | undefined);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="siber-${tipo}-${new Date().toISOString().slice(0, 10)}.xlsx"`);
  res.send(Buffer.from(buffer as ArrayBuffer));
});

export const leerConfig = ah(async (req: Request, res: Response) => {
  res.json({ clave: req.params.clave, valor: await obtenerConfig(req.params.clave) });
});
export const escribirConfig = ah(async (req: Request, res: Response) => {
  await guardarConfig(req.body.clave, req.body.valor);
  res.json({ ok: true });
});

export const formadoresLista = ah(async (_req: Request, res: Response) => {
  const formadores = await prisma.formador.findMany({
    include: {
      cuenta: { select: { nombreCompleto: true, correo: true, activo: true, id: true } },
      cursos: { include: { curso: true } },
    },
  });
  res.json(formadores.map(f => ({
    id: f.id, cuentaId: f.cuentaId,
    nombre: f.cuenta.nombreCompleto, correo: f.cuenta.correo, activo: f.cuenta.activo,
    cursos: f.cursos.map(c => ({ id: c.cursoId, nombre: c.curso.nombre })),
  })));
});
