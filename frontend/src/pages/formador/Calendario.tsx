import { useEffect, useMemo, useState } from "react";
import { api, mensajeError } from "../../api/client";
import { FormadorLayout } from "../../components/Layout";
import { ErrorMsg, EstadoBadge, fmtFecha, fmtHora, useBloquearScroll } from "../../components/ui";
import {
  CalendarioMes, EventoDia, diaClave, fechaLarga,
  COLOR_ESTADO_CAL, INCIDENCIA, ESTILO_CARD, ESTILO_INCIDENCIA,
  Dato, Linea, ICONO,
} from "../../components/calendarioMes";

interface ReservaCal {
  id: string; codigo: string; curso: string; iniciaAt: string; terminaAt: string; estado: string;
  docenteNombre: string; docenteCorreo: string; docenteTelefono?: string | null;
  aula?: string | null; facultad?: string | null; asistentes: number; incidenciaPendiente: boolean;
}
interface Ev { reserva: ReservaCal; start: Date; end: Date }

const LEYENDA: [string, string][] = [
  ["#0A6A50", "Confirmada"],
  ["#2563eb", "En curso"],
  ["#6b7280", "Finalizada"],
  ["#dc2626", "Cancelada"],
  [INCIDENCIA, "Incidencia"],
];

export default function CalendarioFormador() {
  const [eventos, setEventos] = useState<Ev[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fecha, setFecha] = useState(new Date());
  const [selDia, setSelDia] = useState(diaClave(new Date()));
  const [sel, setSel] = useState<Ev | null>(null);
  useBloquearScroll(!!sel);

  useEffect(() => {
    const desde = new Date(fecha); desde.setDate(1); desde.setMonth(desde.getMonth() - 1);
    const hasta = new Date(fecha); hasta.setMonth(hasta.getMonth() + 2); hasta.setDate(0);
    api.get("/formador/calendario", { params: { desde: desde.toISOString(), hasta: hasta.toISOString() } })
      .then(r => {
        setEventos(r.data.reservas.map((rv: ReservaCal) => ({
          reserva: rv, start: new Date(rv.iniciaAt), end: new Date(rv.terminaAt),
        })));
      })
      .catch(e => setError(mensajeError(e)));
  }, [fecha]);

  const porDia = useMemo(() => {
    const m = new Map<string, Ev[]>();
    for (const e of eventos) {
      const k = diaClave(e.start);
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    for (const evs of m.values()) evs.sort((a, b) => a.start.getTime() - b.start.getTime());
    return m;
  }, [eventos]);

  const eventosPorDia = useMemo(() => {
    const m = new Map<string, EventoDia[]>();
    for (const [k, evs] of porDia) {
      m.set(k, evs.map(e => ({
        id: e.reserva.id,
        titulo: `${e.reserva.curso} (${e.reserva.codigo})`,
        hora: fmtHora(e.start),
        color: e.reserva.incidenciaPendiente ? INCIDENCIA : COLOR_ESTADO_CAL[e.reserva.estado] ?? "#6b7280",
      })));
    }
    return m;
  }, [porDia]);

  const evsSel = porDia.get(selDia) ?? [];

  return (
    <FormadorLayout titulo="Calendario" amplio>
      <ErrorMsg msg={error} />
      <div className="grid gap-4 mt-3 lg:grid-cols-[1fr_21rem]">
        <CalendarioMes
          mes={fecha} onMes={setFecha}
          eventosPorDia={eventosPorDia}
          selDia={selDia} onSelDia={setSelDia}
          leyenda={LEYENDA}
          className="h-[calc(100vh-10rem)] min-h-[30rem]"
        />

        <div>
          <div className="card flex h-[calc(100vh-10rem)] min-h-[30rem] flex-col self-start">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Reservas del día</h3>
            <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-200 capitalize">{fechaLarga(selDia)}</p>
            {evsSel.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-night-800 text-gray-400 dark:text-gray-500">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Sin eventos</p>
                <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">No hay reservas para este día</p>
              </div>
            ) : (
              <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-auto">
                {evsSel.map(e => {
                  const estilo = e.reserva.incidenciaPendiente ? ESTILO_INCIDENCIA : ESTILO_CARD[e.reserva.estado] ?? ESTILO_CARD.FINALIZADA;
                  return (
                    <div key={e.reserva.id} className={`rounded-xl border-l-[6px] px-3 py-2.5 text-sm shadow-sm ${estilo.fondo}`}>
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-xs font-bold ${estilo.hora}`}>{fmtHora(e.start)} – {fmtHora(e.end)}</span>
                        <EstadoBadge estado={e.reserva.estado} />
                      </div>
                      <div className="mt-0.5 font-semibold text-gray-900 dark:text-gray-100">{e.reserva.curso}</div>
                      <div className="mt-1.5 space-y-1 text-xs text-gray-700 dark:text-gray-300">
                        <Linea icon={ICONO.persona} color={estilo.hora}>{e.reserva.docenteNombre}</Linea>
                        <Linea icon={ICONO.correo} color={estilo.hora}>{e.reserva.docenteCorreo}</Linea>
                        {e.reserva.docenteTelefono && <Linea icon={ICONO.telefono} color={estilo.hora}>{e.reserva.docenteTelefono}</Linea>}
                        {e.reserva.aula && <Linea icon={ICONO.lugar} color={estilo.hora}>{e.reserva.aula}</Linea>}
                        {e.reserva.facultad && <Linea icon={ICONO.facultad} color={estilo.hora}>{e.reserva.facultad}</Linea>}
                        <Linea icon={ICONO.asistentes} color={estilo.hora}>{e.reserva.asistentes} asistente{e.reserva.asistentes === 1 ? "" : "s"}</Linea>
                      </div>
                      {e.reserva.incidenciaPendiente && <div className="mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">Incidencia de reasignación pendiente</div>}
                      <div className="mt-2 flex justify-end">
                        <button
                          className="rounded-lg border border-primary/40 dark:border-primary-soft/40 bg-white dark:bg-night-900 px-3 py-1 text-xs font-semibold text-primary dark:text-primary-soft transition hover:bg-primary/10 dark:hover:bg-primary/20"
                          onClick={() => setSel(e)}
                        >
                          Más detalles
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {sel && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={() => setSel(null)}>
          <div className="card max-h-[90vh] w-full max-w-lg overflow-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-primary dark:text-primary-soft">{sel.reserva.curso}</h3>
                <p className="mt-0.5 font-mono text-xs text-gray-500 dark:text-gray-400">{sel.reserva.codigo}</p>
              </div>
              <EstadoBadge estado={sel.reserva.estado} />
            </div>
            {sel.reserva.incidenciaPendiente && (
              <div className="mt-3"><span className="badge-amarillo">Incidencia de reasignación pendiente</span></div>
            )}
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Dato label="Fecha">{fmtFecha(sel.reserva.iniciaAt)}</Dato>
              <Dato label="Horario">{fmtHora(sel.reserva.iniciaAt)}–{fmtHora(sel.reserva.terminaAt)}</Dato>
              <Dato label="Solicitado por">{sel.reserva.docenteNombre}</Dato>
              <Dato label="Correo del docente">{sel.reserva.docenteCorreo}</Dato>
              <Dato label="Teléfono del docente">{sel.reserva.docenteTelefono ?? "—"}</Dato>
              <Dato label="Aula / lugar">{sel.reserva.aula ?? "—"}</Dato>
              <Dato label="Facultad">{sel.reserva.facultad ?? "—"}</Dato>
              <Dato label="Asistentes registrados">{sel.reserva.asistentes}</Dato>
            </dl>
            <div className="mt-5 flex justify-end gap-2">
              <a className="btn-secondary text-xs" href={`/api/v1/formador/reservas/${sel.reserva.id}/asistentes/exportar`}>Excel asistencia</a>
              <button className="btn-secondary" onClick={() => setSel(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </FormadorLayout>
  );
}
