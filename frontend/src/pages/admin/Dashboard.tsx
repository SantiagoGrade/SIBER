import { useEffect, useState } from "react";
import { api, mensajeError } from "../../api/client";
import { AdminLayout } from "../../components/Layout";
import { Spinner, ErrorMsg, TarjetaStat, Select, BotonLimpiar, useBloquearScroll } from "../../components/ui";
import { StatsAdmin, Curso } from "../../api/types";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

import {
  TarjetaGrafica, COLORES, useEstilosGrafica,
  fmtMesLargo, fmtMesCorto, etiquetaMes, mesesEntre, cortar,
} from "../../components/graficas";

interface FormadorMin { id: string; nombre: string }

const FILTRO_INICIAL = { desde: "", hasta: "", cursoId: "", codigo: "", formadorId: "", semestre: "", anio: "" };

export default function Dashboard() {
  const [stats, setStats] = useState<StatsAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [formadores, setFormadores] = useState<FormadorMin[]>([]);
  const [f, setF] = useState(FILTRO_INICIAL);
  const [modalExcel, setModalExcel] = useState(false);
  useBloquearScroll(modalExcel);

  useEffect(() => {
    api.get("/publico/cursos").then(r => setCursos(r.data)).catch(() => {});
    api.get("/admin/formadores").then(r => setFormadores(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (f.desde) params.desde = new Date(f.desde).toISOString();
    if (f.hasta) params.hasta = new Date(f.hasta).toISOString();
    if (f.cursoId) params.cursoId = f.cursoId;
    if (f.codigo.trim()) params.codigo = f.codigo.trim();
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

  const est = useEstilosGrafica();

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
    if (f.codigo.trim()) params.set("codigo", f.codigo.trim());
    if (f.formadorId) params.set("formadorId", f.formadorId);
    window.open(`/api/v1/admin/exportar/${tipo}?${params}`, "_blank");
  };

  return (
    <AdminLayout titulo="Dashboard">
      <ErrorMsg msg={error} />

      <div className="card mb-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-3 items-end">
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
        <div><label className="label-base">Código</label>
          <input className="input-base" placeholder="SIF-…" value={f.codigo} onChange={e => setF({ ...f, codigo: e.target.value })} /></div>
        <div className="col-span-2 flex items-end justify-end gap-2 sm:col-span-4 lg:col-span-2">
          <BotonLimpiar
            disabled={!f.desde && !f.hasta && !f.cursoId && !f.codigo && !f.formadorId && !f.semestre && !f.anio}
            onClick={() => setF(FILTRO_INICIAL)}
          />
          <button className="btn-secondary min-w-28 whitespace-nowrap" onClick={() => setModalExcel(true)}>Excel</button>
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
        <TarjetaStat titulo="Calificación del docente" valor={s.satisfaccion.porRol.docentes.general.promedio} sub={`${s.satisfaccion.porRol.docentes.evaluaciones} evaluaciones de docentes`} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <TarjetaGrafica titulo="Calificación promedio por mes" sub="Estrellas promedio (1 a 5) que dejaron los asistentes en cada mes">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={s.satisfaccion.evolucion} margin={{ left: -18, right: 12, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={est.grid} vertical={false} />
              <XAxis dataKey="mes" tickFormatter={fmtMesCorto} tick={est.tick} tickLine={false} axisLine={est.axis} />
              <YAxis domain={[0, 5]} tick={est.tick} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={est.tooltip} labelFormatter={fmtMesLargo} formatter={(v, _n, item) => [`${v ?? "—"} ★ (${item?.payload?.respuestas ?? 0} respuestas)`, "Promedio"]} />
              <Line name="Promedio" type="monotone" dataKey="promedio" stroke={est.primario} strokeWidth={2.5} dot={{ r: 3, fill: est.primario }} />
            </LineChart>
          </ResponsiveContainer>
        </TarjetaGrafica>

        <TarjetaGrafica titulo="Distribución de valoraciones" sub="Respuestas por cantidad de estrellas">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={s.satisfaccion.distribucion} margin={{ left: -18, right: 12, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={est.grid} vertical={false} />
              <XAxis dataKey="estrellas" tick={est.tick} tickLine={false} axisLine={est.axis} />
              <YAxis allowDecimals={false} tick={est.tick} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={est.tooltip} formatter={(v) => [v, "Respuestas"]} labelFormatter={v => `${v} ★`} />
              <Bar dataKey="cantidad" fill={est.primario} name="Respuestas" radius={[10, 10, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </TarjetaGrafica>

        <TarjetaGrafica titulo="Evaluación por aspecto" sub="Promedio (1 a 5) por cada aspecto calificado · docente vs. asistentes">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={[
              { nombre: "Contenido", Asistentes: s.satisfaccion.porRol.asistentes.aspectos.contenidoObjetivo.promedio, Docente: s.satisfaccion.porRol.docentes.aspectos.contenidoObjetivo.promedio },
              { nombre: "Metodología", Asistentes: s.satisfaccion.porRol.asistentes.aspectos.metodologiaAdecuada.promedio, Docente: s.satisfaccion.porRol.docentes.aspectos.metodologiaAdecuada.promedio },
              { nombre: "Dominio tema", Asistentes: s.satisfaccion.porRol.asistentes.aspectos.dominioTema.promedio, Docente: s.satisfaccion.porRol.docentes.aspectos.dominioTema.promedio },
              { nombre: "Coherencia", Asistentes: s.satisfaccion.porRol.asistentes.aspectos.coherenciaExposicion.promedio, Docente: s.satisfaccion.porRol.docentes.aspectos.coherenciaExposicion.promedio },
              { nombre: "General", Asistentes: s.satisfaccion.porRol.asistentes.general.promedio, Docente: s.satisfaccion.porRol.docentes.general.promedio },
            ]} margin={{ left: -18, right: 12, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={est.grid} vertical={false} />
              <XAxis dataKey="nombre" interval={0} tick={est.tickSm} tickLine={false} axisLine={est.axis} />
              <YAxis domain={[0, 5]} tick={est.tick} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={est.tooltip} formatter={(v) => [`${v ?? "—"} ★`]} />
              <Legend />
              <Bar dataKey="Asistentes" fill={est.primario} radius={[10, 10, 0, 0]} maxBarSize={40} />
              <Bar dataKey="Docente" fill="#d97706" radius={[10, 10, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </TarjetaGrafica>

        <TarjetaGrafica titulo="Docente vs. asistentes" sub={`Promedio por dimensión · ${s.satisfaccion.porRol.docentes.evaluaciones} evaluaciones de docentes`}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={[
              { dimension: "Académicos", Asistentes: s.satisfaccion.porRol.asistentes.academicos.promedio, Docente: s.satisfaccion.porRol.docentes.academicos.promedio },
              { dimension: "Facilitador", Asistentes: s.satisfaccion.porRol.asistentes.facilitador.promedio, Docente: s.satisfaccion.porRol.docentes.facilitador.promedio },
              { dimension: "General", Asistentes: s.satisfaccion.porRol.asistentes.general.promedio, Docente: s.satisfaccion.porRol.docentes.general.promedio },
            ]} margin={{ left: -18, right: 12, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={est.grid} vertical={false} />
              <XAxis dataKey="dimension" tick={est.tick} tickLine={false} axisLine={est.axis} />
              <YAxis domain={[0, 5]} tick={est.tick} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={est.tooltip} formatter={(v) => [`${v ?? "—"} ★`]} />
              <Legend />
              <Bar dataKey="Asistentes" fill={est.primario} radius={[10, 10, 0, 0]} maxBarSize={48} />
              <Bar dataKey="Docente" fill="#d97706" radius={[10, 10, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </TarjetaGrafica>

        <TarjetaGrafica titulo="Promedio por curso" sub="Calificación media (0 a 5)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={s.satisfaccion.porCurso} margin={{ left: -18, right: 12, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={est.grid} vertical={false} />
              <XAxis dataKey="nombre" tickFormatter={cortar} interval={0} angle={-20} textAnchor="end" height={56} tick={est.tickSm} tickLine={false} axisLine={est.axis} />
              <YAxis domain={[0, 5]} tick={est.tick} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={est.tooltip} formatter={(v) => [v, "Promedio"]} />
              <Bar dataKey="promedio" fill="#d97706" name="Promedio" radius={[10, 10, 0, 0]} maxBarSize={56} />
            </BarChart>
          </ResponsiveContainer>
        </TarjetaGrafica>

        <TarjetaGrafica titulo="Promedio por formador" sub="Calificación media (0 a 5)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={s.satisfaccion.porFormador} margin={{ left: -18, right: 12, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={est.grid} vertical={false} />
              <XAxis dataKey="nombre" tickFormatter={cortar} interval={0} angle={-20} textAnchor="end" height={56} tick={est.tickSm} tickLine={false} axisLine={est.axis} />
              <YAxis domain={[0, 5]} tick={est.tick} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={est.tooltip} formatter={(v) => [v, "Promedio"]} />
              <Bar dataKey="promedio" fill="#0A6A70" name="Promedio" radius={[10, 10, 0, 0]} maxBarSize={56} />
            </BarChart>
          </ResponsiveContainer>
        </TarjetaGrafica>

        <TarjetaGrafica titulo="Carga laboral por formador" sub="Horas de formación no canceladas">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={s.cargaPorFormador} margin={{ left: -18, right: 12, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={est.grid} vertical={false} />
              <XAxis dataKey="nombre" tickFormatter={cortar} interval={0} angle={-20} textAnchor="end" height={56} tick={est.tickSm} tickLine={false} axisLine={est.axis} />
              <YAxis tick={est.tick} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={est.tooltip} formatter={(v) => [v, "Horas"]} />
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
              <Tooltip contentStyle={est.tooltip} />
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
                <stop offset="0%" stopColor={est.primario} stopOpacity={0.85} />
                <stop offset="100%" stopColor="#ADE498" stopOpacity={0.15} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={est.grid} vertical={false} />
            <XAxis dataKey="mes" tickFormatter={etiquetaMes} interval={0} angle={-45} textAnchor="end" height={68} tick={est.tickSm} tickLine={false} axisLine={est.axis} />
            <YAxis allowDecimals={false} tick={est.tick} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={est.tooltip} labelFormatter={fmtMesLargo} formatter={(v) => [v, "Solicitudes"]} />
            <Area name="Solicitudes" type="monotone" dataKey="total" stroke={est.primario} strokeWidth={2.5} fill="url(#gradDemanda)" dot={{ r: 3, fill: est.primario }} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </TarjetaGrafica>
      </div>

      {modalExcel && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={() => setModalExcel(false)}>
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white dark:bg-night-900 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 bg-primary px-5 py-4 text-white">
              <div>
                <h3 className="text-lg font-bold">Exportar a Excel</h3>
                <p className="mt-0.5 text-xs text-white/70">El reporte se genera con los filtros actuales</p>
              </div>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-white transition hover:bg-white/25"
                onClick={() => setModalExcel(false)} aria-label="Cerrar"
              >✕</button>
            </div>
            <div className="grid gap-2 p-5">
              <button
                className="rounded-xl border border-gray-200 dark:border-night-700 px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5 dark:hover:bg-primary/15"
                onClick={() => { exportar("estadisticas"); setModalExcel(false); }}
              >
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">Estadísticas</div>
                <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Resumen, satisfacción por curso y formador, evolución por mes</div>
              </button>
              <button
                className="rounded-xl border border-gray-200 dark:border-night-700 px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5 dark:hover:bg-primary/15"
                onClick={() => { exportar("reservas"); setModalExcel(false); }}
              >
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">Reservas</div>
                <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Detalle por reserva: docente, aula, asistentes, evaluaciones</div>
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
