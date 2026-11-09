import { useEffect, useState } from "react";
import { api, mensajeError } from "../../api/client";
import { FormadorLayout } from "../../components/Layout";
import { Spinner, ErrorMsg, OkMsg, EstadoBadge, fmtFecha, fmtHora } from "../../components/ui";

interface MiReserva { id: string; codigo: string; curso: string; iniciaAt: string; terminaAt: string; estado: string; docenteNombre: string; docenteCorreo: string; docenteTelefono?: string | null; aula?: string | null; incidenciaPendiente: boolean; asistentes: number }
interface Asistente { id: string; nombreCompleto: string; documento: string; correo: string; programa: string; fechaRegistro: string; evaluacion: { calificacionGeneral: number } | null }

export default function Formaciones() {
  const [lista, setLista] = useState<MiReserva[] | null>(null);
  const [sel, setSel] = useState<MiReserva | null>(null);
  const [asistentes, setAsistentes] = useState<Asistente[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [reasig, setReasig] = useState({ motivo: "", observacion: "" });

  useEffect(() => {
    api.get("/formador/reservas").then(r => setLista(r.data)).catch(e => setError(mensajeError(e)));
  }, []);

  const ver = async (r: MiReserva) => {
    setSel(r); setError(null);
    const a = await api.get(`/formador/reservas/${r.id}/asistentes`).catch(() => ({ data: [] }));
    setAsistentes(a.data);
  };

  const pedirReasignacion = async () => {
    if (!sel) return;
    try {
      await api.post("/formador/reasignaciones", { reservaId: sel.id, motivo: reasig.motivo, observacion: reasig.observacion || undefined });
      setOk("Solicitud de reasignación enviada"); setReasig({ motivo: "", observacion: "" });
      api.get("/formador/reservas").then(r => setLista(r.data));
    } catch (e) { setError(mensajeError(e)); }
  };

  return (
    <FormadorLayout titulo="Mis formaciones">
      <ErrorMsg msg={error} /><OkMsg msg={ok} />
      {!lista ? <Spinner /> : (
        <div className="grid lg:grid-cols-5 gap-4 mt-3">
          <div className="card lg:col-span-3 overflow-auto max-h-[70vh]">
            <table className="w-full">
              <thead><tr><th className="th">Código</th><th className="th">Curso</th><th className="th">Fecha</th><th className="th">Estado</th><th className="th">Asist.</th></tr></thead>
              <tbody>
                {lista.map(r => (
                  <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => ver(r)}>
                    <td className="td font-mono">{r.codigo}</td>
                    <td className="td">{r.curso}</td>
                    <td className="td">{fmtFecha(r.iniciaAt)} {fmtHora(r.iniciaAt)}</td>
                    <td className="td"><EstadoBadge estado={r.estado} />{r.incidenciaPendiente && <span className="badge-amarillo ml-1">incidencia</span>}</td>
                    <td className="td text-center">{r.asistentes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {sel ? (
              <>
                <div className="card">
                  <h3 className="font-semibold text-primary">{sel.codigo} — {sel.curso}</h3>
                  <div className="text-sm mt-1">{fmtFecha(sel.iniciaAt)} {fmtHora(sel.iniciaAt)}–{fmtHora(sel.terminaAt)} · {sel.docenteNombre}</div>
                  <div className="text-sm mt-1 space-y-1">
                    {sel.aula && <div><strong>Aula / lugar:</strong> {sel.aula}</div>}
                    {sel.docenteTelefono && <div><strong>Teléfono docente:</strong> {sel.docenteTelefono}</div>}
                    <div><strong>Correo docente:</strong> {sel.docenteCorreo}</div>
                  </div>
                  <div className="flex gap-2 pt-3">
                    <a className="btn-secondary text-xs" href={`/api/v1/formador/reservas/${sel.id}/asistentes/exportar`}>Excel asistencia</a>
                  </div>
                </div>
                {sel.estado === "CONFIRMADA" && !sel.incidenciaPendiente && (
                  <div className="card">
                    <h4 className="font-semibold text-primary text-sm">Solicitar reasignación por calamidad</h4>
                    <input className="input-base mt-2" placeholder="Motivo (obligatorio)" value={reasig.motivo} onChange={e => setReasig({ ...reasig, motivo: e.target.value })} />
                    <textarea className="input-base mt-2" rows={2} placeholder="Observación" value={reasig.observacion} onChange={e => setReasig({ ...reasig, observacion: e.target.value })} />
                    <button className="btn-secondary mt-2 text-xs" disabled={reasig.motivo.length < 5} onClick={pedirReasignacion}>Enviar solicitud</button>
                  </div>
                )}
                <div className="card">
                  <h4 className="font-semibold text-primary text-sm">Asistentes ({asistentes.length})</h4>
                  <div className="max-h-60 overflow-auto mt-2">
                    {asistentes.map(a => (
                      <div key={a.id} className="text-sm border-b border-gray-100 py-1.5">
                        <div className="font-medium">{a.nombreCompleto} · {a.documento}</div>
                        <div className="text-xs text-gray-500">{a.programa}{a.evaluacion && ` · ★${a.evaluacion.calificacionGeneral}`}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : <div className="card text-sm text-gray-500">Selecciona una formación.</div>}
          </div>
        </div>
      )}
    </FormadorLayout>
  );
}
