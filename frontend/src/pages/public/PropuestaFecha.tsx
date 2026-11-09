import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, mensajeError } from "../../api/client";
import { PublicLayout } from "../../components/Layout";
import { Spinner, ErrorMsg, OkMsg } from "../../components/ui";

interface Previa { curso: string; codigoReserva: string; fechaPropuesta: string; horaInicio: string; horaFin: string; estado: string; usado: boolean; expirado: boolean }

export default function PropuestaFecha() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [respuesta, setRespuesta] = useState<"aceptada" | "rechazada" | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.get("/publico/propuesta", { params: { token } })
      .then(r => setPrevia(r.data))
      .catch(e => setError(mensajeError(e)));
  }, [token]);

  const responder = async (aceptar: boolean) => {
    setEnviando(true); setError(null);
    try {
      await api.post("/publico/propuesta", { token, aceptar });
      setRespuesta(aceptar ? "aceptada" : "rechazada");
    } catch (e) { setError(mensajeError(e)); } finally { setEnviando(false); }
  };

  return (
    <PublicLayout>
      <div className="card mt-6">
        <h1 className="text-lg font-bold text-primary">Propuesta de nueva fecha</h1>
        <ErrorMsg msg={error} />
        {!previa && !error && <Spinner />}
        {respuesta === "aceptada" && <OkMsg msg="Aceptaste la nueva fecha. Tu formación quedó reprogramada y recibirás un correo de confirmación." />}
        {respuesta === "rechazada" && <OkMsg msg="Rechazaste la propuesta. La Biblioteca revisará otras alternativas y te contactará." />}
        {previa && !respuesta && (
          <div className="mt-4 space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
              <div><strong>Curso:</strong> {previa.curso}</div>
              <div><strong>Reserva:</strong> {previa.codigoReserva}</div>
              <div><strong>Nueva fecha propuesta:</strong> {previa.fechaPropuesta} · {previa.horaInicio}–{previa.horaFin}</div>
            </div>
            {previa.estado === "PENDIENTE" && !previa.usado && !previa.expirado ? (
              <div className="flex gap-3">
                <button className="btn-primary flex-1" disabled={enviando} onClick={() => responder(true)}>Aceptar nueva fecha</button>
                <button className="btn-secondary flex-1" disabled={enviando} onClick={() => responder(false)}>Rechazar</button>
              </div>
            ) : (
              <p className="text-sm text-gray-600">Esta propuesta ya fue respondida o expiró.</p>
            )}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
