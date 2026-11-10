import argon2 from "argon2";
import { prisma } from "../repositories/prisma";
import { badRequest, conflict, notFound, unauthorized } from "../utils/errors";
import { encolar } from "./notificacion.service";
import { generarToken, hashToken } from "../utils/tokens";
import { env } from "../config/env";
import { RolCuenta } from "@prisma/client";

export async function verificarLogin(usuario: string, password: string) {
  const cuenta = await prisma.cuenta.findFirst({
    where: { OR: [{ usuario }, { correo: usuario.toLowerCase() }] },
    include: { formador: true },
  });
  if (!cuenta || !cuenta.activo) throw unauthorized("Credenciales inválidas");
  const ok = await argon2.verify(cuenta.passwordHash, password).catch(() => false);
  if (!ok) throw unauthorized("Credenciales inválidas");
  return cuenta;
}

export async function crearCuenta(params: {
  usuario: string; correo: string; password: string;
  nombreCompleto: string; rol: RolCuenta; cursoIds?: string[];
}, actorCuentaId?: string, ip?: string) {
  const hash = await argon2.hash(params.password, { type: argon2.argon2id });
  const cursoIds = params.rol === "FORMADOR" ? [...new Set(params.cursoIds ?? [])] : [];
  try {
    const cuenta = await prisma.$transaction(async (tx) => {
      if (cursoIds.length) {
        const existentes = await tx.curso.count({ where: { id: { in: cursoIds } } });
        if (existentes !== cursoIds.length) throw badRequest("Alguno de los cursos seleccionados no existe");
      }
      const c = await tx.cuenta.create({
        data: {
          usuario: params.usuario,
          correo: params.correo.toLowerCase(),
          passwordHash: hash,
          nombreCompleto: params.nombreCompleto,
          rol: params.rol,
          ...(params.rol === "FORMADOR"
            ? { formador: { create: { cursos: { create: cursoIds.map(cursoId => ({ cursoId })) } } } }
            : {}),
        },
        include: { formador: true },
      });
      return c;
    });
    return cuenta;
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      throw conflict("El usuario o correo ya están registrados");
    }
    throw e;
  }
}

export async function cambiarPassword(cuentaId: string, actual: string, nueva: string, ip?: string) {
  const cuenta = await prisma.cuenta.findUniqueOrThrow({ where: { id: cuentaId } });
  const ok = await argon2.verify(cuenta.passwordHash, actual).catch(() => false);
  if (!ok) throw unauthorized("La contraseña actual es incorrecta");
  if (nueva.length < 10) throw badRequest("La nueva contraseña debe tener al menos 10 caracteres");
  await prisma.cuenta.update({
    where: { id: cuentaId },
    data: { passwordHash: await argon2.hash(nueva, { type: argon2.argon2id }) },
  });
}

export async function solicitarRecuperacion(correo: string) {
  const cuenta = await prisma.cuenta.findUnique({ where: { correo: correo.toLowerCase() } });
  // Respuesta inmediata: el usuario sabe al instante si el correo existe.
  // (El rate limit `limitadorPublico` mitiga la enumeración de correos.)
  if (!cuenta) throw notFound("No existe una cuenta registrada con ese correo");
  if (!cuenta.activo) throw badRequest("La cuenta asociada a ese correo está inactiva. Contacta al administrador");
  const token = generarToken();
  await prisma.$transaction(async (tx) => {
    await tx.tokenSeguro.create({
      data: {
        tipo: "RECUPERACION_PASSWORD",
        hash: hashToken(token),
        cuentaId: cuenta.id,
        expiraAt: new Date(Date.now() + 3600_000),
      },
    });
    await encolar(tx, {
      tipo: "RECUPERACION_PASSWORD",
      destinatario: cuenta.correo,
      datos: {
        nombreDestinatario: cuenta.nombreCompleto,
        enlaceAccion: `${env.publicAppUrl}/restablecer-password?token=${token}`,
      },
      dedupKey: `recuperacion:${cuenta.id}:${Date.now()}`,
    });
  });
}

export async function restablecerPassword(token: string, nueva: string, ip?: string) {
  if (nueva.length < 10) throw badRequest("La contraseña debe tener al menos 10 caracteres");
  await prisma.$transaction(async (tx) => {
    const t = await tx.tokenSeguro.findUnique({ where: { hash: hashToken(token) } });
    if (!t || t.tipo !== "RECUPERACION_PASSWORD" || !t.cuentaId) throw badRequest("Enlace inválido");
    if (t.usadoAt) throw conflict("El enlace ya fue utilizado");
    if (t.expiraAt < new Date()) throw conflict("El enlace expiró");
    await tx.tokenSeguro.update({ where: { id: t.id }, data: { usadoAt: new Date() } });
    await tx.cuenta.update({
      where: { id: t.cuentaId },
      data: { passwordHash: await argon2.hash(nueva, { type: argon2.argon2id }) },
    });
  });
}

export async function actualizarCuenta(cuentaId: string, params: {
  usuario?: string; correo?: string; password?: string;
  nombreCompleto?: string; rol?: RolCuenta; cursoIds?: string[];
}, actorCuentaId?: string, ip?: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const cuenta = await tx.cuenta.findUniqueOrThrow({
        where: { id: cuentaId },
        include: { formador: { include: { cursos: true } } },
      });
      const nuevoRol = params.rol ?? cuenta.rol;
      if (nuevoRol !== "FORMADOR" && cuenta.rol === "FORMADOR" && cuenta.formador) {
        const futuras = await tx.reserva.count({
          where: { formadorId: cuenta.formador.id, estado: { in: ["CONFIRMADA", "EN_CURSO"] }, terminaAt: { gt: new Date() } },
        });
        if (futuras > 0) {
          throw conflict(`El formador tiene ${futuras} reservas vigentes; reasígnalas o cancélalas antes de cambiar el rol`);
        }
      }

      let formadorId = cuenta.formador?.id;
      if (nuevoRol === "FORMADOR" && !formadorId) {
        formadorId = (await tx.formador.create({ data: { cuentaId } })).id;
      }

      if (nuevoRol === "FORMADOR" && formadorId && params.cursoIds) {
        const cursoIds = [...new Set(params.cursoIds)];
        const existentes = await tx.curso.count({ where: { id: { in: cursoIds } } });
        if (existentes !== cursoIds.length) throw badRequest("Alguno de los cursos seleccionados no existe");

        const eliminados = cuenta.formador?.cursos
          .map(fc => fc.cursoId)
          .filter(id => !cursoIds.includes(id)) ?? [];
        if (eliminados.length) {
          const bloqueadas = await tx.reserva.groupBy({
            by: ["cursoId"],
            where: { formadorId, cursoId: { in: eliminados }, estado: { in: ["CONFIRMADA", "EN_CURSO"] }, terminaAt: { gt: new Date() } },
            _count: true,
          });
          if (bloqueadas.length) {
            const nombres = (await tx.curso.findMany({
              where: { id: { in: bloqueadas.map(b => b.cursoId) } }, select: { nombre: true },
            })).map(c => c.nombre);
            throw conflict(`No se pueden quitar cursos con reservas vigentes: ${nombres.join(", ")}`);
          }
          await tx.formadorCurso.deleteMany({ where: { formadorId, cursoId: { in: eliminados } } });
        }
        if (cursoIds.length) {
          await tx.formadorCurso.createMany({
            data: cursoIds.map(cursoId => ({ formadorId: formadorId!, cursoId })),
            skipDuplicates: true,
          });
        }
      }

      const cuentaActualizada = await tx.cuenta.update({
        where: { id: cuentaId },
        data: {
          ...(params.usuario !== undefined ? { usuario: params.usuario } : {}),
          ...(params.correo !== undefined ? { correo: params.correo.toLowerCase() } : {}),
          ...(params.nombreCompleto !== undefined ? { nombreCompleto: params.nombreCompleto } : {}),
          ...(params.rol !== undefined ? { rol: params.rol } : {}),
          ...(params.password ? { passwordHash: await argon2.hash(params.password, { type: argon2.argon2id }) } : {}),
        },
      });
      return cuentaActualizada;
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      throw conflict("El usuario o correo ya están registrados");
    }
    throw e;
  }
}

export async function desactivarCuenta(cuentaId: string, actorCuentaId: string, ip?: string) {
  const cuenta = await prisma.cuenta.findUnique({ where: { id: cuentaId }, include: { formador: true } });
  if (!cuenta) throw notFound("Cuenta no encontrada");
  if (cuentaId === actorCuentaId) throw badRequest("No puedes desactivar tu propia cuenta");
  if (cuenta.formador) {
    const pendientes = await prisma.reserva.count({
      where: { formadorId: cuenta.formador.id, estado: { in: ["CONFIRMADA", "EN_CURSO"] }, terminaAt: { gt: new Date() } },
    });
    if (pendientes > 0) {
      throw conflict(`El formador tiene ${pendientes} reservas vigentes; reasígnalas o cancélalas antes`);
    }
  }
  await prisma.$transaction(async (tx) => {
    await tx.cuenta.update({ where: { id: cuentaId }, data: { activo: false } });
  });
}

export async function activarCuenta(cuentaId: string, actorCuentaId: string, ip?: string) {
  await prisma.$transaction(async (tx) => {
    await tx.cuenta.update({ where: { id: cuentaId }, data: { activo: true } });
  });
}
