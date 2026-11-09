import { useEffect, useState } from "react";
import { api, mensajeError } from "../../api/client";
import { AdminLayout } from "../../components/Layout";
import { Spinner, ErrorMsg, TarjetaStat, Estrellas } from "../../components/ui";
import { StatsAdmin, Curso } from "../../api/types";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface FormadorMin { id: string; nombre: string }

const COLORES = ["#0A6A50", "#d97706", "#2563eb", "#dc2626", "#7c3aed"];

export default function Dashboard() {
  const [stats, setStats] = useState<StatsAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [formadores, setFormadores] = useState<FormadorMin[]>([]);
  const [f, setF] = useState({ desde: "", hasta: "", cursoId: "", formadorId: "", semestre: "", anio: "" });

  const cargar = () => {
    const params: Record<string, string> = {};
    if (f.desde) params.desde = new Date(f.desde).toISOString();
    if (f.hasta) params.hasta = new Date(f.hasta).toISOString();
    if (f.cursoId) params.cursoId = f.cursoId;
    if (f.formadorId) params.formadorId = f.formadorId;
    if (f.semestre) params.semestre = f.semestre;
    if (f.anio) params.anio = f.anio;
    api.get("/admin/estadisticas", { params })
      .then(r => setStats(r.data))
      .catch(e => setError(mensajeError(e)));
  };

  useEffect(() => {
    cargar();
    api.get("/publico/cursos").then(r => setCursos(r.data)).catch(() => {});
    api.get("/admin/formadores").then(r => setFormadores(r.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!stats) return <AdminLayout titulo="Dashboard"><Spinner /></AdminLayout>;
  const s = stats;

  const exportar = (tipo: string) => {
    const params = new URLSearchParams();
    if (f.desde) params.set("desde", new Date(f.desde).toISOString());
    if (f.hasta) params.set("hasta", new Date(f.hasta).toISOString());
    if (f.cursoId) params.set("cursoId", f.cursoId);
    if (f.formadorId) params.set("formadorId", f.formadorId);
    window.open(`/api/v1/admin/exportar/${tipo}?${params}`, "_blank");
  };

  return (
    <AdminLayout titulo="Dashboard">
      <ErrorMsg msg={error} />

      <div className="card mb-4 flex flex-wrap gap-3 items-end">
        <div><label className="label-base">Desde</label><input type="date" className="input-base" value={f.desde} onChange={e => setF({ ...f, desde: e.target.value })} /></div>
        <div><label className="label-base">Hasta</label><input type="date" className="input-base" value={f.hasta} onChange={e => setF({ ...f, hasta: e.target.value })} /></div>
        <div><label className="label-base">Curso</label>
          <select className="input-base" value={f.cursoId} onChange={e => setF({ ...f, cursoId: e.target.value })}>
            <option value="">Todos</option>{cursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select></div>
        <div><label className="label-base">Formador</label>
          <select className="input-base" value={f.formadorId} onChange={e => setF({ ...f, formadorId: e.target.value })}>
            <option value="">Todos</option>{formadores.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select></div>
        <div><label className="label-base">Semestre</label>
          <select className="input-base" value={f.semestre} onChange={e => setF({ ...f, semestre: e.target.value })}>
            <option value="">—</option><option value="1">Ene–Jun</option><option value="2">Jul–Dic</option>
          </select></div>
        <div><label className="label-base">Año</label><input type="number" className="input-base w-24" placeholder="2026" value={f.anio} onChange={e => setF({ ...f, anio: e.target.value })} /></div>
        <button className="btn-primary" onClick={cargar}>Filtrar</button>
        <button className="btn-secondary" onClick={() => exportar("estadisticas")}>Excel estadísticas</button>
        <button className="btn-secondary" onClick={() => exportar("reservas")}>Excel reservas</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <TarjetaStat titulo="Solicitadas" valor={s.reservas.solicitadas} />
        <TarjetaStat titulo="Confirmadas" valor={s.reservas.confirmadas} />
        <TarjetaStat titulo="Finalizadas" valor={s.reservas.finalizadas} />
        <TarjetaStat titulo="Canceladas" valor={s.reservas.canceladas} />
        <TarjetaStat titulo="Asistentes" valor={s.totalAsistentes} />
        <TarjetaStat titulo="Horas impartidas" valor={s.horasImpartidas} />
        <TarjetaStat titulo="Reasignaciones pendientes" valor={s.reasignacionesPendientes} />
        <TarjetaStat titulo="Finalizadas sin evaluación" valor={s.satisfaccion.finalizadasSinEvaluacion} />
      </div>

      <h2 className="font-semibold text-primary text-lg mt-6 mb-3">Satisfacción</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <TarjetaStat titulo="Calificación institucional" valor={s.satisfaccion.calificacionGeneral.promedio} sub={`${s.satisfaccion.calificacionGeneral.respuestas} respuestas`} />
        <TarjetaStat titulo="Evaluaciones" valor={s.satisfaccion.totalEvaluaciones} sub={`tasa de respuesta ${s.satisfaccion.tasaRespuesta ?? "—"}%`} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-semibold text-primary mb-3">Evolución de la satisfacción</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={s.satisfaccion.evolucion}>
              <XAxis dataKey="mes" /><YAxis domain={[0, 5]} /><Tooltip /><Legend />
              <Line name="Promedio" type="monotone" dataKey="promedio" stroke="#0A6A50" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="font-semibold text-primary mb-3">Distribución de valoraciones</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={s.satisfaccion.distribucion}>
              <XAxis dataKey="estrellas" /><YAxis allowDecimals={false} /><Tooltip />
              <Bar dataKey="cantidad" fill="#0A6A50" name="Respuestas" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="font-semibold text-primary mb-3">Promedio por curso</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={s.satisfaccion.porCurso} layout="vertical">
              <XAxis type="number" domain={[0, 5]} /><YAxis type="category" dataKey="nombre" width={130} /><Tooltip />
              <Bar dataKey="promedio" fill="#d97706" name="Promedio" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="font-semibold text-primary mb-3">Promedio por formador</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={s.satisfaccion.porFormador} layout="vertical">
              <XAxis type="number" domain={[0, 5]} /><YAxis type="category" dataKey="nombre" width={130} /><Tooltip />
              <Bar dataKey="promedio" fill="#2563eb" name="Promedio" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="font-semibold text-primary mb-3">Carga laboral por formador (horas)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={s.cargaPorFormador}>
              <XAxis dataKey="nombre" /><YAxis /><Tooltip />
              <Bar dataKey="horas" fill="#7c3aed" name="Horas" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="font-semibold text-primary mb-3">Cursos más solicitados</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={s.cursosMasSolicitados.slice(0, 6)} dataKey="reservas" nameKey="nombre" label>
                {s.cursosMasSolicitados.slice(0, 6).map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card mt-4">
        <h3 className="font-semibold text-primary mb-3">Observaciones de los estudiantes</h3>
        {s.satisfaccion.comentarios.length === 0 && <p className="text-sm text-gray-500">Sin observaciones en el período.</p>}
        <div className="space-y-3 max-h-96 overflow-auto">
          {s.satisfaccion.comentarios.map((c, i) => (
            <div key={i} className="border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Estrellas valor={c.calificacion} tamaño="text-sm" />
                <span>{c.curso} · {c.formador}</span>
              </div>
              {c.observaciones && <p className="text-sm mt-1">{c.observaciones}</p>}
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
