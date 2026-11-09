import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import rateLimit from "express-rate-limit";

export function validar<T>(schema: ZodSchema<T>, fuente: "body" | "query" | "params" = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.parse(req[fuente]);
    (req as unknown as Record<string, unknown>)[fuente === "body" ? "body" : fuente] = parsed;
    next();
  };
}

/** Rate limiting general para endpoints públicos */
export const limitadorPublico = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes, intenta más tarde", code: "RATE_LIMIT" },
});

/** Rate limiting estricto para formularios públicos con escritura (asistencia, solicitudes) */
export const limitadorEscritura = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes, intenta más tarde", code: "RATE_LIMIT" },
});

/** Login: protección contra fuerza bruta */
export const limitadorLogin = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Demasiados intentos de inicio de sesión", code: "RATE_LIMIT" },
});
