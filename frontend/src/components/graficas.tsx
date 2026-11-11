import { ReactNode } from "react";
import { useTema } from "../context/TemaContext";

export const COLORES = ["#0A6A50", "#0A6A70", "#d97706", "#2563eb", "#dc2626", "#7c3aed"];

/** Estilos de recharts sensibles al tema claro/oscuro. */
export function useEstilosGrafica() {
  const { tema } = useTema();
  const oscuro = tema === "oscuro";
  return {
    tooltip: {
      borderRadius: 12,
      border: `1px solid ${oscuro ? "#2A3648" : "#e5e7eb"}`,
      fontSize: 13,
      boxShadow: oscuro ? "0 4px 12px rgb(0 0 0 / 0.5)" : "0 4px 12px rgb(0 0 0 / 0.08)",
      backgroundColor: oscuro ? "#1A2331" : "#ffffff",
      color: oscuro ? "#e5e7eb" : "#111827",
    },
    tick: { fontSize: 12, fill: oscuro ? "#9ca3af" : "#6b7280" },
    tickSm: { fontSize: 11, fill: oscuro ? "#9ca3af" : "#6b7280" },
    axis: { stroke: oscuro ? "#2A3648" : "#e5e7eb" },
    grid: oscuro ? "#1F2937" : "#e5e7eb",
    primario: oscuro ? "#6EE7A0" : "#0A6A50",
  };
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const fmtMesLargo = (m: string) => {
  const [a, mm] = m.split("-").map(Number);
  return `${cap(MESES[mm - 1] ?? m)} ${a}`;
};
export const etiquetaMes = (m: string) => {
  const [a, mm] = m.split("-").map(Number);
  const nombre = cap(MESES[mm - 1] ?? m);
  return mm === 1 ? `${nombre} ${String(a).slice(2)}` : nombre;
};
export const fmtMesCorto = (m: string) => {
  const [a, mm] = m.split("-").map(Number);
  return `${(MESES[mm - 1] ?? m).slice(0, 3)} ${String(a).slice(2)}`;
};
export const mesesEntre = (a: string, b: string) => {
  const out: string[] = [];
  let [y, m] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  while (y < yb || (y === yb && m <= mb)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
};
export const cortar = (s: string) => (s.length > 14 ? `${s.slice(0, 13)}…` : s);

export function TarjetaGrafica({ titulo, sub, children, ancha }: { titulo: string; sub?: string; children: ReactNode; ancha?: boolean }) {
  return (
    <div className={`card ${ancha ? "md:col-span-2" : ""}`}>
      <h3 className="font-semibold text-primary dark:text-primary-soft">{titulo}</h3>
      {sub && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{sub}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function SinDatos({ texto = "Sin datos en el período" }: { texto?: string }) {
  return <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">{texto}</p>;
}
