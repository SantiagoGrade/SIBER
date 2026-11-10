import { useEffect, useState } from "react";
import { api, mensajeError } from "../../api/client";
import { FormadorLayout } from "../../components/Layout";
import { Spinner, ErrorMsg, TarjetaStat, Select } from "../../components/ui";
import {
  TarjetaGrafica, SinDatos, COLORES, TOOLTIP_STYLE, TICK_EJE, TICK_EJE_SM, AXIS_LINE,
  fmtMesLargo, fmtMesCorto, etiquetaMes, mesesEntre, cortar,
} from "../../components/graficas";
import { StatsFormador, Curso } from "../../api/types";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

export default function DashboardFormador() {
  const [s, setS] = useState<StatsFormador | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [f, setF] = useState({ desde: "", hasta: "", cursoId: "", semestre: "", anio: "" });

  useEffect(() => {
    api.get("/publico/cursos").then(r => setCursos(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (f.desde) params.desde = new Date(f.desde).toISOString();
    if (f.hasta) params.hasta = new Date(f.hasta).toISOString();
    if (f.cursoId) params.cursoId = f.cursoId;
    if (f.semestre) params.semestre = f.semestre;
    if (/^\d{4}$/.test(f.anio)) params.anio = f.anio;
    const t = setTimeout(() => {
      api.get("/formador/dashboard", { params })
        .then(r => { setS(r.data); setError(null); })
        .catch(e => setError(mensajeError(e)));
    }, 400);
    return () => clearTimeout(t);
  }, [f]);

  if (!s) return <FormadorLayout titulo="Mi dashboard"><Spinner /><ErrorMsg msg={error} /></FormadorLayout>;

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
  const topCursos = s.cursosMasSolicitados.slice(0, 6);

  return (
    <FormadorLayout titulo="Mi dashboard">
      <ErrorMsg msg={error} />

      <div className="card mb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
        <div><label className="label-base">Desde</label><input type="date" className="input-base" value={f.desde} onChange={e => setF({ ...f, desde: e.target.value })} /></div>
        <div><label className="label-base">Hasta</label><input type="date" className="input-base" value={f.hasta} onChange={e => setF({ ...f, hasta: e.target.value })} /></div>
        <div><label className="label-base">Curso</label>
          <Select value={f.cursoId} onChange={v => setF({ ...f, cursoId: v })}
            opciones={[{ value: "", label: "Todos" }, ...cursos.map(c => ({ value: c.id, label: c.nombre }))]} /></div>
        <div><label className="label-base">Semestre</label>
          <Select value={f.semestre} onChange={v => setF({ ...f, semestre: v })}
            opciones={[{ value: "", label: "—" }, { value: "1", label: "Ene–Jun" }, { value: "2", label: "Jul–Dic" }]} /></div>
        <div><label className="label-base">Año</label><input type="number" className="input-base" placeholder="2026" value={f.anio} onChange={e => setF({ ...f, anio: e.target.value })} /></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <TarjetaStat titulo="Formaciones impartidas" valor={s.formacionesImpartidas} />
        <TarjetaStat titulo="Horas esta semana" valor={s.horasEstaSemana} sub={`de ${s.horasDisponiblesSemana} h disponibles`} />
        <TarjetaStat titulo="Ocupación semanal" valor={s.ocupacionSemana !== null ? `${s.ocupacionSemana}%` : "—"} />
        <TarjetaStat titulo="Próximas" valor={s.reservas.proximas} />
        <TarjetaStat titulo="En curso" valor={s.reservas.enCurso} />
        <TarjetaStat titulo="Asistentes totales" valor={s.totalAsistentes} />
        <TarjetaStat titulo="Horas impartidas" valor={s.horasImpartidas} />
        <TarjetaStat titulo="Mis reasignaciones pendientes" valor={s.reasignacionesPendientesPropias} />
        <TarjetaStat titulo="Calificación general" valor={s.satisfaccion.calificacionGeneral.promedio} sub={`${s.satisfaccion.calificacionGeneral.respuestas} respuestas`} />
        <TarjetaStat titulo="Evaluaciones" valor={s.satisfaccion.totalEvaluaciones} sub={`tasa de respuesta ${s.satisfaccion.tasaRespuesta ?? "—"}%`} />
        <TarjetaStat titulo="Finalizadas sin evaluación" valor={s.satisfaccion.finalizadasSinEvaluacion} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <TarjetaGrafica titulo="Evolución de mis calificaciones" sub="Estrellas promedio (1 a 5) que dejaron tus asistentes en cada mes">
          {s.evolucionCalificaciones.length === 0 ? <SinDatos texto="Aún no tienes evaluaciones." /> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={s.evolucionCalificaciones} margin={{ left: -18, right: 12, top: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="mes" tickFormatter={fmtMesCorto} tick={TICK_EJE} tickLine={false} axisLine={AXIS_LINE} />
                <YAxis domain={[0, 5]} tick={TICK_EJE} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={fmtMesLargo} formatter={(v, _n, item) => [`${v ?? "—"} ★ (${item?.payload?.respuestas ?? 0} respuestas)`, "Promedio"]} />
                <Line name="Promedio" type="monotone" dataKey="promedio" stroke="#0A6A50" strokeWidth={2.5} dot={{ r: 3, fill: "#0A6A50" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
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

        <TarjetaGrafica titulo="Comparación entre mis cursos" sub="Calificación media (0 a 5)">
          {s.comparacionCursos.length === 0 ? <SinDatos texto="Aún no tienes evaluaciones." /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={s.comparacionCursos} margin={{ left: -18, right: 12, top: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="curso" tickFormatter={cortar} interval={0} angle={-20} textAnchor="end" height={56} tick={TICK_EJE_SM} tickLine={false} axisLine={AXIS_LINE} />
                <YAxis domain={[0, 5]} tick={TICK_EJE} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, "Promedio"]} />
                <Bar dataKey="promedio" fill="#d97706" name="Promedio" radius={[10, 10, 0, 0]} maxBarSize={56} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </TarjetaGrafica>

        <TarjetaGrafica titulo="Mis cursos más solicitados" sub="Top 6 por número de reservas">
          {topCursos.length === 0 ? <SinDatos texto="Aún no tienes reservas." /> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={topCursos} dataKey="reservas" nameKey="nombre" label innerRadius={48} outerRadius={88} paddingAngle={3}>
                  {topCursos.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </TarjetaGrafica>
      </div>

      <div className="mt-4">
        <TarjetaGrafica
          ancha
          titulo="Mis solicitudes por mes"
          sub={mesPico ? `Mes pico: ${fmtMesLargo(mesPico.mes)} · ${mesPico.total} solicitudes` : "Sin reservas en el período"}
        >
          {demandaMensual.length === 0 ? <SinDatos /> : (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={demandaMensual} margin={{ left: -18, right: 12, top: 4 }}>
                <defs>
                  <linearGradient id="gradDemandaFormador" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0A6A50" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#ADE498" stopOpacity={0.15} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="mes" tickFormatter={etiquetaMes} interval={0} angle={-45} textAnchor="end" height={68} tick={TICK_EJE_SM} tickLine={false} axisLine={AXIS_LINE} />
                <YAxis allowDecimals={false} tick={TICK_EJE} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={fmtMesLargo} formatter={(v) => [v, "Solicitudes"]} />
                <Area name="Solicitudes" type="monotone" dataKey="total" stroke="#0A6A50" strokeWidth={2.5} fill="url(#gradDemandaFormador)" dot={{ r: 3, fill: "#0A6A50" }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </TarjetaGrafica>
      </div>
    </FormadorLayout>
  );
}
