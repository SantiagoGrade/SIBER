import { Request, Response } from "express";
import { ah } from "../middleware/asyncHandler";
import { verificarLogin, cambiarPassword, solicitarRecuperacion, restablecerPassword } from "../services/cuenta.service";
import { firmarSesion, opcionesCookie, COOKIE_SESION } from "../middleware/auth";
import { prisma } from "../repositories/prisma";
import { unauthorized } from "../utils/errors";

export const login = ah(async (req: Request, res: Response) => {
  const { usuario, password } = req.body;
  const cuenta = await verificarLogin(usuario, password);
  const token = firmarSesion({
    cuentaId: cuenta.id, usuario: cuenta.usuario, rol: cuenta.rol,
    nombreCompleto: cuenta.nombreCompleto, formadorId: cuenta.formador?.id,
  });
  res.cookie(COOKIE_SESION, token, opcionesCookie());
  res.json({
    cuenta: {
      id: cuenta.id, usuario: cuenta.usuario, correo: cuenta.correo,
      rol: cuenta.rol, nombreCompleto: cuenta.nombreCompleto,
      formadorId: cuenta.formador?.id ?? null,
    },
  });
});

export const logout = ah(async (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_SESION, { path: "/" });
  res.json({ ok: true });
});

export const perfil = ah(async (req: Request, res: Response) => {
  if (!req.usuario) throw unauthorized();
  const cuenta = await prisma.cuenta.findUnique({
    where: { id: req.usuario.cuentaId },
    include: { formador: { include: { cursos: { include: { curso: true } } } } },
  });
  res.json({
    id: cuenta!.id, usuario: cuenta!.usuario, correo: cuenta!.correo,
    rol: cuenta!.rol, nombreCompleto: cuenta!.nombreCompleto,
    formadorId: cuenta!.formador?.id ?? null,
    cursos: cuenta!.formador?.cursos.map(fc => ({ id: fc.cursoId, nombre: fc.curso.nombre })) ?? [],
  });
});

export const cambiarPasswordCtrl = ah(async (req: Request, res: Response) => {
  await cambiarPassword(req.usuario!.cuentaId, req.body.actual, req.body.nueva, req.ip);
  res.json({ ok: true });
});

export const recuperar = ah(async (req: Request, res: Response) => {
  await solicitarRecuperacion(req.body.correo);
  // Respuesta uniforme (anti-enumeración)
  res.json({ ok: true });
});

export const restablecer = ah(async (req: Request, res: Response) => {
  await restablecerPassword(req.body.token, req.body.nueva, req.ip);
  res.json({ ok: true });
});
