import { useEffect, useState } from "react";
import { api, mensajeError } from "../../api/client";
import { AdminLayout } from "../../components/Layout";
import { Spinner, ErrorMsg, TarjetaStat, Select } from "../../components/ui";
import { StatsAdmin, Curso } from "../../api/types";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

import {
  TarjetaGrafica, COLORES, TOOLTIP_STYLE, TICK_EJE, TICK_EJE_SM, AXIS_LINE,
  fmtMesLargo, fmtMesCorto, etiquetaMes, mesesEntre, cortar,
} from "../../components/graficas";

interface FormadorMin { id: string; nombre: string }

export default function Dashboard() {
  const [stats, setStats] = useState<StatsAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [formadores, setFormadores] = useState<FormadorMin[]>([]);
  const [f, setF] = useState({ desde: "", hasta: "", cursoId: "", formadorId: "", semestre: "", anio: "" });

  useEffect(() => {
    api.get("/publico/cursos").then(r => setCursos(r.data)).catch(() => {});
    api.get("/admin/formadores").then(r => setFormadores(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (f.desde) params.desde = new Date(f.desde).toISOString();
    if (f.hasta) params.hasta = new Date(f.hasta).toISOString();
    if (f.cursoId) params.cursoId = f.cursoId;
    if (f.formadorId) params.formadorId = f.formadorId;
    if (f.semestre) params.semestre = f.semestre;
    if (/^\d{4}$/.test(f.anio)) params.anio = f.anio;
    const t = setTimeout(() => {
      api.get("/admin/estadisticas", { params })
        .then(r => setStats(r.data))
        .catch(e => setError(mensajeError(e)));
    }, 400);
    return () => clearTimeout(t);
  }, [f]);

  if (!stats) return <AdminLayout titulo="Dashboard"><Spinner /></AdminLayout>;
  const s = stats;

  const totalesPorMes = new Map(s.reservasPorMes.map(d => [d.mes, d.total]));
  let mesMin = s.reservasPorMes[0]?.mes;
  let mesMax = s.reservasPorMes[s.reservasPorMes.length - 1]?.mes;
  if (f.anio) {
    mesMin = `${f.anio}-${f.semestre === "2" ? "07" : "01"}`;
    mesMax = `${f.anio}-${f.semestre === "1" ? "06" : "12"}`;
  }
  if (f.desde) mesMin = f.desde.slice(0, 7);
  if (f.hasta) mesMax = f.hasta.slice(0, 7);
  const demandaMensual = mesMin && mesMax && mesMin <= mesMax
    ? mesesEntre(mesMin, mesMax).map(mes => ({ mes, total: totalesPorMes.get(mes) ?? 0 }))
    : [];
  const mesPico = demandaMensual.reduce<typeof demandaMensual[number] | null>(
    (p, d) => (!p || d.total > p.total ? d : p), null);

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

      <div className="card mb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
        <div><label className="label-base">Desde</label><input type="date" className="input-base" value={f.desde} onChange={e => setF({ ...f, desde: e.target.value })} /></div>
        <div><label className="label-base">Hasta</label><input type="date" className="input-base" value={f.hasta} onChange={e => setF({ ...f, hasta: e.target.value })} /></div>
        <div><label className="label-base">Curso</label>
          <Select value={f.cursoId} onChange={v => setF({ ...f, cursoId: v })}
            opciones={[{ value: "", label: "Todos" }, ...cursos.map(c => ({ value: c.id, label: c.nombre }))]} /></div>
        <div><label className="label-base">Formador</label>
          <Select value={f.formadorId} onChange={v => setF({ ...f, formadorId: v })}
            opciones={[{ value: "", label: "Todos" }, ...formadores.map(x => ({ value: x.id, label: x.nombre }))]} /></div>
        <div><label className="label-base">Semestre</label>
          <Select value={f.semestre} onChange={v => setF({ ...f, semestre: v })}
            opciones={[{ value: "", label: "—" }, { value: "1", label: "Ene–Jun" }, { value: "2", label: "Jul–Dic" }]} /></div>
        <div><label className="label-base">Año</label><input type="number" className="input-base" placeholder="2026" value={f.anio} onChange={e => setF({ ...f, anio: e.target.value })} /></div>
        <div className="col-span-2 sm:col-span-3 lg:col-span-6 flex flex-wrap gap-3 justify-end">
          <button className="btn-secondary" onClick={() => exportar("estadisticas")}>Excel estadísticas</button>
          <button className="btn-secondary" onClick={() => exportar("reservas")}>Excel reservas</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <TarjetaStat titulo="Solicitadas" valor={s.reservas.solicitadas} />
        <TarjetaStat titulo="Confirmadas" valor={s.reservas.confirmadas} />
        <TarjetaStat titulo="En curso" valor={s.reservas.enCurso} />
        <TarjetaStat titulo="Finalizadas" valor={s.reservas.finalizadas} />
        <TarjetaStat titulo="Canceladas" valor={s.reservas.canceladas} />
        <TarjetaStat titulo="Asistentes" valor={s.totalAsistentes} />
        <TarjetaStat titulo="Horas impartidas" valor={s.horasImpartidas} />
        <TarjetaStat titulo="Reasignaciones pendientes" valor={s.reasignacionesPendientes} />
        <TarjetaStat titulo="Finalizadas sin evaluación" valor={s.satisfaccion.finalizadasSinEvaluacion} />
        <TarjetaStat titulo="Calificación institucional" valor={s.satisfaccion.calificacionGeneral.promedio} sub={`${s.satisfaccion.calificacionGeneral.respuestas} respuestas`} />
        <TarjetaStat titulo="Evaluaciones" valor={s.satisfaccion.totalEvaluaciones} sub={`tasa de respuesta ${s.satisfaccion.tasaRespuesta ?? "—"}%`} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <TarjetaGrafica titulo="Calificación promedio por mes" sub="Estrellas promedio (1 a 5) que dejaron los asistentes en cada mes">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={s.satisfaccion.evolucion} margin={{ left: -18, right: 12, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="mes" tickFormatter={fmtMesCorto} tick={TICK_EJE} tickLine={false} axisLine={AXIS_LINE} />
              <YAxis domain={[0, 5]} tick={TICK_EJE} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={fmtMesLargo} formatter={(v, _n, item) => [`${v ?? "—"} ★ (${item?.payload?.respuestas ?? 0} respuestas)`, "Promedio"]} />
              <Line name="Promedio" type="monotone" dataKey="promedio" stroke="#0A6A50" strokeWidth={2.5} dot={{ r: 3, fill: "#0A6A50" }} />
            </LineChart>
          </ResponsiveContainer>
        </TarjetaGrafica>

        <TarjetaGrafica titulo="Distribución de valoraciones" sub="Respuestas por cantidad de estrellas">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={s.satisfaccion.distribucion} margin={{ left: -18, right: 12, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="estrellas" tick={TICK_EJE} tickLine={false} axisLine={AXIS_LINE} />
              <YAxis allowDecimals={false} tick={TICK_EJE} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, "Respuestas"]} labelFormatter={v => `${v} ★`} />
              <Bar dataKey="cantidad" fill="#0A6A50" name="Respuestas" radius={[10, 10, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </TarjetaGrafica>

        <TarjetaGrafica titulo="Promedio por curso" sub="Calificación media (0 a 5)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={s.satisfaccion.porCurso} margin={{ left: -18, right: 12, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="nombre" tickFormatter={cortar} interval={0} angle={-20} textAnchor="end" height={56} tick={TICK_EJE_SM} tickLine={false} axisLine={AXIS_LINE} />
              <YAxis domain={[0, 5]} tick={TICK_EJE} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, "Promedio"]} />
              <Bar dataKey="promedio" fill="#d97706" name="Promedio" radius={[10, 10, 0, 0]} maxBarSize={56} />
            </BarChart>
          </ResponsiveContainer>
        </TarjetaGrafica>

        <TarjetaGrafica titulo="Promedio por formador" sub="Calificación media (0 a 5)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={s.satisfaccion.porFormador} margin={{ left: -18, right: 12, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="nombre" tickFormatter={cortar} interval={0} angle={-20} textAnchor="end" height={56} tick={TICK_EJE_SM} tickLine={false} axisLine={AXIS_LINE} />
              <YAxis domain={[0, 5]} tick={TICK_EJE} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, "Promedio"]} />
              <Bar dataKey="promedio" fill="#0A6A70" name="Promedio" radius={[10, 10, 0, 0]} maxBarSize={56} />
            </BarChart>
          </ResponsiveContainer>
        </TarjetaGrafica>

        <TarjetaGrafica titulo="Carga laboral por formador" sub="Horas de formación no canceladas">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={s.cargaPorFormador} margin={{ left: -18, right: 12, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="nombre" tickFormatter={cortar} interval={0} angle={-20} textAnchor="end" height={56} tick={TICK_EJE_SM} tickLine={false} axisLine={AXIS_LINE} />
              <YAxis tick={TICK_EJE} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, "Horas"]} />
              <Bar dataKey="horas" fill="#7c3aed" name="Horas" radius={[10, 10, 0, 0]} maxBarSize={56} />
            </BarChart>
          </ResponsiveContainer>
        </TarjetaGrafica>

        <TarjetaGrafica titulo="Cursos más solicitados" sub="Top 6 por número de reservas">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={s.cursosMasSolicitados.slice(0, 6)} dataKey="reservas" nameKey="nombre" label innerRadius={48} outerRadius={88} paddingAngle={3}>
                {s.cursosMasSolicitados.slice(0, 6).map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </TarjetaGrafica>
      </div>

      <div className="mt-4">
      <TarjetaGrafica
        ancha
        titulo="Solicitudes por mes"
        sub={mesPico ? `Mes pico: ${fmtMesLargo(mesPico.mes)} · ${mesPico.total} solicitudes` : "Sin reservas en el período"}
      >
        <ResponsiveContainer width="100%" height={210}>
          <AreaChart data={demandaMensual} margin={{ left: -18, right: 12, top: 4 }}>
            <defs>
              <linearGradient id="gradDemanda" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0A6A50" stopOpacity={0.85} />
                <stop offset="100%" stopColor="#ADE498" stopOpacity={0.15} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="mes" tickFormatter={etiquetaMes} interval={0} angle={-45} textAnchor="end" height={68} tick={TICK_EJE_SM} tickLine={false} axisLine={AXIS_LINE} />
            <YAxis allowDecimals={false} tick={TICK_EJE} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={fmtMesLargo} formatter={(v) => [v, "Solicitudes"]} />
            <Area name="Solicitudes" type="monotone" dataKey="total" stroke="#0A6A50" strokeWidth={2.5} fill="url(#gradDemanda)" dot={{ r: 3, fill: "#0A6A50" }} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </TarjetaGrafica>
      </div>
    </AdminLayout>
  );
}
