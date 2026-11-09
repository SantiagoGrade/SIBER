import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { prisma } from "../repositories/prisma";
import { unauthorized, forbidden } from "../utils/errors";
import { RolCuenta } from "@prisma/client";

export interface SesionUsuario {
  cuentaId: string;
  usuario: string;
  rol: RolCuenta;
  nombreCompleto: string;
  formadorId?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: SesionUsuario;
    }
  }
}

export const COOKIE_SESION = "sifoin_sesion";

export function firmarSesion(payload: Omit<SesionUsuario, "formadorId"> & { formadorId?: string }): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: `${env.sessionTtlHours}h` });
}

export function opcionesCookie() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax" as const,
    maxAge: env.sessionTtlHours * 3600 * 1000,
    path: "/",
  };
}

/** Autenticación: JWT en cookie HttpOnly (fallback: Authorization Bearer) */
export async function autenticar(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[COOKIE_SESION] ??
      (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : undefined);
    if (!token) throw unauthorized();
    const payload = jwt.verify(token, env.jwtSecret) as SesionUsuario;

    // Revalidar que la cuenta siga activa (defensa contra tokens de cuentas desactivadas)
    const cuenta = await prisma.cuenta.findUnique({
      where: { id: payload.cuentaId },
      include: { formador: true },
    });
    if (!cuenta || !cuenta.activo) throw unauthorized("Cuenta inexistente o desactivada");

    req.usuario = {
      cuentaId: cuenta.id,
      usuario: cuenta.usuario,
      rol: cuenta.rol,
      nombreCompleto: cuenta.nombreCompleto,
      formadorId: cuenta.formador?.id,
    };
    next();
  } catch (e) {
    next(e instanceof Error && e.name === "AppError" ? e : unauthorized());
  }
}

export function requiereRol(...roles: RolCuenta[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.usuario) return next(unauthorized());
    if (!roles.includes(req.usuario.rol)) return next(forbidden());
    next();
  };
}

export const soloAdmins = requiereRol("SUPER_ADMIN", "ADMIN");
export const soloFormador = requiereRol("FORMADOR");
export const cualquierAutenticado = requiereRol("SUPER_ADMIN", "ADMIN", "FORMADOR");
