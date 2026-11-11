import { ReactNode, useMemo } from "react";

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const diaClave = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
export const fechaLarga = (clave: string) => {
  const [y, m, dd] = clave.split("-").map(Number);
  return cap(new Date(y, m - 1, dd).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
};

const DIAS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

export const INCIDENCIA = "#f59e0b";
export const COLOR_ESTADO_CAL: Record<string, string> = {
  CONFIRMADA: "#0A6A50",
  EN_CURSO: "#2563eb",
  FINALIZADA: "#6b7280",
  CANCELADA: "#dc2626",
};

export const ESTILO_CARD: Record<string, { fondo: string; hora: string }> = {
  CONFIRMADA: { fondo: "border-primary dark:border-primary-soft/50 bg-primary/15 dark:bg-primary/25", hora: "text-primary dark:text-primary-soft" },
  EN_CURSO: { fondo: "border-blue-600 bg-blue-100 dark:bg-blue-500/15", hora: "text-blue-700 dark:text-blue-300" },
  FINALIZADA: { fondo: "border-gray-400 dark:border-night-600 bg-gray-200 dark:bg-night-700", hora: "text-gray-600 dark:text-gray-400" },
  CANCELADA: { fondo: "border-red-500 bg-red-100 dark:bg-red-500/15", hora: "text-red-700 dark:text-red-400" },
};
export const ESTILO_INCIDENCIA = { fondo: "border-amber-500 bg-amber-100 dark:bg-amber-500/15", hora: "text-amber-800 dark:text-amber-300" };

export function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-800 dark:text-gray-200">{children}</dd>
    </div>
  );
}

export function Linea({ icon, color = "text-gray-400 dark:text-gray-500", children }: { icon: ReactNode; color?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`h-3.5 w-3.5 shrink-0 ${color}`}>{icon}</svg>
      <span className="truncate">{children}</span>
    </div>
  );
}

export const ICONO = {
  persona: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  formador: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="m16 11 2 2 4-4" /></>,
  correo: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></>,
  telefono: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .72 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.72A2 2 0 0 1 22 16.92z" />,
  lugar: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>,
  facultad: <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" /></>,
  asistentes: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
};

export interface EventoDia { id: string; titulo: string; hora: string; color: string }

export function CalendarioMes({ mes, onMes, eventosPorDia, selDia, onSelDia, leyenda, className }: {
  mes: Date;
  onMes: (d: Date) => void;
  eventosPorDia: Map<string, EventoDia[]>;
  selDia: string;
  onSelDia: (clave: string) => void;
  leyenda: [string, string][];
  className?: string;
}) {
  const dias = useMemo(() => {
    const primero = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const inicio = new Date(primero);
    inicio.setDate(1 - ((primero.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(inicio); d.setDate(d.getDate() + i); return d;
    });
  }, [mes]);

  const moverMes = (n: number) => onMes((() => {
    const d = new Date(mes); d.setDate(1); d.setMonth(d.getMonth() + n); return d;
  })());
  const irHoy = () => { const h = new Date(); onMes(h); onSelDia(diaClave(h)); };

  const nombreMes = cap(mes.toLocaleDateString("es-CO", { month: "long", year: "numeric" }));
  const hoyClave = diaClave(new Date());
  const totalEventos = [...eventosPorDia.values()].reduce((a, v) => a + v.length, 0);

  return (
    <div className={`card flex flex-col ${className ?? ""}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-lg capitalize flex items-center gap-2">
          {nombreMes}
          <span className="rounded-full bg-primary/10 dark:bg-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary dark:text-primary-soft">{totalEventos} eventos</span>
        </h3>
        <div className="flex items-center gap-1.5">
          <button className="btn-secondary px-3 py-1 text-xs" onClick={irHoy}>Hoy</button>
          <button className="btn-secondary px-2.5 py-1 text-xs" onClick={() => moverMes(-1)} aria-label="Mes anterior">‹</button>
          <button className="btn-secondary px-2.5 py-1 text-xs" onClick={() => moverMes(1)} aria-label="Mes siguiente">›</button>
        </div>
      </div>

      <div className="grid grid-cols-7">
        {DIAS.map(d => <div key={d} className="pb-1 text-center text-[11px] font-semibold tracking-wide text-gray-500 dark:text-gray-400">{d}</div>)}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-px overflow-hidden rounded-xl border border-gray-200 dark:border-night-700 bg-gray-200 dark:bg-night-700">
        {dias.map(d => {
          const clave = diaClave(d);
          const esHoy = clave === hoyClave;
          const esSel = clave === selDia;
          const fueraMes = d.getMonth() !== mes.getMonth();
          const evs = eventosPorDia.get(clave) ?? [];
          return (
            <button
              key={clave} type="button" onClick={() => onSelDia(clave)}
              className={`overflow-hidden bg-white dark:bg-night-900 p-1 text-left align-top transition ${fueraMes ? "bg-gray-50/60 dark:bg-night-900/60" : ""} ${esHoy ? "bg-primary/5 dark:bg-primary/15" : ""} ${esSel ? "shadow-[inset_0_0_0_2px_#0A6A50] dark:shadow-[inset_0_0_0_2px_#10B981] z-10" : "hover:bg-gray-50 dark:hover:bg-night-800"}`}
            >
              <div className="flex justify-end">
                <span className={`text-[11px] leading-5 ${esHoy ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary font-semibold text-white" : fueraMes ? "text-gray-300 dark:text-gray-500" : "text-gray-500 dark:text-gray-400"}`}>
                  {d.getDate()}
                </span>
              </div>
              <div className="mt-0.5 space-y-0.5">
                {evs.slice(0, 3).map(e => (
                  <div key={e.id} className="flex items-center gap-1 truncate text-[11px] leading-tight text-gray-700 dark:text-gray-300" title={e.titulo}>
                    <i className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: e.color }} />
                    <span className="text-gray-400 dark:text-gray-500">{e.hora}</span>
                    <span className="truncate">{e.titulo}</span>
                  </div>
                ))}
                {evs.length > 3 && <div className="text-[10px] font-medium text-gray-400 dark:text-gray-500">+{evs.length - 3} más</div>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
        {leyenda.map(([color, nombre]) => (
          <span key={nombre} className="inline-flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{nombre}
          </span>
        ))}
      </div>
    </div>
  );
}
