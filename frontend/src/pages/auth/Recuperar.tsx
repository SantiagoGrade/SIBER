import { useState } from "react";
import { Link } from "react-router-dom";
import { api, mensajeError } from "../../api/client";
import { AuthLayout, AuthMarca } from "../../components/Layout";
import { ErrorMsg, OkMsg } from "../../components/ui";

export default function Recuperar() {
  const [correo, setCorreo] = useState("");
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true); setError(null);
    try { await api.post("/auth/recuperar", { correo }); setOk(true); }
    catch (e2) { setError(mensajeError(e2)); } finally { setEnviando(false); }
  };

  return (
    <AuthLayout>
      <form onSubmit={enviar} className="card space-y-4 p-6 sm:p-8">
        <AuthMarca titulo="Recuperar contraseña" />
        {ok ? <OkMsg msg="Te enviamos un enlace para restablecer tu contraseña. Revisa tu correo (y la carpeta de spam)." /> : (
          <>
            <ErrorMsg msg={error} />
            <div>
              <label className="label-base">Correo institucional</label>
              <input type="email" className="input-base" value={correo} onChange={e => setCorreo(e.target.value)} />
            </div>
            <button className="btn-primary w-full" disabled={enviando || !correo}>
              {enviando ? "Enviando…" : "Enviar enlace"}
            </button>
          </>
        )}
        <div className="text-center"><Link to="/login" className="text-sm text-primary dark:text-primary-soft hover:underline">Volver</Link></div>
      </form>
    </AuthLayout>
  );
}
