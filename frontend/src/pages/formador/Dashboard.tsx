import { useEffect, useState } from "react";
import { api, mensajeError } from "../../api/client";
import { FormadorLayout } from "../../components/Layout";
import { Spinner, ErrorMsg, TarjetaStat, EstadoBadge, fmtFecha, fmtHora } from "../../components/ui";
import { StatsFormador } from "../../api/types";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function DashboardFormador() {
  const [s, setS] = useState<StatsFormador | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/formador/dashboard").then(r => setS(r.data)).catch(e => setError(mensajeError(e)));
  }, []);

  if (!s) return <FormadorLayout titulo="Mi dashboard"><Spinner /><ErrorMsg msg={error} /></FormadorLayout>;

  return (
    <FormadorLayout titulo="Mi dashboard">
      <ErrorMsg msg={error} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <TarjetaStat titulo="Formaciones impartidas" valor={s.formacionesImpartidas} />
        <TarjetaStat titulo="Horas esta semana" valor={s.horasEstaSemana} sub={`de ${s.horasDisponiblesSemana} h disponibles`} />
        <TarjetaStat titulo="Ocupación semanal" valor={s.ocupacionSemana !== null ? `${s.ocupacionSemana}%` : "—"} />
        <TarjetaStat titulo="Asistentes totales" valor={s.totalAsistentes} />
        <TarjetaStat titulo="Calificación general" valor={s.satisfaccion.calificacionGeneral.promedio} sub={`${s.satisfaccion.calificacionGeneral.respuestas} respuestas`} />
        <TarjetaStat titulo="Evaluaciones" valor={s.satisfaccion.totalEvaluaciones} sub={`tasa de respuesta ${s.satisfaccion.tasaRespuesta ?? "—"}%`} />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="card">
          <h3 className="font-semibold text-primary mb-3">Evolución de mis calificaciones</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={s.evolucionCalificaciones}>
              <XAxis dataKey="mes" /><YAxis domain={[0, 5]} /><Tooltip />
              <Line dataKey="promedio" stroke="#0A6A50" strokeWidth={2} name="Promedio" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="font-semibold text-primary mb-3">Comparación entre mis cursos</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={s.comparacionCursos}>
              <XAxis dataKey="curso" /><YAxis domain={[0, 5]} /><Tooltip />
              <Bar dataKey="promedio" fill="#d97706" name="Promedio" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card mb-4">
        <h3 className="font-semibold text-primary mb-3">Próximas formaciones</h3>
        {s.proximas.length === 0 && <p className="text-sm text-gray-500">No tienes formaciones próximas.</p>}
        {s.proximas.map(r => (
          <div key={r.id} className="flex items-center justify-between border-b border-gray-100 py-2 text-sm">
            <div>
              <span className="font-medium">{r.curso}</span>
              <span className="text-gray-500"> · {fmtFecha(r.iniciaAt)} {fmtHora(r.iniciaAt)}–{fmtHora(r.terminaAt)} · {r.docenteNombre}</span>
            </div>
            <div className="flex gap-1 items-center">
              {r.incidenciaPendiente && <span className="badge-amarillo">incidencia</span>}
              <EstadoBadge estado={r.estado} />
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="font-semibold text-primary mb-3">Observaciones de los estudiantes</h3>
        {s.satisfaccion.comentarios.length === 0 && <p className="text-sm text-gray-500">Aún no hay observaciones.</p>}
        <div className="space-y-2 max-h-72 overflow-auto">
          {s.satisfaccion.comentarios.map((c, i) => (
            <div key={i} className="border-b border-gray-100 pb-2 text-sm">
              <div className="text-xs text-gray-500">{c.curso} · ★{c.calificacion}</div>
              {c.observaciones && <p>{c.observaciones}</p>}
            </div>
          ))}
        </div>
      </div>
    </FormadorLayout>
  );
}
