export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (msg: string, details?: unknown) => new AppError(400, msg, "BAD_REQUEST", details);
export const unauthorized = (msg = "No autenticado") => new AppError(401, msg, "UNAUTHORIZED");
export const forbidden = (msg = "Sin permisos") => new AppError(403, msg, "FORBIDDEN");
export const notFound = (msg = "Recurso no encontrado") => new AppError(404, msg, "NOT_FOUND");
export const conflict = (msg: string, details?: unknown) => new AppError(409, msg, "CONFLICT", details);
