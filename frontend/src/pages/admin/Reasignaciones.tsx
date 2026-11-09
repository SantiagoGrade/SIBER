import { useEffect, useMemo, useState } from "react";
import { api, mensajeError } from "../../api/client";
import { AdminLayout } from "../../components/Layout";
import { Spinner, ErrorMsg, OkMsg, EstadoBadge, fmtFechaHora, fmtFecha, fmtHora } from "../../components/ui";
import { Reasignacion } from "../../api/types";

interface Reemplazo { formadorId: string; nombre: string; ocupacion: number; minutosOcupados: number }
interface Alt { inicio: string; fin: string }

const enCA = (d: string | Date) => new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
const ACCIONABLES = new Set(["PENDIENTE", "SIN_REEMPLAZO"]);

export default function Reasignaciones() {
  const [lista, setLista] = useState<Reasignacion[] | null>(null);
  const [sel, setSel] = useState<Reasignacion | null>(null);
  const [reemplazos, setReemplazos] = useState<Reemplazo[]>([]);
  const [alternativas, setAlternativas] = useState<Alt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [propuesta, setPropuesta] = useState({ fecha: "", inicio: "", fin: "" });
  const [mesVisible, setMesVisible] = useState(() => {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  });

  const accionable = sel ? ACCIONABLES.has(sel.estado) : false;

  const cargar = () => api.get("/admin/reasignaciones").then(r => setLista(r.data)).catch(e => setError(mensajeError(e)));
  useEffect(() => { cargar(); }, []);

  const ver = async (s: Reasignacion) => {
    setSel(s); setError(null); setMotivo("");
    setPropuesta({ fecha: "", inicio: "", fin: "" });
    setReemplazos([]); setAlternativas([]);
    if (!ACCIONABLES.has(s.estado)) return;
    const [r, a] = await Promise.all([
      api.get(`/admin/reasignaciones/${s.id}/reemplazos`).catch(() => ({ data: [] })),
      api.get(`/admin/reasignaciones/${s.id}/alternativas`, { params: { dias: 30 } }).catch(() => ({ data: [] })),
    ]);
    setReemplazos(r.data); setAlternativas(a.data);
  };

  const actuar = async (accion: string, body?: object) => {
    if (!sel) return;
    try {
      await api.post(`/admin/reasignaciones/${sel.id}/${accion}`, body);
      setOk("Operación realizada"); setSel(null); cargar();
    } catch (e) { setError(mensajeError(e)); }
  };

  const cancelarReserva = async () => {
    if (!sel) return;
    try {
      await api.post(`/admin/reservas/${sel.reserva.id}/cancelar`, { motivo });
      setOk("Reserva cancelada; el docente fue notificado");
      setSel(null); setMotivo(""); cargar();
    } catch (e) { setError(mensajeError(e)); }
  };

  // Días con al menos un formador elegible (mismo horario de la reserva original)
  const diasPosibles = useMemo(
    () => new Set(alternativas.map(a => enCA(a.inicio))),
    [alternativas],
  );

  const celdas = useMemo(() => {
    const y = mesVisible.getFullYear(), m = mesVisible.getMonth();
    const offset = (new Date(y, m, 1).getDay() + 6) % 7;
    const total = new Date(y, m + 1, 0).getDate();
    const arr: (Date | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= total; d++) arr.push(new Date(y, m, d));
    return arr;
  }, [mesVisible]);

  const { mesMin, mesMax } = useMemo(() => {
    const hoy = new Date();
    const tope = new Date(Date.now() + 30 * 86400000);
    return {
      mesMin: new Date(hoy.getFullYear(), hoy.getMonth(), 1),
      mesMax: new Date(tope.getFullYear(), tope.getMonth(), 1),
    };
  }, []);

  const elegirDia = (d: Date) => {
    const alt = alternativas.find(a => enCA(a.inicio) === enCA(d));
    if (!alt) return;
    setPropuesta({ fecha: enCA(d), inicio: fmtHora(alt.inicio), fin: fmtHora(alt.fin) });
  };

  const propuestaVigente = sel?.propuestas?.find(p => p.estado === "PENDIENTE");
  const propuestaAceptada = sel?.propuestas?.find(p => p.estado === "ACEPTADA");

  return (
    <AdminLayout titulo="Reasignaciones por calamidad">
      <ErrorMsg msg={error} /><OkMsg msg={ok} />
      {!lista ? <Spinner /> : (
        <div className="grid lg:grid-cols-5 gap-4 mt-3">
          <div className="card lg:col-span-2 space-y-2 max-h-[70vh] overflow-auto">
            {lista.map(s => (
              <button key={s.id} onClick={() => ver(s)}
                className={`w-full text-left rounded-xl border p-3 ${sel?.id === s.id ? "border-primary bg-primary/10" : "border-gray-200"}`}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{s.reserva.codigo} · {s.reserva.curso}</span>
                  <EstadoBadge estado={s.estado} />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {s.solicitante} · {fmtFechaHora(s.reserva.iniciaAt)} · {s.motivo}
                </div>
              </button>
            ))}
            {!lista.length && <p className="text-sm text-gray-500">No hay solicitudes.</p>}
          </div>

          <div className="lg:col-span-3 space-y-4">
            {sel ? (
              <>
                <div className="card">
                  <h3 className="font-semibold text-primary">{sel.reserva.codigo} — {sel.reserva.curso}</h3>
                  <div className="text-sm mt-1">
                    {fmtFecha(sel.reserva.iniciaAt)} {fmtHora(sel.reserva.iniciaAt)}–{fmtHora(sel.reserva.terminaAt)} ·
                    Docente: {sel.reserva.docenteNombre}
                  </div>
                  <div className="text-sm mt-1"><strong>Motivo:</strong> {sel.motivo} {sel.observacion && `— ${sel.observacion}`}</div>
                </div>

                {!accionable && (
                  <div className="card">
                    <h3 className="font-semibold text-primary mb-2">Estado de la solicitud</h3>
                    <EstadoBadge estado={sel.estado} />
                    {sel.estado === "PENDIENTE_RESPUESTA_DOCENTE" && propuestaVigente && (
                      <p className="text-sm text-gray-600 mt-2">
                        Esperando respuesta del docente a la propuesta del{" "}
                        {fmtFecha(propuestaVigente.iniciaAt)} {fmtHora(propuestaVigente.iniciaAt)}–{fmtHora(propuestaVigente.terminaAt)}.
                      </p>
                    )}
                    {sel.estado === "APROBADA" && sel.reemplazoSugerido && (
                      <p className="text-sm text-gray-600 mt-2">Reemplazo asignado: {sel.reemplazoSugerido}.</p>
                    )}
                    {sel.estado === "RESUELTA" && propuestaAceptada && (
                      <p className="text-sm text-gray-600 mt-2">
                        El docente aceptó la propuesta del{" "}
                        {fmtFecha(propuestaAceptada.iniciaAt)} {fmtHora(propuestaAceptada.iniciaAt)}–{fmtHora(propuestaAceptada.terminaAt)}.
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">La solicitud ya no admite acciones.</p>
                  </div>
                )}

                {accionable && (
                  <>
                    <div className="card">
                      <h3 className="font-semibold text-primary mb-2">Reemplazos elegibles (menor ocupación primero)</h3>
                      {reemplazos.length === 0 && <p className="text-sm text-gray-500">No hay formadores elegibles en la misma franja.</p>}
                      {reemplazos.map(r => (
                        <div key={r.formadorId} className="flex items-center justify-between border-b border-gray-100 py-2 text-sm">
                          <span>{r.nombre} <span className="text-gray-400">· ocupación {r.ocupacion.toFixed(1)}%</span></span>
                          <button className="btn-primary text-xs" onClick={() => actuar("aprobar", { formadorId: r.formadorId })}>Aprobar</button>
                        </div>
                      ))}
                    </div>

                    <div className="card">
                      <h3 className="font-semibold text-primary mb-2">Proponer nueva fecha al docente</h3>
                      {alternativas.length === 0 ? (
                        <p className="text-sm text-gray-500">No hay fechas alternativas con formadores disponibles en los próximos 30 días.</p>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-xl border border-gray-200 p-3">
                            <div className="flex items-center justify-between mb-2">
                              <button type="button" className="btn-secondary px-3 py-1" disabled={mesVisible <= mesMin}
                                onClick={() => setMesVisible(new Date(mesVisible.getFullYear(), mesVisible.getMonth() - 1, 1))}>‹</button>
                              <div className="font-medium text-primary capitalize">
                                {mesVisible.toLocaleDateString("es-CO", { month: "long", year: "numeric" })}
                              </div>
                              <button type="button" className="btn-secondary px-3 py-1" disabled={mesVisible >= mesMax}
                                onClick={() => setMesVisible(new Date(mesVisible.getFullYear(), mesVisible.getMonth() + 1, 1))}>›</button>
                            </div>
                            <div className="grid grid-cols-7 text-center text-xs text-gray-500 mb-1">
                              {["L", "M", "X", "J", "V", "S", "D"].map(d => <div key={d} className="py-1 font-medium">{d}</div>)}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                              {celdas.map((d, i) => {
                                if (!d) return <div key={`v-${i}`} />;
                                const key = enCA(d);
                                const disp = diasPosibles.has(key);
                                const activo = key === propuesta.fecha;
                                return (
                                  <button key={key} type="button" disabled={!disp} onClick={() => elegirDia(d)}
                                    className={`aspect-square rounded-lg text-sm transition ${
                                      activo ? "bg-primary text-white font-semibold"
                                      : disp ? "bg-accent/40 text-primary hover:bg-accent font-medium"
                                      : "text-gray-300 cursor-not-allowed"}`}>
                                    {d.getDate()}
                                  </button>
                                );
                              })}
                            </div>
                            <p className="text-xs text-gray-400 mt-2">Los días marcados tienen formadores disponibles.</p>
                          </div>

                          <div>
                            {!propuesta.fecha ? (
                              <p className="text-sm text-gray-500">Elige un día en el calendario para proponer la nueva fecha.</p>
                            ) : (
                              <>
                                <div className="label-base mb-2 capitalize">
                                  {new Date(`${propuesta.fecha}T12:00:00-05:00`).toLocaleDateString("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long" })}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="label-base">Inicio</label>
                                    <input type="time" className="input-base" value={propuesta.inicio}
                                      onChange={e => setPropuesta({ ...propuesta, inicio: e.target.value })} />
                                  </div>
                                  <div>
                                    <label className="label-base">Fin</label>
                                    <input type="time" className="input-base" value={propuesta.fin}
                                      onChange={e => setPropuesta({ ...propuesta, fin: e.target.value })} />
                                  </div>
                                </div>
                                <button className="btn-primary mt-3 w-full" disabled={!propuesta.inicio || !propuesta.fin}
                                  onClick={() => actuar("proponer-fecha", {
                                    iniciaAt: new Date(`${propuesta.fecha}T${propuesta.inicio}:00-05:00`).toISOString(),
                                    terminaAt: new Date(`${propuesta.fecha}T${propuesta.fin}:00-05:00`).toISOString(),
                                  })}>Enviar propuesta</button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="card">
                      <h3 className="font-semibold text-primary mb-2">Otras acciones</h3>
                      <div className="flex gap-2 items-center flex-wrap">
                        <input className="input-base flex-1 min-w-40" placeholder="Motivo" value={motivo} onChange={e => setMotivo(e.target.value)} />
                        <button className="btn-secondary" onClick={() => actuar("sin-reemplazo")}>Marcar sin reemplazo</button>
                        <button className="btn-secondary" disabled={motivo.length < 3} onClick={() => actuar("rechazar", { motivo })}>Rechazar solicitud</button>
                        <button className="btn-danger" disabled={motivo.length < 3} onClick={cancelarReserva}>Cancelar reserva</button>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">“Rechazar solicitud” descarta la petición y la reserva sigue vigente; “Cancelar reserva” anula la formación y notifica al docente.</p>
                    </div>
                  </>
                )}
              </>
            ) : <div className="card text-sm text-gray-500">Selecciona una solicitud.</div>}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
