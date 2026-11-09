import { useEffect, useState } from "react";
import { api, mensajeError } from "../../api/client";
import { FormadorLayout } from "../../components/Layout";
import { Spinner, ErrorMsg, EstadoBadge, fmtFechaHora } from "../../components/ui";
import { Reasignacion } from "../../api/types";

export default function Reasignaciones() {
  const [lista, setLista] = useState<Reasignacion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/formador/reasignaciones").then(r => setLista(r.data)).catch(e => setError(mensajeError(e)));
  }, []);

  return (
    <FormadorLayout titulo="Mis solicitudes de reasignación">
      <ErrorMsg msg={error} />
      {!lista ? <Spinner /> : (
        <div className="card mt-3 space-y-2">
          {lista.length === 0 && <p className="text-sm text-gray-500">No has solicitado reasignaciones. Puedes hacerlo desde “Mis formaciones”.</p>}
          {lista.map(s => (
            <div key={s.id} className="border border-gray-200 rounded-xl p-3">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{s.reserva.codigo} · {s.reserva.curso}</span>
                <EstadoBadge estado={s.estado} />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {fmtFechaHora(s.reserva.iniciaAt)} · {s.motivo} · solicitada {fmtFechaHora(s.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </FormadorLayout>
  );
}
