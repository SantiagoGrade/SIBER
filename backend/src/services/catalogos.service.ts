import { prisma } from "../repositories/prisma";
import { badRequest, conflict, notFound } from "../utils/errors";
import { TipoExcepcion } from "@prisma/client";

// ── Cursos ──

export async function crearCurso(nombre: string, descripcion: string | undefined, actorCuentaId: string) {
  try {
    return await prisma.curso.create({ data: { nombre: nombre.trim(), descripcion: descripcion ?? null } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw conflict("Ya existe un curso con ese nombre");
    throw e;
  }
}

export async function actualizarCurso(id: string, data: { nombre?: string; descripcion?: string; activo?: boolean }, actorCuentaId: string) {
  const curso = await prisma.curso.update({ where: { id }, data });
  return curso;
}

export async function habilitarFormador(cursoId: string, formadorId: string, actorCuentaId: string) {
  const [curso, formador] = await Promise.all([
    prisma.curso.findUnique({ where: { id: cursoId } }),
    prisma.formador.findUnique({ where: { id: formadorId }, include: { cuenta: true } }),
  ]);
  if (!curso) throw notFound("Curso no encontrado");
  if (!formador || !formador.cuenta.activo) throw badRequest("Formador inválido o inactivo");
  await prisma.formadorCurso.upsert({
    where: { formadorId_cursoId: { formadorId, cursoId } },
    create: { formadorId, cursoId },
    update: {},
  });
}

export async function deshabilitarFormador(cursoId: string, formadorId: string, actorCuentaId: string) {
  const futuras = await prisma.reserva.count({
    where: { cursoId, formadorId, estado: { in: ["CONFIRMADA", "EN_CURSO"] }, terminaAt: { gt: new Date() } },
  });
  if (futuras > 0) {
    throw conflict(`El formador tiene ${futuras} reservas vigentes de este curso`);
  }
  await prisma.formadorCurso.delete({
    where: { formadorId_cursoId: { formadorId, cursoId } },
  }).catch(() => {});
}

// ── Disponibilidad semanal ──

export interface FranjaInput { diaSemana: number; horaInicio: number; horaFin: number }

export function validarFranjas(franjas: FranjaInput[]) {
  for (const f of franjas) {
    if (f.diaSemana < 1 || f.diaSemana > 7) throw badRequest("diaSemana debe ser 1..7");
    if (f.horaInicio < 0 || f.horaFin > 1440 || f.horaInicio >= f.horaFin) {
      throw badRequest("Franja horaria inválida");
    }
  }
  const porDia = new Map<number, FranjaInput[]>();
  for (const f of franjas) {
    const arr = porDia.get(f.diaSemana) ?? [];
    arr.push(f);
    porDia.set(f.diaSemana, arr);
  }
  for (const [, arr] of porDia) {
    arr.sort((a, b) => a.horaInicio - b.horaInicio);
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].horaInicio < arr[i - 1].horaFin) {
        throw badRequest("Hay franjas superpuestas dentro del mismo día");
      }
    }
  }
}

/**
 * Reemplaza la disponibilidad semanal del formador.
 * Rechaza si quita cobertura a reservas confirmadas futuras (debe resolverse antes).
 */
export async function establecerDisponibilidad(formadorId: string, franjas: FranjaInput[], actorCuentaId: string) {
  validarFranjas(franjas);

  // Verificar reservas futuras que perderían cobertura
  const reservasFuturas = await prisma.reserva.findMany({
    where: { formadorId, estado: { in: ["CONFIRMADA", "EN_CURSO"] }, terminaAt: { gt: new Date() } },
    select: { id: true, codigo: true, iniciaAt: true, terminaAt: true },
  });
  const afectadas: string[] = [];
  for (const r of reservasFuturas) {
    // Calcular día de semana y minutos en Bogotá
    const bog = new Date(new Date(r.iniciaAt).toLocaleString("en-US", { timeZone: "America/Bogota" }));
    const diaSem = bog.getDay() === 0 ? 7 : bog.getDay();
    const minIni = bog.getHours() * 60 + bog.getMinutes();
    const bogFin = new Date(new Date(r.terminaAt).toLocaleString("en-US", { timeZone: "America/Bogota" }));
    const minFin = bogFin.getHours() * 60 + bogFin.getMinutes() + (bogFin.getDate() !== bog.getDate() ? 1440 : 0);
    const cubierta = franjas.some(f =>
      f.diaSemana === diaSem && f.horaInicio <= minIni && f.horaFin >= minFin
    );
    if (!cubierta) afectadas.push(r.codigo);
  }
  if (afectadas.length > 0) {
    throw conflict(`El cambio deja sin cobertura a las reservas: ${afectadas.join(", ")}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.disponibilidadSemanal.deleteMany({ where: { formadorId } });
    if (franjas.length) {
      await tx.disponibilidadSemanal.createMany({
        data: franjas.map(f => ({ formadorId, ...f })),
      });
    }
  });
}

// ── Excepciones ──

export async function crearExcepcion(params: {
  formadorId: string; tipo: TipoExcepcion; iniciaAt: Date; terminaAt: Date; motivo?: string;
}, actorCuentaId: string) {
  if (params.terminaAt <= params.iniciaAt) throw badRequest("Rango de fechas inválido");
  const afectadas = await prisma.reserva.findMany({
    where: {
      formadorId: params.formadorId, estado: { in: ["CONFIRMADA", "EN_CURSO"] },
      iniciaAt: { lt: params.terminaAt }, terminaAt: { gt: params.iniciaAt },
    },
    select: { codigo: true },
  });
  if (afectadas.length > 0) {
    throw conflict(`La excepción afecta reservas vigentes: ${afectadas.map(a => a.codigo).join(", ")}`);
  }
  const ex = await prisma.excepcionDisponibilidad.create({ data: params });
  return ex;
}

export async function eliminarExcepcion(id: string, actorCuentaId: string) {
  const ex = await prisma.excepcionDisponibilidad.findUnique({ where: { id } });
  if (!ex) throw notFound("Excepción no encontrada");
  await prisma.excepcionDisponibilidad.delete({ where: { id } });
}



