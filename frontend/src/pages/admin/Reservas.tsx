import { useEffect, useMemo, useRef, useState } from "react";
import { api, mensajeError } from "../../api/client";
import { AdminLayout } from "../../components/Layout";
import { Spinner, ErrorMsg, OkMsg, EstadoBadge, Select, BotonLimpiar, fmtFecha, fmtHora, resumenAspectos, useBloquearScroll } from "../../components/ui";
import { Reserva, EstadoQr, Curso } from "../../api/types";
import {
  CalendarioMes, EventoDia, diaClave, fechaLarga,
  COLOR_ESTADO_CAL, INCIDENCIA, ESTILO_CARD, ESTILO_INCIDENCIA,
  Linea, ICONO, Dato,
} from "../../components/calendarioMes";

interface Asistente {
  id: string; nombreCompleto: string; documento: string; correo: string; programa: string;
  esDocente: boolean; fechaRegistro: string;
  evaluacion: {
    contenidoObjetivo: number | null; metodologiaAdecuada: number | null;
    dominioTema: number | null; coherenciaExposicion: number | null;
    calificacionGeneral: number; observaciones: string | null;
  } | null;
}

const LEYENDA_CAL: [string, string][] = [
  ["#0A6A50", "Confirmada"],
  ["#2563eb", "En curso"],
  ["#6b7280", "Finalizada"],
  ["#dc2626", "Cancelada"],
  [INCIDENCIA, "Incidencia"],
];

const HEADER_ESTADO: Record<string, string> = {
  CONFIRMADA: "bg-primary",
  EN_CURSO: "bg-blue-600",
  FINALIZADA: "bg-gray-500",
  CANCELADA: "bg-red-600",
};
const HEADER_INCIDENCIA = "bg-amber-500";

const FILTRO_INICIAL = { estado: "", cursoId: "", codigo: "", orden: "desc", desde: "", hasta: "" };
const RESERVAS_POR_PAGINA = 15;

export default function Reservas() {
  const [reservas, setReservas] = useState<Reserva[] | null>(null);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [filtro, setFiltro] = useState(FILTRO_INICIAL);
  const [paginaReservas, setPaginaReservas] = useState(0);
  const [vista, setVista] = useState<"lista" | "calendario">("lista");
  const [fechaCal, setFechaCal] = useState(new Date());
  const [selDia, setSelDia] = useState(diaClave(new Date()));
  const [sel, setSel] = useState<Reserva | null>(null);
  const [asistentes, setAsistentes] = useState<Asistente[]>([]);
  const [qr, setQr] = useState<EstadoQr | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [motivo, setMotivo] = useState("");
  useBloquearScroll(vista === "calendario" && !!sel);

  const cargarReq = useRef(0);
  const cargar = () => {
    const reqId = ++cargarReq.current;
    const params: Record<string, string> = {};
    if (filtro.estado) params.estado = filtro.estado;
    if (filtro.cursoId) params.cursoId = filtro.cursoId;
    if (filtro.codigo.trim()) params.codigo = filtro.codigo.trim();
    params.orden = filtro.orden;
    if (filtro.desde) params.desde = filtro.desde;
    // "hasta" inclusivo: el backend filtra iniciaAt < hasta, se envía el día siguiente
    if (filtro.hasta) {
      const d = new Date(`${filtro.hasta}T00:00:00`);
      d.setDate(d.getDate() + 1);
      params.hasta = d.toISOString();
    }
    api.get("/admin/reservas", { params })
      .then(r => { if (reqId === cargarReq.current) setReservas(r.data); })
      .catch(e => { if (reqId === cargarReq.current) setError(mensajeError(e)); });
  };
  useEffect(() => {
    api.get("/publico/cursos").then(r => setCursos(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    // Debounce: al teclear el código solo sale una petición con el valor final,
    // y la guardia de reqId descarta respuestas viejas que lleguen tarde
    const t = setTimeout(() => { setPaginaReservas(0); cargar(); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  const detalleReq = useRef(0);
  const verDetalle = async (r: Reserva) => {
    // El detalle anterior se conserva hasta que llega el nuevo:
    // el cambio de panel es atómico y no hay "parpadeo" al navegar entre reservas.
    const reqId = ++detalleReq.current;
    setSel(r); setCargandoDetalle(true);
    const [a, q] = await Promise.all([
      api.get(`/admin/reservas/${r.id}/asistentes`).catch(() => ({ data: [] })),
      api.get(`/admin/reservas/${r.id}/qr`).catch(() => ({ data: null })),
    ]);
    if (reqId !== detalleReq.current) return; // llegó una selección más reciente
    setAsistentes(a.data); setQr(q.data); setCargandoDetalle(false);
  };

  const cancelar = async () => {
    if (!sel) return;
    try {
      await api.post(`/admin/reservas/${sel.id}/cancelar`, { motivo });
      setOk("Reserva cancelada"); setSel(null); setMotivo(""); cargar();
    } catch (e) { setError(mensajeError(e)); }
  };

  const toggleQr = async (accion: "cerrar" | "abrir") => {
    if (!sel) return;
    await api.post(`/admin/reservas/${sel.id}/qr/${accion}`);
    const q = await api.get(`/admin/reservas/${sel.id}/qr`); setQr(q.data);
  };

  const porDia = useMemo(() => {
    const m = new Map<string, Reserva[]>();
    for (const r of reservas ?? []) {
      const k = diaClave(new Date(r.iniciaAt));
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    for (const lista of m.values()) lista.sort((a, b) => new Date(a.iniciaAt).getTime() - new Date(b.iniciaAt).getTime());
    return m;
  }, [reservas]);

  const eventosPorDia = useMemo(() => {
    const m = new Map<string, EventoDia[]>();
    for (const [k, lista] of porDia) {
      m.set(k, lista.map(r => ({
        id: r.id,
        titulo: `${r.curso} · ${r.formador}`,
        hora: fmtHora(r.iniciaAt),
        color: r.incidenciaPendiente ? INCIDENCIA : COLOR_ESTADO_CAL[r.estado] ?? "#6b7280",
      })));
    }
    return m;
  }, [porDia]);

  const reservasDia = porDia.get(selDia) ?? [];

  const paginas = Math.max(1, Math.ceil((reservas?.length ?? 0) / RESERVAS_POR_PAGINA));
  const pagina = Math.min(paginaReservas, paginas - 1);
  const reservasPagina = (reservas ?? []).slice(pagina * RESERVAS_POR_PAGINA, pagina * RESERVAS_POR_PAGINA + RESERVAS_POR_PAGINA);

  const detalleReserva = sel ? (
    <>
      <div className="card">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-primary dark:text-primary-soft">{sel.codigo} — {sel.curso}</h3>
          {cargandoDetalle && <span className="text-xs text-gray-400 dark:text-gray-500 animate-pulse whitespace-nowrap">Actualizando…</span>}
        </div>
        <div className="text-sm mt-2 space-y-1">
          <div><strong>Docente:</strong> {sel.docenteNombre} ({sel.docenteCorreo}{sel.docenteTelefono ? ` · ${sel.docenteTelefono}` : ""})</div>
          {sel.aula && <div><strong>Aula / lugar:</strong> {sel.aula}</div>}
          <div><strong>Horario:</strong> {fmtFecha(sel.iniciaAt)} {fmtHora(sel.iniciaAt)}–{fmtHora(sel.terminaAt)}</div>
          <div><strong>Formador asignado:</strong> {sel.formador}{sel.formadorCorreo ? ` (${sel.formadorCorreo})` : ""}</div>
          <div><strong>Estado:</strong> <EstadoBadge estado={sel.estado} /></div>
        </div>
        {sel.estado === "CONFIRMADA" && (
          <div className="mt-3 flex gap-2">
            <input className="input-base flex-1" placeholder="Motivo de cancelación" value={motivo} onChange={e => setMotivo(e.target.value)} />
            <button className="btn-danger" disabled={motivo.length < 3} onClick={cancelar}>Cancelar</button>
          </div>
        )}
      </div>
      {qr && (
        <div className="card">
          <h3 className="font-semibold text-primary dark:text-primary-soft">QR de asistencia</h3>
          <div className="text-sm mt-2 space-y-1">
            <div>Estado: <EstadoBadge estado={qr.estado} /> · Envío: <EstadoBadge estado={qr.estadoEnvio} /></div>
            <div>Envío programado: {fmtFecha(qr.fechaEnvioProgramado)} {fmtHora(qr.fechaEnvioProgramado)}</div>
            {qr.fechaEnvioReal && <div>Enviado: {fmtFecha(qr.fechaEnvioReal)} {fmtHora(qr.fechaEnvioReal)} a {qr.destinatario}</div>}
            <div>Ventana registro: {fmtHora(qr.fechaHabilitacion)}–{fmtHora(qr.fechaCierre)}</div>
            <div>{qr.asistencias} asistencias · {qr.evaluaciones} evaluaciones</div>
            {qr.ultimoError && <div className="text-red-600 dark:text-red-400 text-xs">{qr.ultimoError}</div>}
            <div className="flex gap-2 pt-2">
              <button className="btn-secondary" onClick={() => toggleQr("cerrar")}>Cerrar registro</button>
              <button className="btn-secondary" onClick={() => toggleQr("abrir")}>Reabrir</button>
              <a className="btn-secondary" href={`/api/v1/admin/exportar/asistencia?reservaId=${sel.id}`}>Excel asistencia</a>
            </div>
          </div>
        </div>
      )}
      <div className="card">
        <h3 className="font-semibold text-primary dark:text-primary-soft">Asistentes ({asistentes.length})</h3>
        <div className="scroll-fino max-h-60 overflow-auto mt-2">
          {asistentes.map(a => (
            <div key={a.id} className="text-sm border-b border-gray-100 dark:border-night-800 py-1.5">
              <div className="font-medium">{a.nombreCompleto} · {a.documento}{a.esDocente && <span className="badge-azul ml-2">Docente</span>}</div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">{a.programa} · {a.correo}</div>
              {a.evaluacion && <div className="text-xs">★ {a.evaluacion.calificacionGeneral}{resumenAspectos(a.evaluacion) && ` · ${resumenAspectos(a.evaluacion)}`}{a.evaluacion.observaciones && ` · ${a.evaluacion.observaciones}`}</div>}
            </div>
          ))}
        </div>
      </div>
    </>
  ) : null;

  return (
    <AdminLayout titulo="Reservas" amplio>
      <ErrorMsg msg={error} /><OkMsg msg={ok} />
      <div className="card mb-3 px-4 py-3">
        <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4 xl:grid-cols-8">
          <div>
            <label htmlFor="res-f-estado" className="label-base">Estado</label>
            <Select id="res-f-estado" value={filtro.estado} onChange={v => setFiltro({ ...filtro, estado: v })}
              opciones={[{ value: "", label: "Todos" }, ...["CONFIRMADA", "EN_CURSO", "FINALIZADA", "CANCELADA"].map(e => ({ value: e, label: e.replaceAll("_", " ") }))]} />
          </div>
          <div>
            <label htmlFor="res-f-curso" className="label-base">Curso</label>
            <Select id="res-f-curso" value={filtro.cursoId} onChange={v => setFiltro({ ...filtro, cursoId: v })}
              opciones={[{ value: "", label: "Todos" }, ...cursos.map(c => ({ value: c.id, label: c.nombre }))]} />
          </div>
          <div>
            <label htmlFor="res-f-orden" className="label-base">Ordenar</label>
            <Select id="res-f-orden" value={filtro.orden} onChange={v => setFiltro({ ...filtro, orden: v })}
              opciones={[{ value: "desc", label: "Más recientes primero" }, { value: "asc", label: "Más antiguas primero" }]} />
          </div>
          <div>
            <label htmlFor="res-f-desde" className="label-base">Desde</label>
            <input id="res-f-desde" type="date" className="input-base" value={filtro.desde} onChange={e => setFiltro({ ...filtro, desde: e.target.value })} />
          </div>
          <div>
            <label htmlFor="res-f-hasta" className="label-base">Hasta</label>
            <input id="res-f-hasta" type="date" className="input-base" value={filtro.hasta} onChange={e => setFiltro({ ...filtro, hasta: e.target.value })} />
          </div>
          <div>
            <label htmlFor="res-f-codigo" className="label-base">Código</label>
            <input id="res-f-codigo" className="input-base" placeholder="SIF-…" value={filtro.codigo} onChange={e => setFiltro({ ...filtro, codigo: e.target.value })} />
          </div>
          <div className="col-span-2 flex items-end justify-end gap-2">
            <BotonLimpiar
              disabled={!filtro.estado && !filtro.cursoId && !filtro.codigo && !filtro.desde && !filtro.hasta}
              onClick={() => setFiltro({ ...FILTRO_INICIAL, orden: filtro.orden })}
            />
            <div className="flex gap-1 rounded-xl border border-gray-300 dark:border-night-600 bg-gray-50 dark:bg-night-800 p-1">
              {(["lista", "calendario"] as const).map(v => (
                <button
                  key={v}
                  onClick={() => { setVista(v); setSel(null); }}
                  className={`px-3.5 py-1.5 text-sm font-semibold rounded-lg transition ${vista === v ? "bg-primary text-white" : "text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-night-800"}`}
                >
                  {v === "lista" ? "Lista" : "Calendario"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {!reservas ? <Spinner /> : vista === "calendario" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_21rem]">
          <CalendarioMes
            mes={fechaCal} onMes={setFechaCal}
            eventosPorDia={eventosPorDia}
            selDia={selDia} onSelDia={setSelDia}
            leyenda={LEYENDA_CAL}
            className="min-h-[24rem] h-[calc(100vh-29rem)] sm:h-[calc(100vh-21rem)] xl:h-[calc(100vh-16rem)]"
          />
          <div>
            <div className="card flex min-h-[24rem] h-[calc(100vh-29rem)] sm:h-[calc(100vh-21rem)] xl:h-[calc(100vh-16rem)] flex-col self-start">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Reservas del día</h3>
              <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-200 capitalize">{fechaLarga(selDia)}</p>
              {reservasDia.length === 0 ? (
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
                <div className={`mt-3 min-h-0 flex-1 space-y-2 ${sel ? "overflow-hidden" : "overflow-auto"}`}>
                  {reservasDia.map(r => {
                    const estilo = r.incidenciaPendiente ? ESTILO_INCIDENCIA : ESTILO_CARD[r.estado] ?? ESTILO_CARD.FINALIZADA;
                    return (
                      <div key={r.id} className={`rounded-xl border-l-[6px] px-3 py-2.5 text-sm shadow-sm ${estilo.fondo}`}>
                        <div className="flex items-start justify-between gap-2">
                          <span className={`text-xs font-bold ${estilo.hora}`}>{fmtHora(r.iniciaAt)} – {fmtHora(r.terminaAt)}</span>
                          <EstadoBadge estado={r.estado} />
                        </div>
                        <div className="mt-0.5 font-semibold text-gray-900 dark:text-gray-100">{r.curso}</div>
                        <div className="mt-1.5 space-y-1 text-xs text-gray-700 dark:text-gray-300">
                          <Linea icon={ICONO.formador} color={estilo.hora}>Formador: {r.formador}</Linea>
                          <Linea icon={ICONO.persona} color={estilo.hora}>Docente: {r.docenteNombre}</Linea>
                          {r.aula && <Linea icon={ICONO.lugar} color={estilo.hora}>{r.aula}</Linea>}
                          {r.facultad && <Linea icon={ICONO.facultad} color={estilo.hora}>{r.facultad}</Linea>}
                          <Linea icon={ICONO.asistentes} color={estilo.hora}>{r.asistentes} asistente{r.asistentes === 1 ? "" : "s"}</Linea>
                        </div>
                        {r.incidenciaPendiente && <div className="mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">Incidencia de reasignación pendiente</div>}
                        <div className="mt-2 flex justify-end">
                          <button
                            className="rounded-lg border border-primary/40 dark:border-primary-soft/40 bg-white dark:bg-night-900 px-3 py-1 text-xs font-semibold text-primary dark:text-primary-soft transition hover:bg-primary/10 dark:hover:bg-primary/20"
                            onClick={() => verDetalle(r)}
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
      ) : (
        <div className="grid lg:grid-cols-5 gap-4">
          <div className="card lg:col-span-3 self-start p-0 overflow-hidden border-0">
            <div className="overflow-auto max-h-[70vh]">
              <table className="w-full">
                <thead><tr><th className="th sticky top-0">Código</th><th className="th sticky top-0">Curso</th><th className="th sticky top-0">Fecha</th><th className="th sticky top-0">Formador</th><th className="th sticky top-0">Estado</th><th className="th sticky top-0 text-center">Asist.</th></tr></thead>
                <tbody>
                  {reservas.length === 0 && (
                    <tr><td colSpan={6} className="td py-10 text-center text-gray-400 dark:text-gray-500">Sin reservas con estos filtros.</td></tr>
                  )}
                  {reservasPagina.map(r => (
                    <tr
                      key={r.id}
                      className={`border-t border-gray-100 dark:border-night-800 cursor-pointer transition ${sel?.id === r.id ? "bg-primary/5 dark:bg-primary/15" : "hover:bg-gray-50 dark:hover:bg-night-800"}`}
                      onClick={() => verDetalle(r)}
                    >
                      <td className="td font-mono">{r.codigo}</td>
                      <td className="td">{r.curso}</td>
                      <td className="td">{fmtFecha(r.iniciaAt)} {fmtHora(r.iniciaAt)}</td>
                      <td className="td">{r.formador}{r.incidenciaPendiente && <span className="badge-amarillo ml-1">incidencia</span>}</td>
                      <td className="td"><EstadoBadge estado={r.estado} /></td>
                      <td className="td text-center">{r.asistentes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {paginas > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 dark:border-night-800 px-4 py-3">
                <button className="btn-secondary text-xs" disabled={pagina === 0} onClick={() => setPaginaReservas(pagina - 1)}>‹ Anterior</button>
                <span className="text-xs text-gray-500 dark:text-gray-400">Página {pagina + 1} de {paginas}</span>
                <button className="btn-secondary text-xs" disabled={pagina >= paginas - 1} onClick={() => setPaginaReservas(pagina + 1)}>Siguiente ›</button>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {sel ? detalleReserva : <div className="card text-sm text-gray-500 dark:text-gray-400">Selecciona una reserva para ver el detalle.</div>}
          </div>
        </div>
      )}

      {vista === "calendario" && sel && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={() => setSel(null)}>
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-night-900 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className={`flex items-start justify-between gap-3 px-5 py-4 ${sel.incidenciaPendiente ? HEADER_INCIDENCIA : HEADER_ESTADO[sel.estado] ?? "bg-primary"}`}>
              <div className="min-w-0 text-white">
                <h3 className="truncate text-lg font-bold">{sel.curso}</h3>
                <p className="mt-0.5 font-mono text-xs text-white/70">{sel.codigo}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <EstadoBadge estado={sel.estado} />
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-white/25"
                  onClick={() => setSel(null)} aria-label="Cerrar"
                >✕</button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-auto p-5">
              {sel.incidenciaPendiente && (
                <div><span className="badge-amarillo">Incidencia de reasignación pendiente</span></div>
              )}
              {cargandoDetalle && <div className="text-xs text-gray-400 dark:text-gray-500 animate-pulse">Actualizando datos…</div>}

              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Dato label="Fecha">{fmtFecha(sel.iniciaAt)}</Dato>
                <Dato label="Horario">{fmtHora(sel.iniciaAt)}–{fmtHora(sel.terminaAt)}</Dato>
                <Dato label="Formador asignado">{sel.formador}{sel.formadorCorreo ? ` (${sel.formadorCorreo})` : ""}</Dato>
                <Dato label="Docente">{sel.docenteNombre}</Dato>
                <Dato label="Correo docente">{sel.docenteCorreo}</Dato>
                <Dato label="Teléfono docente">{sel.docenteTelefono ?? "—"}</Dato>
                <Dato label="Aula / lugar">{sel.aula ?? "—"}</Dato>
                <Dato label="Facultad">{sel.facultad ?? "—"}</Dato>
                <Dato label="Programa académico">{sel.programa ?? "—"}</Dato>
                <Dato label="Asistentes">{sel.asistentes}</Dato>
              </dl>

              {sel.estado === "CONFIRMADA" && (
                <div className="rounded-xl border border-red-100 dark:border-red-500/30 bg-red-50/60 dark:bg-red-500/10 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-red-400">Cancelar reserva</div>
                  <div className="mt-2 flex gap-2">
                    <input className="input-base flex-1" placeholder="Motivo de cancelación" value={motivo} onChange={e => setMotivo(e.target.value)} />
                    <button className="btn-danger" disabled={motivo.length < 3} onClick={cancelar}>Cancelar</button>
                  </div>
                </div>
              )}

              {qr && (
                <div className="rounded-xl border border-gray-200 dark:border-night-700 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold text-primary dark:text-primary-soft text-sm">QR de asistencia</h4>
                    <div className="flex gap-1"><EstadoBadge estado={qr.estado} /><EstadoBadge estado={qr.estadoEnvio} /></div>
                  </div>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <Dato label="Envío programado">{fmtFecha(qr.fechaEnvioProgramado)} {fmtHora(qr.fechaEnvioProgramado)}</Dato>
                    {qr.fechaEnvioReal && <Dato label="Enviado">{fmtFecha(qr.fechaEnvioReal)} {fmtHora(qr.fechaEnvioReal)} a {qr.destinatario}</Dato>}
                    <Dato label="Ventana de registro">{fmtHora(qr.fechaHabilitacion)}–{fmtHora(qr.fechaCierre)}</Dato>
                    <Dato label="Registros">{qr.asistencias} asistencias · {qr.evaluaciones} evaluaciones</Dato>
                  </dl>
                  {qr.ultimoError && <div className="mt-2 text-xs text-red-600 dark:text-red-400">{qr.ultimoError}</div>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn-secondary text-xs" onClick={() => toggleQr("cerrar")}>Cerrar registro</button>
                    <button className="btn-secondary text-xs" onClick={() => toggleQr("abrir")}>Reabrir</button>
                    <a className="btn-secondary text-xs" href={`/api/v1/admin/exportar/asistencia?reservaId=${sel.id}`}>Excel asistencia</a>
                  </div>
                </div>
              )}

              {asistentes.length > 0 && (
                <div className="rounded-xl border border-gray-200 dark:border-night-700 p-4">
                  <h4 className="font-semibold text-primary dark:text-primary-soft text-sm">Asistentes ({asistentes.length})</h4>
                  <div className="scroll-fino mt-2 max-h-56 space-y-1 overflow-auto pr-1">
                    {asistentes.map(a => (
                      <div key={a.id} className="rounded-lg border border-gray-100 dark:border-night-800 px-3 py-2 text-sm">
                        <div className="font-medium">{a.nombreCompleto} · {a.documento}{a.esDocente && <span className="badge-azul ml-2">Docente</span>}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{a.programa} · {a.correo}</div>
                        {a.evaluacion && <div className="text-xs">★ {a.evaluacion.calificacionGeneral}{resumenAspectos(a.evaluacion) && ` · ${resumenAspectos(a.evaluacion)}`}{a.evaluacion.observaciones && ` · ${a.evaluacion.observaciones}`}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
