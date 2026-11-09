import { prisma } from "../repositories/prisma";
import { aBogota } from "../utils/tiempo";
import { cargaSemanal } from "./disponibilidad.service";

export interface FiltroEstadisticas {
  desde?: Date;
  hasta?: Date;
  cursoId?: string;
  formadorId?: string;
  facultadId?: string;
  estado?: "CONFIRMADA" | "FINALIZADA" | "CANCELADA";
  mes?: number;       // 1-12
  semestre?: 1 | 2;   // 1 = ene-jun, 2 = jul-dic
  anio?: number;
}

function whereReserva(f: FiltroEstadisticas) {
  let desde = f.desde;
  let hasta = f.hasta;
  if (f.anio) {
    if (f.mes) {
      desde = new Date(Date.UTC(f.anio, f.mes - 1, 1));
      hasta = new Date(Date.UTC(f.anio, f.mes, 1));
    } else if (f.semestre) {
      const m0 = f.semestre === 1 ? 0 : 6;
      desde = new Date(Date.UTC(f.anio, m0, 1));
      hasta = new Date(Date.UTC(f.anio, m0 + 6, 1));
    } else {
      desde = new Date(Date.UTC(f.anio, 0, 1));
      hasta = new Date(Date.UTC(f.anio + 1, 0, 1));
    }
  }
  return {
    ...(desde || hasta ? { iniciaAt: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lt: hasta } : {}) } } : {}),
    ...(f.cursoId ? { cursoId: f.cursoId } : {}),
    ...(f.formadorId ? { formadorId: f.formadorId } : {}),
    ...(f.facultadId ? { facultadId: f.facultadId } : {}),
    ...(f.estado ? { estado: f.estado } : {}),
  };
}

function promedio(nums: number[]): { promedio: number | null; respuestas: number } {
  if (!nums.length) return { promedio: null, respuestas: 0 };
  return { promedio: Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100, respuestas: nums.length };
}

/** Dashboard global (Administrador / Super Administrador). */
export async function estadisticasAdmin(f: FiltroEstadisticas) {
  const where = whereReserva(f);
  const [porEstado, reservas] = await Promise.all([
    prisma.reserva.groupBy({ by: ["estado"], where, _count: true }),
    prisma.reserva.findMany({
      where,
      select: {
        id: true, cursoId: true, formadorId: true, facultadId: true,
        iniciaAt: true, terminaAt: true, estado: true,
        curso: { select: { nombre: true } },
        formador: { select: { cuenta: { select: { nombreCompleto: true } } } },
      },
    }),
  ]);

  const idsValidas = reservas.filter(r => r.estado !== "CANCELADA").map(r => r.id);
  const evaluaciones = await prisma.evaluacionFormacion.findMany({
    where: { reservaId: { in: idsValidas } },
    include: { reserva: { select: { cursoId: true, formadorId: true, iniciaAt: true, curso: { select: { nombre: true } }, formador: { select: { cuenta: { select: { nombreCompleto: true } } } } } } },
  });
  const asistencias = await prisma.asistencia.count({ where: { reservaId: { in: idsValidas } } });

  const conteo = Object.fromEntries(porEstado.map(p => [p.estado, p._count]));
  const ahoraDate = new Date();
  const proximas = reservas.filter(r => r.estado === "CONFIRMADA" && r.iniciaAt > ahoraDate).length;
  const pendientesReasig = await prisma.solicitudReasignacion.count({
    where: { estado: { in: ["PENDIENTE", "SIN_REEMPLAZO", "PENDIENTE_RESPUESTA_DOCENTE"] } },
  });

  const minutosImpartidos = reservas
    .filter(r => r.estado === "FINALIZADA")
    .reduce((acc, r) => acc + (r.terminaAt.getTime() - r.iniciaAt.getTime()) / 60000, 0);

  // Carga laboral por formador (horas de reservas no canceladas en el filtro)
  const cargaPorFormador = new Map<string, { nombre: string; minutos: number; reservas: number }>();
  const demandaPorCurso = new Map<string, { nombre: string; reservas: number }>();
  for (const r of reservas) {
    if (r.estado === "CANCELADA") continue;
    const nombre = r.formador.cuenta.nombreCompleto;
    const cf = cargaPorFormador.get(r.formadorId) ?? { nombre, minutos: 0, reservas: 0 };
    cf.minutos += (r.terminaAt.getTime() - r.iniciaAt.getTime()) / 60000;
    cf.reservas += 1;
    cargaPorFormador.set(r.formadorId, cf);
    const cc = demandaPorCurso.get(r.cursoId) ?? { nombre: r.curso.nombre, reservas: 0 };
    cc.reservas += 1;
    demandaPorCurso.set(r.cursoId, cc);
  }

  // Evaluaciones
  const calGen = evaluaciones.map(e => e.calificacionGeneral);

  // Por curso y por formador (promedios)
  const porCurso = new Map<string, { nombre: string; vals: number[]; n: number }>();
  const porFormador = new Map<string, { nombre: string; vals: number[]; n: number }>();
  for (const e of evaluaciones) {
    const cid = e.reserva.cursoId;
    const pc = porCurso.get(cid) ?? { nombre: e.reserva.curso.nombre, vals: [], n: 0 };
    pc.vals.push(e.calificacionGeneral); pc.n++;
    porCurso.set(cid, pc);
    const fid = e.reserva.formadorId;
    const pf = porFormador.get(fid) ?? { nombre: e.reserva.formador.cuenta.nombreCompleto, vals: [], n: 0 };
    pf.vals.push(e.calificacionGeneral); pf.n++;
    porFormador.set(fid, pf);
  }

  // Evolución de satisfacción por mes (YYYY-MM)
  const evolucion = new Map<string, number[]>();
  for (const e of evaluaciones) {
    const mes = aBogota(e.fechaRegistro).toFormat("yyyy-MM");
    evolucion.set(mes, [...(evolucion.get(mes) ?? []), e.calificacionGeneral]);
  }

  // Distribución 1-5
  const distribucion = [1, 2, 3, 4, 5].map(v => ({
    estrellas: v,
    cantidad: calGen.filter(c => c === v).length,
  }));

  const comentarios = evaluaciones
    .filter(e => e.observaciones)
    .map(e => ({
      curso: e.reserva.curso.nombre,
      formador: e.reserva.formador.cuenta.nombreCompleto,
      fecha: e.fechaRegistro,
      observaciones: e.observaciones,
      calificacion: e.calificacionGeneral,
    }));

  const sinEvaluaciones = reservas.filter(
    r => r.estado === "FINALIZADA" && !evaluaciones.some(e => e.reservaId === r.id)
  ).length;

  return {
    reservas: {
      solicitadas: reservas.length,
      confirmadas: conteo["CONFIRMADA"] ?? 0,
      finalizadas: conteo["FINALIZADA"] ?? 0,
      canceladas: conteo["CANCELADA"] ?? 0,
      proximas,
    },
    reasignacionesPendientes: pendientesReasig,
    totalAsistentes: asistencias,
    horasImpartidas: Math.round(minutosImpartidos / 60 * 10) / 10,
    cargaPorFormador: [...cargaPorFormador.entries()].map(([id, v]) => ({
      formadorId: id, ...v, horas: Math.round(v.minutos / 60 * 10) / 10,
    })),
    cursosMasSolicitados: [...demandaPorCurso.entries()]
      .map(([id, v]) => ({ cursoId: id, ...v }))
      .sort((a, b) => b.reservas - a.reservas),
    satisfaccion: {
      calificacionGeneral: promedio(calGen),
      totalEvaluaciones: evaluaciones.length,
      tasaRespuesta: asistencias ? Math.round((evaluaciones.length / asistencias) * 1000) / 10 : null,
      porCurso: [...porCurso.entries()].map(([id, v]) => ({ cursoId: id, nombre: v.nombre, ...promedio(v.vals) })),
      porFormador: [...porFormador.entries()].map(([id, v]) => ({ formadorId: id, nombre: v.nombre, ...promedio(v.vals) })),
      evolucion: [...evolucion.entries()].sort().map(([mes, vals]) => ({ mes, ...promedio(vals) })),
      distribucion,
      comentarios,
      finalizadasSinEvaluacion: sinEvaluaciones,
    },
  };
}

/** Dashboard personal del formador. */
export async function estadisticasFormador(formadorId: string, f: FiltroEstadisticas) {
  const base = await estadisticasAdmin({ ...f, formadorId });
  const ahora = new Date();

  const reservas = await prisma.reserva.findMany({
    where: { formadorId, estado: { not: "CANCELADA" }, iniciaAt: { gte: ahora } },
    include: { curso: true },
    orderBy: { iniciaAt: "asc" },
    take: 10,
  });

  const carga = await cargaSemanal(prisma, formadorId, aBogota(ahora));
  const reasignaciones = await prisma.solicitudReasignacion.count({
    where: { formadorSolicitanteId: formadorId, estado: { in: ["PENDIENTE", "SIN_REEMPLAZO", "PENDIENTE_RESPUESTA_DOCENTE"] } },
  });

  const impartidas = await prisma.reserva.count({
    where: { formadorId, estado: "FINALIZADA" },
  });

  // Evolución de calificaciones del formador por mes
  const evaluaciones = await prisma.evaluacionFormacion.findMany({
    where: { reserva: { formadorId, estado: { not: "CANCELADA" } } },
    orderBy: { fechaRegistro: "asc" },
    include: { reserva: { select: { curso: { select: { nombre: true } } } } },
  });
  const evol = new Map<string, number[]>();
  const porCurso = new Map<string, number[]>();
  const asistPorReserva = await prisma.asistencia.groupBy({
    by: ["reservaId"], where: { reserva: { formadorId } }, _count: true,
  });

  for (const e of evaluaciones) {
    const mes = aBogota(e.fechaRegistro).toFormat("yyyy-MM");
    evol.set(mes, [...(evol.get(mes) ?? []), e.calificacionGeneral]);
    const curso = e.reserva.curso.nombre;
    porCurso.set(curso, [...(porCurso.get(curso) ?? []), e.calificacionGeneral]);
  }

  return {
    ...base,
    proximas: reservas.map(r => ({
      id: r.id, codigo: r.codigo, curso: r.curso.nombre,
      iniciaAt: r.iniciaAt, terminaAt: r.terminaAt,
      docenteNombre: r.docenteNombre, estado: r.estado,
      incidenciaPendiente: r.incidenciaPendiente,
    })),
    horasEstaSemana: Math.round(carga.minutosOcupados / 60 * 10) / 10,
    horasDisponiblesSemana: Math.round(carga.minutosDisponibles / 60 * 10) / 10,
    ocupacionSemana: carga.ocupacion === Infinity ? null : Math.round(carga.ocupacion * 10) / 10,
    reasignacionesPendientesPropias: reasignaciones,
    formacionesImpartidas: impartidas,
    evolucionCalificaciones: [...evol.entries()].sort().map(([mes, vals]) => ({ mes, ...promedio(vals) })),
    comparacionCursos: [...porCurso.entries()].map(([curso, vals]) => ({ curso, ...promedio(vals) })),
    asistenciaPorFormacion: asistPorReserva.map(a => ({ reservaId: a.reservaId, asistentes: a._count })),
  };
}
