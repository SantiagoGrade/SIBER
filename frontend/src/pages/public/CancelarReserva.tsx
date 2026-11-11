import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, mensajeError } from "../../api/client";
import { PublicLayout } from "../../components/Layout";
import { Spinner, ErrorMsg, OkMsg, EstadoBadge } from "../../components/ui";

interface Previa { curso: string; fecha: string; horaInicio: string; horaFin: string; estado: string; usado: boolean; puedeCancelar: boolean; limiteHoras: number }

export default function CancelarReserva() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.get("/publico/cancelacion", { params: { token } })
      .then(r => setPrevia(r.data))
      .catch(e => setError(mensajeError(e)));
  }, [token]);

  const cancelar = async () => {
    setEnviando(true); setError(null);
    try {
      await api.post("/publico/cancelacion", { token });
      setHecho(true);
    } catch (e) { setError(mensajeError(e)); } finally { setEnviando(false); }
  };

  return (
    <PublicLayout>
      <div className="card mt-6">
        <h1 className="text-lg font-bold text-primary dark:text-primary-soft">Cancelación de reserva</h1>
        <ErrorMsg msg={error} />
        {!previa && !error && <Spinner />}
        {hecho && <OkMsg msg="Tu reserva fue cancelada. Recibirás un correo de confirmación." />}
        {previa && !hecho && (
          <div className="mt-4 space-y-3">
            <div className="bg-gray-50 dark:bg-night-800 rounded-xl p-4 text-sm space-y-1">
              <div><strong>Curso:</strong> {previa.curso}</div>
              <div><strong>Fecha:</strong> {previa.fecha} · {previa.horaInicio}–{previa.horaFin}</div>
              <div><strong>Estado:</strong> <EstadoBadge estado={previa.estado} /></div>
            </div>
            {previa.puedeCancelar ? (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400">Puedes cancelar hasta {previa.limiteHoras} h antes del inicio. Esta acción no se puede deshacer.</p>
                <button className="btn-danger w-full" disabled={enviando} onClick={cancelar}>
                  {enviando ? "Cancelando…" : "Confirmar cancelación"}
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {previa.usado ? "Este enlace ya fue utilizado." : "El plazo de cancelación terminó o la reserva ya no está activa."}
              </p>
            )}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
