import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { mensajeError } from "../../api/client";
import { AuthLayout, AuthMarca } from "../../components/Layout";
import { ErrorMsg } from "../../components/ui";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ usuario: "", password: "" });
  const [ver, setVer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true); setError(null);
    try {
      await login(f.usuario, f.password);
      const perfil = await import("../../api/client").then(m => m.api.get("/auth/perfil"));
      nav(perfil.data.rol === "FORMADOR" ? "/formador" : "/admin");
    } catch (e2) { setError(mensajeError(e2)); } finally { setEnviando(false); }
  };

  return (
    <AuthLayout>
      <form onSubmit={entrar} className="card space-y-4 p-6 shadow-2xl sm:p-8">
        <AuthMarca titulo="SIBER" subtitulo="Sistema Bibliotecario de Reservas" />
        <ErrorMsg msg={error} />
        <div>
          <label className="label-base" htmlFor="usuario">Correo electrónico o usuario</label>
          <input id="usuario" className="input-base" placeholder="Correo electrónico o usuario"
            autoComplete="username" value={f.usuario} onChange={e => setF({ ...f, usuario: e.target.value })} />
        </div>
        <div>
          <label className="label-base" htmlFor="password">Contraseña</label>
          <div className="relative">
            <input id="password" type={ver ? "text" : "password"} className="input-base pr-16" placeholder="Contraseña"
              autoComplete="current-password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
            <button type="button" onClick={() => setVer(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-primary hover:underline">
              {ver ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </div>
        <div className="text-right">
          <Link to="/recuperar" className="text-sm font-medium text-primary hover:underline">¿Olvidaste tu contraseña?</Link>
        </div>
        <button className="btn-primary w-full font-bold uppercase tracking-wide" disabled={enviando || !f.usuario || !f.password}>
          {enviando ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </AuthLayout>
  );
}
