import { ReactNode } from "react";

export function Spinner() {
  return (
    <div className="flex justify-center py-10" role="status" aria-label="Cargando">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

export function ErrorMsg({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div className="alert-error" role="alert">{msg}</div>;
}

export function OkMsg({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div className="alert-success" role="status">{msg}</div>;
}

export function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    CONFIRMADA: "badge-verde", FINALIZADA: "badge-gris", CANCELADA: "badge-rojo",
    PENDIENTE: "badge-amarillo", APROBADA: "badge-verde", RECHAZADA: "badge-rojo",
    SIN_REEMPLAZO: "badge-amarillo", PENDIENTE_RESPUESTA_DOCENTE: "badge-amarillo",
    RESUELTA: "badge-verde", PROGRAMADO: "badge-gris", ABIERTO: "badge-verde",
    CERRADO: "badge-gris", INVALIDADO: "badge-rojo", ENVIADO: "badge-verde",
    OMITIDO: "badge-gris", INCIDENCIA: "badge-rojo", FALLIDA: "badge-rojo",
    ENVIADA: "badge-verde", ACEPTADA: "badge-verde",
  };
  return <span className={map[estado] ?? "badge-gris"}>{estado.replaceAll("_", " ")}</span>;
}

export function Estrellas({ valor, onChange, tamaño = "text-3xl" }: { valor: number; onChange?: (v: number) => void; tamaño?: string }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Calificación">
      {[1, 2, 3, 4, 5].map(v => (
        <button
          key={v} type="button" disabled={!onChange}
          onClick={() => onChange?.(v)}
          className={`${tamaño} leading-none transition ${v <= valor ? "text-amber-500" : "text-gray-300"} ${onChange ? "hover:scale-110 cursor-pointer" : "cursor-default"}`}
          aria-label={`${v} estrellas`}
          aria-checked={v === valor}
          role="radio"
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function TarjetaStat({ titulo, valor, sub }: { titulo: string; valor: ReactNode; sub?: string }) {
  return (
    <div className="card">
      <div className="text-sm text-gray-500">{titulo}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{valor ?? "—"}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

export function fmtFecha(iso: string | Date): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CO", { timeZone: "America/Bogota" });
}
export function fmtHora(iso: string | Date): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: false });
}
export function fmtFechaHora(iso: string | Date): string {
  return `${fmtFecha(iso)} ${fmtHora(iso)}`;
}
