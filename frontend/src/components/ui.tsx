import { ReactNode, useEffect, useRef, useState } from "react";

export interface OpcionSelect { value: string; label: string }

export function Select({ value, onChange, opciones, placeholder = "Selecciona", id, className, arriba }: {
  value: string;
  onChange: (v: string) => void;
  opciones: OpcionSelect[];
  placeholder?: string;
  id?: string;
  className?: string;
  arriba?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cerrar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);

  const actual = opciones.find(o => o.value === value);
  const abrir = () => {
    setIdx(Math.max(0, opciones.findIndex(o => o.value === value)));
    setAbierto(true);
  };
  const elegir = (v: string) => { onChange(v); setAbierto(false); };

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        id={id} type="button"
        aria-haspopup="listbox" aria-expanded={abierto}
        className="input-base flex items-center justify-between gap-2 text-left"
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={e => {
          if (e.key === "Escape") return setAbierto(false);
          if (!abierto) {
            if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); abrir(); }
            return;
          }
          if (e.key === "ArrowDown") { e.preventDefault(); setIdx(i => Math.min(i + 1, opciones.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
          if (e.key === "Enter") { e.preventDefault(); const o = opciones[idx]; if (o) elegir(o.value); }
        }}
      >
        <span className={`truncate ${actual ? "" : "text-gray-400 dark:text-gray-500"}`}>{actual?.label ?? placeholder}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500 transition-transform duration-150 ${abierto ? "rotate-180" : ""}`} aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {abierto && (
        <ul role="listbox" aria-labelledby={id}
          className={`scroll-fino absolute z-20 max-h-56 w-full overflow-auto rounded-xl border border-gray-200 dark:border-night-700 bg-white dark:bg-night-900 py-1 shadow-lg ${arriba ? "bottom-full mb-1" : "mt-1"}`}>
          {opciones.map((o, i) => (
            <li key={o.value || "__vacio"} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                className={`w-full px-3 py-2 text-left text-sm ${
                  o.value === value ? "font-medium text-primary dark:text-primary-soft" : "text-gray-700 dark:text-gray-300"
                } ${i === idx ? "bg-primary/10 dark:bg-primary/20" : "hover:bg-gray-50 dark:hover:bg-night-800"}`}
                onMouseDown={e => { e.preventDefault(); elegir(o.value); }}
                onMouseEnter={() => setIdx(i)}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Select con búsqueda: siempre visible, se filtra al escribir. */
export function ComboBox({ value, onChange, opciones, placeholder = "Escribe para buscar", id }: {
  value: string;
  onChange: (v: string) => void;
  opciones: OpcionSelect[];
  placeholder?: string;
  id?: string;
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  // Teclear limpia la selección (onChange("")); esta marca evita que la
  // sincronización externa pise lo que el usuario está escribiendo.
  const omitirSync = useRef(false);

  const actual = opciones.find(o => o.value === value);

  useEffect(() => {
    if (omitirSync.current) { omitirSync.current = false; return; }
    setTexto(actual?.label ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const cerrar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);

  // Al enfocar con una selección previa se muestra el catálogo completo;
  // al teclear, solo las coincidencias.
  const filtradas = !texto || texto === actual?.label
    ? opciones
    : opciones.filter(o => normalizar(o.label).includes(normalizar(texto.trim())));

  const elegir = (o: OpcionSelect) => { onChange(o.value); setAbierto(false); };

  return (
    <div ref={ref} className="relative">
      <input
        id={id} className="input-base" autoComplete="off" placeholder={placeholder}
        role="combobox" aria-expanded={abierto} aria-controls={id ? `${id}-lista` : undefined}
        value={texto}
        onFocus={() => { setAbierto(true); setIdx(0); }}
        onBlur={() => { setAbierto(false); setTexto(actual?.label ?? ""); }}
        onChange={e => {
          setTexto(e.target.value);
          if (value) { omitirSync.current = true; onChange(""); }
          setAbierto(true); setIdx(0);
        }}
        onKeyDown={e => {
          if (e.key === "Escape") { setAbierto(false); return; }
          if (!abierto || !filtradas.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setIdx(i => Math.min(i + 1, filtradas.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
          if (e.key === "Enter") { e.preventDefault(); const o = filtradas[idx]; if (o) elegir(o); }
        }}
      />
      {abierto && (
        <ul role="listbox" id={id ? `${id}-lista` : undefined}
          className="scroll-fino absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-gray-200 dark:border-night-700 bg-white dark:bg-night-900 py-1 shadow-lg">
          {filtradas.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Sin resultados</li>
          )}
          {filtradas.map((o, i) => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                className={`w-full px-3 py-2 text-left text-sm ${
                  o.value === value ? "font-medium text-primary dark:text-primary-soft" : "text-gray-700 dark:text-gray-300"
                } ${i === idx ? "bg-primary/10 dark:bg-primary/20" : "hover:bg-gray-50 dark:hover:bg-night-800"}`}
                onMouseDown={e => { e.preventDefault(); elegir(o); }}
                onMouseEnter={() => setIdx(i)}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-10" role="status" aria-label="Cargando">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary dark:border-primary-soft/50 border-t-transparent" />
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
    CONFIRMADA: "badge-verde", EN_CURSO: "badge-azul", FINALIZADA: "badge-gris", CANCELADA: "badge-rojo",
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
          className={`${tamaño} leading-none transition ${v <= valor ? "text-amber-500" : "text-gray-300 dark:text-gray-500"} ${onChange ? "hover:scale-110 cursor-pointer" : "cursor-default"}`}
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

export function BotonLimpiar({ disabled, onClick, className }: { disabled?: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      title="Limpiar filtros"
      aria-label="Limpiar filtros"
      disabled={disabled}
      onClick={onClick}
      className={`btn-secondary px-3 ${className ?? ""}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
        <path d="m16 22-1-4" />
        <path d="M19 14a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2h-3a1 1 0 0 1-1-1V4a2 2 0 0 0-4 0v5a1 1 0 0 1-1 1H6a2 2 0 0 0-2 2v1a1 1 0 0 0 1 1" />
        <path d="M19 14H5l-1.973 6.767A1 1 0 0 0 4 22h16a1 1 0 0 0 .973-1.233z" />
        <path d="m8 22 1-4" />
      </svg>
    </button>
  );
}

export function IconoExito({ tamaño = "h-16 w-16" }: { tamaño?: string }) {
  return (
    <div className={`mx-auto flex items-center justify-center rounded-2xl bg-primary/10 dark:bg-primary/20 ${tamaño}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-1/2 w-1/2 text-primary dark:text-primary-soft">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </div>
  );
}

export function TarjetaStat({ titulo, valor, sub }: { titulo: string; valor: ReactNode; sub?: string }) {
  return (
    <div className="card">
      <div className="text-sm text-gray-500 dark:text-gray-400">{titulo}</div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{valor ?? "—"}</div>
      {sub && <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

/** Resume las calificaciones por aspecto: "Acad. 4.5 · Facil. 5". Null si la evaluación es antigua (sin aspectos). */
export function resumenAspectos(ev: {
  contenidoObjetivo: number | null; metodologiaAdecuada: number | null;
  dominioTema: number | null; coherenciaExposicion: number | null;
}): string | null {
  const prom = (a: number | null, b: number | null) => {
    const v = [a, b].filter((x): x is number => x != null);
    return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null;
  };
  const acad = prom(ev.contenidoObjetivo, ev.metodologiaAdecuada);
  const fac = prom(ev.dominioTema, ev.coherenciaExposicion);
  if (acad == null && fac == null) return null;
  return [acad != null ? `Acad. ${acad}` : null, fac != null ? `Facil. ${fac}` : null].filter(Boolean).join(" · ");
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

let bloqueosScroll = 0;
let overflowAnterior = "";

/** Bloquea el scroll de la página de fondo mientras `activo` sea true (modales). */
export function useBloquearScroll(activo: boolean) {
  useEffect(() => {
    if (!activo) return;
    if (bloqueosScroll++ === 0) {
      overflowAnterior = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      if (--bloqueosScroll === 0) document.body.style.overflow = overflowAnterior;
    };
  }, [activo]);
}
