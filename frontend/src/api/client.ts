import axios from "axios";

export const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

export interface ApiError { error: string; code?: string; detalles?: { campo: string; mensaje: string }[] }

export function mensajeError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const d = e.response?.data as ApiError | undefined;
    if (d?.detalles?.length) return d.detalles.map(x => x.mensaje).join(". ");
    return d?.error ?? e.message;
  }
  return e instanceof Error ? e.message : "Error inesperado";
}
