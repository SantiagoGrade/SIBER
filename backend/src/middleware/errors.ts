import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";
import { env } from "../config/env";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export function manejadorErrores(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Datos de entrada inválidos",
      code: "VALIDATION",
      detalles: err.issues.map(i => ({ campo: i.path.join("."), mensaje: i.message })),
    });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, code: err.code, detalles: err.details });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "El registro ya existe", code: "DUPLICADO" });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Recurso no encontrado", code: "NOT_FOUND" });
    }
    if (err.code === "P2034") {
      return res.status(409).json({ error: "Conflicto de concurrencia, intenta de nuevo", code: "CONCURRENCIA" });
    }
  }
  // Exclusion constraint (23P01 vía driver crudo se envuelve en P2010/known)
  if (err instanceof Prisma.PrismaClientKnownRequestError && (err as { code: string }).code === "P2010") {
    const meta = err.meta as { message?: string } | undefined;
    if (meta?.message?.includes("excl_solape_formador")) {
      return res.status(409).json({ error: "El formador ya tiene una reserva en esa franja", code: "SOLAPE" });
    }
  }
  console.error("[error]", err);
  res.status(500).json({
    error: "Error interno del servidor",
    code: "INTERNAL",
    ...(env.nodeEnv !== "production" && err instanceof Error ? { detalle: err.message } : {}),
  });
}

export function noEncontrado(_req: Request, res: Response) {
  res.status(404).json({ error: "Ruta no encontrada", code: "NOT_FOUND" });
}
