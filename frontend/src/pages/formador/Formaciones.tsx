import { useEffect, useState } from "react";
import { api, mensajeError } from "../../api/client";
import { FormadorLayout } from "../../components/Layout";
import { Spinner, ErrorMsg, OkMsg, EstadoBadge, Select, fmtFecha, fmtHora } from "../../components/ui";
import { Curso } from "../../api/types";

interface MiReserva { id: string; codigo: string; curso: string; iniciaAt: string; terminaAt: string; estado: string; docenteNombre: string; docenteCorreo: string; docenteTelefono?: string | null; aula?: string | null; incidenciaPendiente: boolean; asistentes: number }
interface Asistente { id: string; nombreCompleto: string; documento: string; correo: string; programa: string; fechaRegistro: string; evaluacion: { calificacionGeneral: number } | null }

const FILTRO_INICIAL = { estado: "", cursoId: "", orden: "desc", desde: "", hasta: "" };

export default function Formaciones() {
  const [lista, setLista] = useState<MiReserva[] | null>(null);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [filtro, setFiltro] = useState(FILTRO_INICIAL);
  const [sel, setSel] = useState<MiReserva | null>(null);
  const [asistentes, setAsistentes] = useState<Asistente[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [reasig, setReasig] = useState({ motivo: "", observacion: "" });

  const cargar = () => {
    const params: Record<string, string> = {};
    if (filtro.estado) params.estado = filtro.estado;
    if (filtro.cursoId) params.cursoId = filtro.cursoId;
    params.orden = filtro.orden;
    if (filtro.desde) params.desde = filtro.desde;
    // "hasta" inclusivo: el backend filtra iniciaAt < hasta, se envía el día siguiente
    if (filtro.hasta) {
      const d = new Date(`${filtro.hasta}T00:00:00`);
      d.setDate(d.getDate() + 1);
      params.hasta = d.toISOString();
    }
    api.get("/formador/reservas", { params })
      .then(r => setLista(r.data))
      .catch(e => setError(mensajeError(e)));
  };
  useEffect(() => {
    api.get("/publico/cursos").then(r => setCursos(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

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
      cargar();
    } catch (e) { setError(mensajeError(e)); }
  };

  return (
    <FormadorLayout titulo="Mis formaciones">
      <ErrorMsg msg={error} /><OkMsg msg={ok} />
      <div className="card my-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Filtros{lista && <span className="normal-case font-normal text-gray-400"> · {lista.length} resultado{lista.length === 1 ? "" : "s"}</span>}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mt-4">
          <div>
            <label htmlFor="for-f-estado" className="label-base">Estado</label>
            <Select id="for-f-estado" value={filtro.estado} onChange={v => setFiltro({ ...filtro, estado: v })}
              opciones={[{ value: "", label: "Todos" }, ...["CONFIRMADA", "EN_CURSO", "FINALIZADA", "CANCELADA"].map(e => ({ value: e, label: e }))]} />
          </div>
          <div>
            <label htmlFor="for-f-curso" className="label-base">Curso</label>
            <Select id="for-f-curso" value={filtro.cursoId} onChange={v => setFiltro({ ...filtro, cursoId: v })}
              opciones={[{ value: "", label: "Todos" }, ...cursos.map(c => ({ value: c.id, label: c.nombre }))]} />
          </div>
          <div>
            <label htmlFor="for-f-orden" className="label-base">Ordenar</label>
            <Select id="for-f-orden" value={filtro.orden} onChange={v => setFiltro({ ...filtro, orden: v })}
              opciones={[{ value: "desc", label: "Más recientes primero" }, { value: "asc", label: "Más antiguas primero" }]} />
          </div>
          <div>
            <label htmlFor="for-f-desde" className="label-base">Desde</label>
            <input id="for-f-desde" type="date" className="input-base" value={filtro.desde} onChange={e => setFiltro({ ...filtro, desde: e.target.value })} />
          </div>
          <div>
            <label htmlFor="for-f-hasta" className="label-base">Hasta</label>
            <input id="for-f-hasta" type="date" className="input-base" value={filtro.hasta} onChange={e => setFiltro({ ...filtro, hasta: e.target.value })} />
          </div>
          <div className="flex items-end">
            <button
              className="btn-secondary w-full"
              disabled={!filtro.estado && !filtro.cursoId && !filtro.desde && !filtro.hasta}
              onClick={() => setFiltro({ ...FILTRO_INICIAL, orden: filtro.orden })}
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>

      {!lista ? <Spinner /> : (
        <div className="grid lg:grid-cols-5 gap-4">
          <div className="card lg:col-span-3 self-start p-0 overflow-hidden border-0">
            <div className="overflow-auto max-h-[70vh]">
              <table className="w-full">
                <thead><tr><th className="th sticky top-0">Código</th><th className="th sticky top-0">Curso</th><th className="th sticky top-0">Fecha</th><th className="th sticky top-0">Estado</th><th className="th sticky top-0 text-center">Asist.</th></tr></thead>
                <tbody>
                  {lista.length === 0 && (
                    <tr><td colSpan={5} className="td py-10 text-center text-gray-400">Sin formaciones con estos filtros.</td></tr>
                  )}
                  {lista.map(r => (
                    <tr
                      key={r.id}
                      className={`border-t border-gray-100 cursor-pointer transition ${sel?.id === r.id ? "bg-primary/5" : "hover:bg-gray-50"}`}
                      onClick={() => ver(r)}
                    >
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
