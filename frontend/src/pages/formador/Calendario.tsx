import { useEffect, useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { api, mensajeError } from "../../api/client";
import { FormadorLayout } from "../../components/Layout";
import { ErrorMsg, EstadoBadge, fmtFecha, fmtHora } from "../../components/ui";

const localizer = dateFnsLocalizer({ format, parse, startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }), getDay, locales: { es } });

interface Ev { id: string; title: string; start: Date; end: Date; tipo: string; extra?: string }

export default function CalendarioFormador() {
  const [eventos, setEventos] = useState<Ev[]>([]);
  const [sel, setSel] = useState<Ev | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fecha, setFecha] = useState(new Date());
  const [vista, setVista] = useState<View>("week");

  useEffect(() => {
    const desde = new Date(fecha); desde.setDate(1); desde.setMonth(desde.getMonth() - 1);
    const hasta = new Date(fecha); hasta.setMonth(hasta.getMonth() + 2); hasta.setDate(0);
    api.get("/formador/calendario", { params: { desde: desde.toISOString(), hasta: hasta.toISOString() } })
      .then(r => {
        const evs: Ev[] = [];
        for (const rv of r.data.reservas) {
          evs.push({
            id: rv.id, title: `${rv.curso} (${rv.codigo})`,
            start: new Date(rv.iniciaAt), end: new Date(rv.terminaAt),
            tipo: rv.estado, extra: rv.docenteNombre,
          });
        }
        for (const fr of r.data.disponible) {
          evs.push({
            id: `d-${fr.inicio}`, title: "Disponible",
            start: new Date(fr.inicio), end: new Date(fr.fin), tipo: "DISPONIBLE",
          });
        }
        for (const ex of r.data.excepciones) {
          evs.push({
            id: `e-${ex.id}`, title: `Bloqueo: ${ex.tipo}`,
            start: new Date(ex.iniciaAt), end: new Date(ex.terminaAt), tipo: "BLOQUEO",
          });
        }
        setEventos(evs);
      })
      .catch(e => setError(mensajeError(e)));
  }, [fecha]);

  const estilo = useMemo(() => ({ eventPropGetter: (e: Ev) => ({
    style: {
      backgroundColor:
        e.tipo === "CONFIRMADA" ? "#0A6A50" :
        e.tipo === "FINALIZADA" ? "#2563eb" :
        e.tipo === "CANCELADA" ? "#9ca3af" :
        e.tipo === "BLOQUEO" ? "#dc2626" : "#d1fae5",
      color: e.tipo === "DISPONIBLE" ? "#065f46" : "#fff",
      borderRadius: "6px", fontSize: "12px",
    },
  }) }), []);

  return (
    <FormadorLayout titulo="Mi calendario">
      <ErrorMsg msg={error} />
      <div className="card mt-3" style={{ height: "70vh" }}>
        <Calendar
          localizer={localizer} events={eventos} culture="es"
          view={vista} onView={setVista} date={fecha} onNavigate={setFecha}
          views={["day", "week", "month"]}
          messages={{ today: "Hoy", previous: "‹", next: "›", day: "Día", week: "Semana", month: "Mes", noEventsInRange: "Sin eventos" }}
          eventPropGetter={estilo.eventPropGetter}
          onSelectEvent={(e: object) => setSel(e as Ev)}
        />
      </div>
      {sel && (
        <div className="card mt-3 flex justify-between items-center">
          <div className="text-sm">
            <strong>{sel.title}</strong> · {fmtFecha(sel.start)} {fmtHora(sel.start)}–{fmtHora(sel.end)}
            {sel.extra && <span className="text-gray-500"> · Docente: {sel.extra}</span>}
            <div className="mt-1"><EstadoBadge estado={sel.tipo} /></div>
          </div>
          <button className="btn-secondary" onClick={() => setSel(null)}>Cerrar</button>
        </div>
      )}
    </FormadorLayout>
  );
}
