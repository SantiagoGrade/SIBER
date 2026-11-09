import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, mensajeError } from "../../api/client";
import { AuthLayout, AuthMarca } from "../../components/Layout";
import { ErrorMsg, OkMsg } from "../../components/ui";

export default function Restablecer() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [nueva, setNueva] = useState("");
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true); setError(null);
    try { await api.post("/auth/restablecer", { token, nueva }); setOk(true); }
    catch (e2) { setError(mensajeError(e2)); } finally { setEnviando(false); }
  };

  return (
    <AuthLayout>
      <form onSubmit={enviar} className="card space-y-4 p-6 sm:p-8">
        <AuthMarca titulo="Nueva contraseña" />
        {ok ? (
          <>
            <OkMsg msg="Contraseña actualizada. Ya puedes iniciar sesión." />
            <Link to="/login" className="btn-primary w-full">Ir al login</Link>
          </>
        ) : (
          <>
            <ErrorMsg msg={error} />
            <div>
              <label className="label-base">Nueva contraseña (mín. 10 caracteres)</label>
              <input type="password" className="input-base" value={nueva} onChange={e => setNueva(e.target.value)} minLength={10} />
            </div>
            <button className="btn-primary w-full" disabled={enviando || nueva.length < 10}>
              {enviando ? "Guardando…" : "Guardar"}
            </button>
          </>
        )}
      </form>
    </AuthLayout>
  );
}
