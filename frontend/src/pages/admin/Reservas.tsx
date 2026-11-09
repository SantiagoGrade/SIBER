import { useEffect, useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { api, mensajeError } from "../../api/client";
import { AdminLayout } from "../../components/Layout";
import { Spinner, ErrorMsg, OkMsg, EstadoBadge, fmtFecha, fmtHora } from "../../components/ui";
import { Reserva, EstadoQr, Curso } from "../../api/types";

const localizer = dateFnsLocalizer({ format, parse, startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }), getDay, locales: { es } });

interface Asistente { id: string; nombreCompleto: string; documento: string; correo: string; programa: string; fechaRegistro: string; evaluacion: { calificacionGeneral: number; observaciones: string | null } | null }
interface EvReserva { id: string; title: string; start: Date; end: Date; reserva: Reserva }

const COLOR_ESTADO: Record<Reserva["estado"], string> = {
  CONFIRMADA: "#0A6A50",
  FINALIZADA: "#6b7280",
  CANCELADA: "#dc2626",
};

export default function Reservas() {
  const [reservas, setReservas] = useState<Reserva[] | null>(null);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [filtro, setFiltro] = useState({ estado: "", cursoId: "" });
  const [vista, setVista] = useState<"lista" | "calendario">("lista");
  const [fechaCal, setFechaCal] = useState(new Date());
  const [vistaCal, setVistaCal] = useState<View>("month");
  const [sel, setSel] = useState<Reserva | null>(null);
  const [asistentes, setAsistentes] = useState<Asistente[]>([]);
  const [qr, setQr] = useState<EstadoQr | null>(null);
  const [motivo, setMotivo] = useState("");

  const cargar = () => {
    const params: Record<string, string> = {};
    if (filtro.estado) params.estado = filtro.estado;
    if (filtro.cursoId) params.cursoId = filtro.cursoId;
    api.get("/admin/reservas", { params })
      .then(r => setReservas(r.data))
      .catch(e => setError(mensajeError(e)));
  };
  useEffect(() => {
    api.get("/publico/cursos").then(r => setCursos(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  const verDetalle = async (r: Reserva) => {
    setSel(r); setAsistentes([]); setQr(null);
    const [a, q] = await Promise.all([
      api.get(`/admin/reservas/${r.id}/asistentes`).catch(() => ({ data: [] })),
      api.get(`/admin/reservas/${r.id}/qr`).catch(() => ({ data: null })),
    ]);
    setAsistentes(a.data); setQr(q.data);
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

  const eventos = useMemo<EvReserva[]>(() => (reservas ?? []).map(r => ({
    id: r.id,
    title: `${r.curso} · ${r.formador}`,
    start: new Date(r.iniciaAt),
    end: new Date(r.terminaAt),
    reserva: r,
  })), [reservas]);

  const estiloEvento = useMemo(() => (e: EvReserva) => ({
    style: {
      backgroundColor: COLOR_ESTADO[e.reserva.estado] ?? "#6b7280",
      color: "#fff",
      borderLeft: e.reserva.incidenciaPendiente ? "4px solid #f59e0b" : undefined,
    },
  }), []);

  const eventoMes = useMemo(() => ({ event }: { event: EvReserva }) => (
    <span
      className="cal-mes-ev"
      title={`${fmtHora(event.start)} ${event.title}${event.reserva.incidenciaPendiente ? " · incidencia" : ""}`}
    >
      <i
        className="cal-mes-dot"
        style={{ background: event.reserva.incidenciaPendiente ? "#f59e0b" : COLOR_ESTADO[event.reserva.estado] ?? "#6b7280" }}
      />
      <span className="cal-mes-hora">{fmtHora(event.start)}</span>
      <span className="cal-mes-titulo">{event.title}</span>
    </span>
  ), []);

  return (
    <AdminLayout titulo="Reservas">
      <ErrorMsg msg={error} /><OkMsg msg={ok} />
      <div className="card my-3 flex gap-3 items-end">
        <select className="input-base max-w-48" value={filtro.estado} onChange={e => setFiltro({ ...filtro, estado: e.target.value })}>
          <option value="">Todos los estados</option>
          <option>CONFIRMADA</option><option>FINALIZADA</option><option>CANCELADA</option>
        </select>
        <select className="input-base max-w-64" value={filtro.cursoId} onChange={e => setFiltro({ ...filtro, cursoId: e.target.value })}>
          <option value="">Todos los cursos</option>
          {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <div className="ml-auto flex gap-1 rounded-xl border border-gray-300 bg-gray-50 p-1">
          {(["lista", "calendario"] as const).map(v => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={`px-3.5 py-1.5 text-sm font-semibold rounded-lg transition ${vista === v ? "bg-primary text-white" : "text-gray-600 hover:bg-white"}`}
            >
              {v === "lista" ? "Lista" : "Calendario"}
            </button>
          ))}
        </div>
      </div>

      {!reservas ? <Spinner /> : (
        <div className="grid lg:grid-cols-5 gap-4">
          {vista === "calendario" && (
            <div className="card lg:col-span-3 h-[70vh] flex flex-col">
              <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-gray-600">
                <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full" style={{ background: "#0A6A50" }} />Confirmada</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full" style={{ background: "#6b7280" }} />Finalizada</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full" style={{ background: "#dc2626" }} />Cancelada</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full" style={{ background: "#f59e0b" }} />Incidencia</span>
              </div>
              <div className="sifoin-calendar flex-1 min-h-0">
                <Calendar
                  localizer={localizer} events={eventos} culture="es"
                  view={vistaCal} onView={setVistaCal} date={fechaCal} onNavigate={setFechaCal}
                  views={["month", "week", "day", "agenda"]}
                  popup
                  messages={{
                    today: "Hoy", previous: "‹", next: "›",
                    month: "Mes", week: "Semana", day: "Día", agenda: "Agenda",
                    date: "Fecha", time: "Hora", event: "Reserva",
                    noEventsInRange: "Sin reservas en este rango",
                    showMore: n => `+ ${n} más`,
                  }}
                  eventPropGetter={estiloEvento}
                  components={{ month: { event: eventoMes } }}
                  onSelectEvent={(e: object) => verDetalle((e as EvReserva).reserva)}
                />
              </div>
            </div>
          )}
          {vista === "lista" && (
          <div className="card lg:col-span-3 overflow-auto max-h-[70vh]">
            <table className="w-full">
              <thead><tr><th className="th">Código</th><th className="th">Curso</th><th className="th">Fecha</th><th className="th">Formador</th><th className="th">Estado</th><th className="th">Asist.</th></tr></thead>
              <tbody>
                {reservas.map(r => (
                  <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => verDetalle(r)}>
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
          )}

          <div className="lg:col-span-2 space-y-4">
            {sel ? (
              <>
                <div className="card">
                  <h3 className="font-semibold text-primary">{sel.codigo} — {sel.curso}</h3>
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
                    <h3 className="font-semibold text-primary">QR de asistencia</h3>
                    <div className="text-sm mt-2 space-y-1">
                      <div>Estado: <EstadoBadge estado={qr.estado} /> · Envío: <EstadoBadge estado={qr.estadoEnvio} /></div>
                      <div>Envío programado: {fmtFecha(qr.fechaEnvioProgramado)} {fmtHora(qr.fechaEnvioProgramado)}</div>
                      {qr.fechaEnvioReal && <div>Enviado: {fmtFecha(qr.fechaEnvioReal)} {fmtHora(qr.fechaEnvioReal)} a {qr.destinatario}</div>}
                      <div>Ventana registro: {fmtHora(qr.fechaHabilitacion)}–{fmtHora(qr.fechaCierre)}</div>
                      <div>{qr.asistencias} asistencias · {qr.evaluaciones} evaluaciones</div>
                      {qr.ultimoError && <div className="text-red-600 text-xs">{qr.ultimoError}</div>}
                      <div className="flex gap-2 pt-2">
                        <button className="btn-secondary" onClick={() => toggleQr("cerrar")}>Cerrar registro</button>
                        <button className="btn-secondary" onClick={() => toggleQr("abrir")}>Reabrir</button>
                        <a className="btn-secondary" href={`/api/v1/admin/exportar/asistencia?reservaId=${sel.id}`}>Excel asistencia</a>
                      </div>
                    </div>
                  </div>
                )}
                <div className="card">
                  <h3 className="font-semibold text-primary">Asistentes ({asistentes.length})</h3>
                  <div className="max-h-60 overflow-auto mt-2">
                    {asistentes.map(a => (
                      <div key={a.id} className="text-sm border-b border-gray-100 py-1.5">
                        <div className="font-medium">{a.nombreCompleto} · {a.documento}</div>
                        <div className="text-gray-500 text-xs">{a.programa} · {a.correo}</div>
                        {a.evaluacion && <div className="text-xs">★ {a.evaluacion.calificacionGeneral}{a.evaluacion.observaciones && ` · ${a.evaluacion.observaciones}`}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : <div className="card text-sm text-gray-500">Selecciona una reserva para ver el detalle.</div>}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
