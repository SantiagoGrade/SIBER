import { useEffect, useState } from "react";
import { api, mensajeError } from "../../api/client";
import { FormadorLayout } from "../../components/Layout";
import { Spinner, ErrorMsg, fmtFecha } from "../../components/ui";

const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const mm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

interface Franja { id: string; diaSemana: number; horaInicio: number; horaFin: number }
interface Exc { id: string; tipo: string; iniciaAt: string; terminaAt: string; motivo?: string | null }

export default function Disponibilidad() {
  const [data, setData] = useState<{ semanal: Franja[]; excepciones: Exc[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/formador/disponibilidad").then(r => setData(r.data)).catch(e => setError(mensajeError(e)));
  }, []);

  return (
    <FormadorLayout titulo="Mi disponibilidad">
      <ErrorMsg msg={error} />
      {!data ? <Spinner /> : (
        <div className="grid md:grid-cols-2 gap-4 mt-3">
          <div className="card">
            <h3 className="font-semibold text-primary dark:text-primary-soft mb-3">Horario semanal oficial</h3>
            {data.semanal.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">La Biblioteca aún no ha configurado tu disponibilidad.</p>}
            {data.semanal.map(f => (
              <div key={f.id} className="flex justify-between border-b border-gray-100 dark:border-night-800 py-2 text-sm">
                <span>{DIAS[f.diaSemana]}</span><span className="font-mono">{mm(f.horaInicio)}–{mm(f.horaFin)}</span>
              </div>
            ))}
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">Tu disponibilidad oficial la administra la Biblioteca. Para cambios, contacta al administrador.</p>
          </div>
          <div className="card">
            <h3 className="font-semibold text-primary dark:text-primary-soft mb-3">Excepciones vigentes</h3>
            {data.excepciones.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">Sin excepciones próximas.</p>}
            {data.excepciones.map(e => (
              <div key={e.id} className="border-b border-gray-100 dark:border-night-800 py-2 text-sm">
                <span className="badge-amarillo">{e.tipo}</span>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{fmtFecha(e.iniciaAt)} → {fmtFecha(e.terminaAt)} {e.motivo && `· ${e.motivo}`}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </FormadorLayout>
  );
}
