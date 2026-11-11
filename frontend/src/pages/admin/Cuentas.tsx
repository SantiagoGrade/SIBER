import { useEffect, useState } from "react";
import { api, mensajeError } from "../../api/client";
import { AdminLayout } from "../../components/Layout";
import { Spinner, ErrorMsg, OkMsg, Select, fmtFecha, useBloquearScroll } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";

interface CuentaRow {
  id: string; usuario: string; correo: string; rol: string;
  nombreCompleto: string; activo: boolean;
  formador: { id: string; cursos: string[] } | null;
}
interface CursoRow {
  id: string; nombre: string; descripcion?: string | null; activo: boolean;
  formadores: { formador: { id: string; cuenta: { nombreCompleto: string } } }[];
}
interface FormadorRow { id: string; cuentaId: string; nombre: string; activo: boolean; cursos: { id: string; nombre: string }[] }
interface Franja { diaSemana: number; horaInicio: number; horaFin: number }
interface Excepcion { id: string; tipo: string; iniciaAt: string; terminaAt: string; motivo?: string | null }

const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DIAS_CORTO = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const TIPOS_EXC = ["VACACIONES", "INCAPACIDAD", "CALAMIDAD", "PERMISO", "BLOQUEO_ADMINISTRATIVO", "FECHA_ESPECIAL"];
const CURSOS_POR_PAGINA = 4;

function ChipCurso({ nombre, activo, onClick }: { nombre: string; activo: boolean; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick} aria-pressed={activo}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
        activo
          ? "border-primary bg-primary text-white shadow-sm shadow-primary/25 dark:border-primary-soft/60"
          : "border-gray-300 bg-white text-gray-600 hover:-translate-y-px hover:border-primary hover:bg-primary/5 hover:text-primary dark:border-night-600 dark:bg-night-800 dark:text-gray-300 dark:hover:border-primary-soft/60 dark:hover:bg-primary/10 dark:hover:text-primary-soft"
      }`}
    >
      {activo && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
      {nombre}
    </button>
  );
}

function ChipsCursos({ cursos, esActivo, onToggle }: {
  cursos: { id: string; nombre: string }[];
  esActivo: (id: string) => boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="scroll-fino flex max-h-24 flex-wrap gap-2 overflow-y-auto overscroll-contain pr-1">
      {cursos.map(c => (
        <ChipCurso key={c.id} nombre={c.nombre} activo={esActivo(c.id)} onClick={() => onToggle(c.id)} />
      ))}
    </div>
  );
}
const mm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const aMin = (h: string) => { const [a, b] = h.split(":").map(Number); return a * 60 + b; };

export default function Cuentas() {
  const { cuenta: yo } = useAuth();
  const [lista, setLista] = useState<CuentaRow[] | null>(null);
  const [cursos, setCursos] = useState<CursoRow[] | null>(null);
  const [formadores, setFormadores] = useState<FormadorRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Nueva cuenta
  const [nueva, setNueva] = useState({ usuario: "", correo: "", nombreCompleto: "", password: "", rol: "FORMADOR" });
  const [cursoIds, setCursoIds] = useState<string[]>([]);

  // Cursos
  const [nuevoCurso, setNuevoCurso] = useState({ nombre: "", descripcion: "" });
  const [editando, setEditando] = useState<CursoRow | null>(null);
  const [paginaCursos, setPaginaCursos] = useState(0);
  const [cursoFormadoresId, setCursoFormadoresId] = useState<string | null>(null);
  const [formadorAgregarId, setFormadorAgregarId] = useState("");
  const [errorFormadores, setErrorFormadores] = useState<string | null>(null);

  // Edición de cuenta
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);
  const [msgCursos, setMsgCursos] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [editCuenta, setEditCuenta] = useState<{
    cuenta: CuentaRow; usuario: string; correo: string; nombreCompleto: string;
    rol: string; password: string; cursoIds: string[];
  } | null>(null);

  // Detalle de formador seleccionado
  const [sel, setSel] = useState<CuentaRow | null>(null);
  const [franjas, setFranjas] = useState<Franja[]>([]);
  const [excepciones, setExcepciones] = useState<Excepcion[]>([]);
  const [nuevaFranja, setNuevaFranja] = useState({ diaSemana: 1, inicio: "08:00", fin: "12:00" });
  const [guardandoFranjas, setGuardandoFranjas] = useState(false);
  const [msgFranjas, setMsgFranjas] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [guardandoExc, setGuardandoExc] = useState(false);
  const [msgExc, setMsgExc] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [exc, setExc] = useState({ tipo: "VACACIONES", iniciaAt: "", terminaAt: "", motivo: "" });

  const cargar = () => {
    api.get("/admin/cuentas").then(r => setLista(r.data)).catch(e => setError(mensajeError(e)));
    api.get("/admin/cursos").then(r => setCursos(r.data)).catch(() => {});
    api.get("/admin/formadores").then(r => setFormadores(r.data)).catch(() => {});
  };
  useEffect(() => { cargar(); }, []);

  const cursosActivos = (cursos ?? []).filter(c => c.activo);
  const toggleNuevoCurso = (id: string) =>
    setCursoIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const crear = async () => {
    setError(null);
    if (enviando) return;
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9._\- ]{3,40}$/.test(nueva.usuario.trim()))
      return setError("El usuario debe tener 3–40 caracteres: solo letras, números, espacios, punto y guion");
    if (nueva.nombreCompleto.trim().length < 3)
      return setError("El nombre completo debe tener al menos 3 caracteres");
    if (!/^\S+@\S+\.\S+$/.test(nueva.correo.trim()))
      return setError("El correo no es válido");
    if (nueva.password.length < 10)
      return setError("La contraseña debe tener mínimo 10 caracteres");
    setEnviando(true);
    try {
      await api.post("/admin/cuentas", {
        ...nueva,
        ...(nueva.rol === "FORMADOR" && cursoIds.length ? { cursoIds } : {}),
      });
      setOk("Cuenta creada");
      setNueva({ usuario: "", correo: "", nombreCompleto: "", password: "", rol: "FORMADOR" });
      setCursoIds([]);
      cargar();
    } catch (e) { setError(mensajeError(e)); } finally { setEnviando(false); }
  };

  const toggle = async (c: CuentaRow) => {
    try {
      await api.post(`/admin/cuentas/${c.id}/${c.activo ? "desactivar" : "activar"}`);
      if (sel?.id === c.id) setSel(null);
      cargar();
    } catch (e) { setError(mensajeError(e)); }
  };

  // ── Cursos ──
  const crearCurso = async () => {
    if (nuevoCurso.nombre.trim().length < 3) return setError("El nombre del curso debe tener al menos 3 caracteres");
    try {
      await api.post("/admin/cursos", nuevoCurso);
      setNuevoCurso({ nombre: "", descripcion: "" }); setOk("Curso creado"); cargar();
    } catch (e) { setError(mensajeError(e)); }
  };
  const guardarCurso = async () => {
    if (!editando) return;
    try {
      await api.put(`/admin/cursos/${editando.id}`, {
        nombre: editando.nombre, descripcion: editando.descripcion, activo: editando.activo,
      });
      setEditando(null); setOk("Curso actualizado"); cargar();
    } catch (e) { setError(mensajeError(e)); }
  };

  // ── Formadores de un curso (modal) ──
  const cursoFormadores = cursos?.find(c => c.id === cursoFormadoresId) ?? null;
  useBloquearScroll(!!editCuenta || !!cursoFormadores);
  const candidatos = cursoFormadores
    ? formadores.filter(f => f.activo && !cursoFormadores.formadores.some(x => x.formador.id === f.id))
    : [];

  const abrirFormadores = (id: string) => {
    setCursoFormadoresId(id); setFormadorAgregarId(""); setErrorFormadores(null);
  };
  const agregarFormadorCurso = async () => {
    if (!cursoFormadoresId || !formadorAgregarId) return;
    setErrorFormadores(null);
    try {
      await api.post(`/admin/cursos/${cursoFormadoresId}/formadores`, { formadorId: formadorAgregarId });
      setFormadorAgregarId(""); cargar();
    } catch (e) { setErrorFormadores(mensajeError(e)); }
  };
  const quitarFormadorCurso = async (formadorId: string) => {
    if (!cursoFormadoresId) return;
    setErrorFormadores(null);
    try {
      await api.delete(`/admin/cursos/${cursoFormadoresId}/formadores/${formadorId}`);
      cargar();
    } catch (e) { setErrorFormadores(mensajeError(e)); }
  };

  // ── Detalle del formador ──
  const formadorDe = (c: CuentaRow) => formadores.find(f => f.cuentaId === c.id);

  // ── Edición de cuenta ──
  const abrirEdicion = (c: CuentaRow) => {
    setErrorEdicion(null);
    setEditCuenta({
      cuenta: c, usuario: c.usuario, correo: c.correo, nombreCompleto: c.nombreCompleto,
      rol: c.rol, password: "", cursoIds: formadorDe(c)?.cursos.map(x => x.id) ?? [],
    });
  };

  const guardarEdicion = async () => {
    if (!editCuenta || enviando) return;
    setErrorEdicion(null);
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9._\- ]{3,40}$/.test(editCuenta.usuario.trim()))
      return setErrorEdicion("El usuario debe tener 3–40 caracteres: solo letras, números, espacios, punto y guion");
    if (editCuenta.nombreCompleto.trim().length < 3)
      return setErrorEdicion("El nombre completo debe tener al menos 3 caracteres");
    if (!/^\S+@\S+\.\S+$/.test(editCuenta.correo.trim()))
      return setErrorEdicion("El correo no es válido");
    if (editCuenta.password && editCuenta.password.length < 10)
      return setErrorEdicion("La contraseña debe tener mínimo 10 caracteres");
    setEnviando(true);
    try {
      await api.put(`/admin/cuentas/${editCuenta.cuenta.id}`, {
        usuario: editCuenta.usuario,
        correo: editCuenta.correo,
        nombreCompleto: editCuenta.nombreCompleto,
        rol: editCuenta.rol,
        ...(editCuenta.password ? { password: editCuenta.password } : {}),
        ...(editCuenta.rol === "FORMADOR" ? { cursoIds: editCuenta.cursoIds } : {}),
      });
      setOk("Cuenta actualizada"); setEditCuenta(null); cargar();
    } catch (e) { setErrorEdicion(mensajeError(e)); } finally { setEnviando(false); }
  };

  const gestionar = async (c: CuentaRow) => {
    const f = formadorDe(c);
    if (!f) return;
    setSel(c); setError(null); setMsgFranjas(null); setMsgExc(null); setMsgCursos(null);
    const [d, e] = await Promise.all([
      api.get(`/admin/formadores/${f.id}/disponibilidad`),
      api.get(`/admin/formadores/${f.id}/excepciones`),
    ]);
    setFranjas(d.data.map((x: Franja) => ({ diaSemana: x.diaSemana, horaInicio: x.horaInicio, horaFin: x.horaFin })));
    setExcepciones(e.data);
  };

  const toggleCursoFormador = async (cursoId: string, habilitado: boolean) => {
    const f = sel && formadorDe(sel);
    if (!f) return;
    try {
      if (habilitado) await api.delete(`/admin/cursos/${cursoId}/formadores/${f.id}`);
      else await api.post(`/admin/cursos/${cursoId}/formadores`, { formadorId: f.id });
      setMsgCursos(null);
      cargar();
    } catch (e) { setMsgCursos({ tipo: "error", texto: mensajeError(e) }); }
  };

  const guardarFranjas = async (nuevas: Franja[]) => {
    const f = sel && formadorDe(sel);
    if (!f || guardandoFranjas) return;
    setGuardandoFranjas(true);
    try {
      await api.put(`/admin/formadores/${f.id}/disponibilidad`, { franjas: nuevas });
      setFranjas(nuevas);
      setMsgFranjas({ tipo: "ok", texto: "Disponibilidad actualizada" });
    } catch (e) { setMsgFranjas({ tipo: "error", texto: mensajeError(e) }); } finally { setGuardandoFranjas(false); }
  };

  const agregarExcepcion = async () => {
    const f = sel && formadorDe(sel);
    if (!f || guardandoExc) return;
    setGuardandoExc(true);
    try {
      await api.post(`/admin/formadores/${f.id}/excepciones`, {
        tipo: exc.tipo,
        iniciaAt: new Date(exc.iniciaAt).toISOString(),
        terminaAt: new Date(exc.terminaAt).toISOString(),
        motivo: exc.motivo || undefined,
      });
      setExc({ tipo: "VACACIONES", iniciaAt: "", terminaAt: "", motivo: "" });
      await gestionar(sel!);
      setMsgExc({ tipo: "ok", texto: "Excepción registrada" });
    } catch (e) { setMsgExc({ tipo: "error", texto: mensajeError(e) }); } finally { setGuardandoExc(false); }
  };

  const eliminarExcepcion = async (excepcionId: string) => {
    const f = sel && formadorDe(sel);
    if (!f || guardandoExc) return;
    setGuardandoExc(true);
    try {
      await api.delete(`/admin/formadores/${f.id}/excepciones/${excepcionId}`);
      await gestionar(sel!);
      setMsgExc({ tipo: "ok", texto: "Excepción eliminada" });
    } catch (e) { setMsgExc({ tipo: "error", texto: mensajeError(e) }); } finally { setGuardandoExc(false); }
  };

  const rolesCrear = yo?.rol === "SUPER_ADMIN" ? ["FORMADOR", "ADMIN", "SUPER_ADMIN"] : ["FORMADOR"];

  return (
    <AdminLayout titulo="Cuentas y cursos">
      <ErrorMsg msg={error} /><OkMsg msg={ok} />

      <div className="mt-3 grid gap-4 lg:grid-cols-2 items-start">
        <div className="card">
          <h3 className="font-semibold text-primary dark:text-primary-soft mb-3">Nueva cuenta</h3>
          <form onSubmit={e => { e.preventDefault(); crear(); }}>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className="input-base" placeholder="Usuario" value={nueva.usuario} onChange={e => setNueva({ ...nueva, usuario: e.target.value })} />
              <input className="input-base" placeholder="Nombre completo" value={nueva.nombreCompleto} onChange={e => setNueva({ ...nueva, nombreCompleto: e.target.value })} />
              <input className="input-base" type="email" placeholder="Correo" value={nueva.correo} onChange={e => setNueva({ ...nueva, correo: e.target.value })} />
              <input className="input-base" type="password" placeholder="Contraseña (mín. 10)" value={nueva.password} onChange={e => setNueva({ ...nueva, password: e.target.value })} />
              <Select value={nueva.rol} onChange={v => { setNueva({ ...nueva, rol: v }); setCursoIds([]); }}
                opciones={rolesCrear.map(r => ({ value: r, label: r.replaceAll("_", " ") }))} />
              <button type="submit" className="btn-primary" disabled={enviando}>
                {enviando ? "Creando…" : "Crear"}
              </button>
            </div>
            {nueva.rol === "FORMADOR" && (
              <div className="form-section">
                <div className="form-section-title">Cursos que puede impartir</div>
                {cursosActivos.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">Primero crea un curso en el panel de la derecha.</p>}
                <ChipsCursos cursos={cursosActivos} esActivo={id => cursoIds.includes(id)} onToggle={toggleNuevoCurso} />
              </div>
            )}
          </form>
        </div>

        <div className="card">
          <h3 className="font-semibold text-primary dark:text-primary-soft mb-3">Cursos</h3>
          <form className="flex gap-2 mb-3" onSubmit={e => { e.preventDefault(); crearCurso(); }}>
            <input className="input-base flex-1" placeholder="Nombre del curso" value={nuevoCurso.nombre} onChange={e => setNuevoCurso({ ...nuevoCurso, nombre: e.target.value })} />
            <input className="input-base flex-1" placeholder="Descripción" value={nuevoCurso.descripcion} onChange={e => setNuevoCurso({ ...nuevoCurso, descripcion: e.target.value })} />
            <button type="submit" className="btn-primary" disabled={nuevoCurso.nombre.trim().length < 3}>Crear</button>
          </form>
          {!cursos ? <Spinner /> : (() => {
            const paginas = Math.max(1, Math.ceil(cursos.length / CURSOS_POR_PAGINA));
            const pagina = Math.min(paginaCursos, paginas - 1);
            const visibles = cursos.slice(pagina * CURSOS_POR_PAGINA, pagina * CURSOS_POR_PAGINA + CURSOS_POR_PAGINA);
            return (
              <>
                <div>
                  {visibles.map(c => (
                    <div key={c.id} className="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-night-800 py-2 text-sm">
                      {editando?.id === c.id ? (
                        <form className="contents" onSubmit={e => { e.preventDefault(); guardarCurso(); }}>
                          <input className="input-base flex-1" value={editando.nombre} onChange={e => setEditando({ ...editando, nombre: e.target.value })} />
                          <input className="input-base flex-1" value={editando.descripcion ?? ""} onChange={e => setEditando({ ...editando, descripcion: e.target.value })} />
                          <button
                            type="button" role="switch" aria-checked={editando.activo}
                            title={editando.activo ? "Activo — clic para desactivar" : "Inactivo — clic para activar"}
                            onClick={() => setEditando({ ...editando, activo: !editando.activo })}
                            className={`flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${editando.activo ? "justify-end bg-primary" : "justify-start bg-gray-300 dark:bg-night-600"}`}
                          >
                            <span className="h-4 w-4 rounded-full bg-white shadow transition-transform" />
                          </button>
                          <button type="submit" className="btn-primary text-xs">Guardar</button>
                        </form>
                      ) : (
                        <>
                          <div className="min-w-0">
                            <div className="font-medium">
                              {c.nombre}
                              <span
                                className="ml-1.5 inline-flex h-5 min-w-5 -translate-y-px items-center justify-center rounded-full bg-primary/10 px-1.5 align-middle text-xs font-semibold text-primary dark:bg-primary/15 dark:text-primary-soft"
                                title={`${c.formadores.length} ${c.formadores.length === 1 ? "formador asignado" : "formadores asignados"}`}
                              >{c.formadores.length}</span>
                              {" "}{!c.activo && <span className="badge-gris">inactivo</span>}
                            </div>
                            <div className="truncate text-xs text-gray-500 dark:text-gray-400">{c.descripcion || "—"}</div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              className="rounded-xl border border-gray-300 dark:border-night-600 p-1.5 text-primary dark:text-primary-soft transition hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/15"
                              title="Ver formadores" aria-label={`Ver formadores de ${c.nombre}`}
                              onClick={() => abrirFormadores(c.id)}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>
                            <button className="btn-secondary text-xs" onClick={() => setEditando({ ...c })}>Editar</button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {!cursos.length && <p className="text-sm text-gray-500 dark:text-gray-400">Aún no hay cursos creados.</p>}
                </div>
                {paginas > 1 && (
                  <div className="mt-3 flex items-center justify-between">
                    <button className="btn-secondary text-xs" disabled={pagina === 0} onClick={() => setPaginaCursos(pagina - 1)}>‹ Anterior</button>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Página {pagina + 1} de {paginas}</span>
                    <button className="btn-secondary text-xs" disabled={pagina >= paginas - 1} onClick={() => setPaginaCursos(pagina + 1)}>Siguiente ›</button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      <div className="card scroll-fino mt-4 overflow-auto">
        <h3 className="font-semibold text-primary dark:text-primary-soft mb-3">Cuentas</h3>
        {!lista ? <Spinner /> : (
          <table className="w-full">
            <thead><tr><th className="th">Usuario</th><th className="th">Nombre</th><th className="th">Correo</th><th className="th">Rol</th><th className="th">Cursos</th><th className="th">Estado</th><th className="th"></th></tr></thead>
            <tbody>
              {lista.map(c => (
                <tr key={c.id} className={`border-t border-gray-100 dark:border-night-800 ${sel?.id === c.id ? "bg-primary/5 dark:bg-primary/15" : ""}`}>
                  <td className="td font-mono">{c.usuario}</td>
                  <td className="td">{c.nombreCompleto}</td>
                  <td className="td">{c.correo}</td>
                  <td className="td"><span className="badge-azul">{c.rol}</span></td>
                  <td className="td">
                    {c.formador
                      ? <div className="flex flex-wrap gap-1">{c.formador.cursos.map(n => <span key={n} className="badge-verde">{n}</span>)}</div>
                      : <span className="text-xs text-gray-400 dark:text-gray-500">—</span>}
                  </td>
                  <td className="td"><span className={c.activo ? "badge-verde" : "badge-rojo"}>{c.activo ? "activa" : "inactiva"}</span></td>
                  <td className="td whitespace-nowrap">
                    {c.rol === "FORMADOR" && c.formador && (
                      <button className="btn-secondary mr-1 text-xs" onClick={() => sel?.id === c.id ? setSel(null) : gestionar(c)}>
                        {sel?.id === c.id ? "Cerrar" : "Gestionar"}
                      </button>
                    )}
                    {(c.rol !== "SUPER_ADMIN" || yo?.rol === "SUPER_ADMIN") && c.id !== yo?.id && (
                      <button className="btn-secondary mr-1 text-xs" onClick={() => abrirEdicion(c)}>Editar</button>
                    )}
                    {c.id !== yo?.id && c.rol !== "SUPER_ADMIN" && (
                      <button className={`text-xs ${c.activo ? "btn-danger" : "btn-primary"}`} onClick={() => toggle(c)}>
                        {c.activo ? "Desactivar" : "Activar"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {sel && formadorDe(sel) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="card">
            <h3 className="font-semibold text-primary dark:text-primary-soft">{sel.nombreCompleto}</h3>
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">{sel.correo}</div>
            <div className="form-section-title">Cursos que puede impartir</div>
            {msgCursos && (
              <div className={`mb-2 rounded-lg px-3 py-2 text-xs font-medium ${
                msgCursos.tipo === "ok"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-200"
                  : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-200"
              }`}>{msgCursos.texto}</div>
            )}
            <ChipsCursos
              cursos={cursosActivos}
              esActivo={id => formadorDe(sel)!.cursos.some(x => x.id === id)}
              onToggle={id => toggleCursoFormador(id, formadorDe(sel)!.cursos.some(x => x.id === id))}
            />
          </div>

          <div className="card">
            <h3 className="font-semibold text-primary dark:text-primary-soft mb-3">Disponibilidad semanal</h3>
            {msgFranjas && (
              <div className={`mb-3 rounded-lg px-3 py-2 text-xs font-medium ${
                msgFranjas.tipo === "ok"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-200"
                  : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-200"
              }`}>{msgFranjas.texto}</div>
            )}
            {[...franjas].sort((a, b) => a.diaSemana - b.diaSemana || a.horaInicio - b.horaInicio).map(f => (
              <div key={`${f.diaSemana}-${f.horaInicio}-${f.horaFin}`} className="flex items-center gap-2 border-b border-gray-100 dark:border-night-800 py-2 text-sm">
                <span className="w-24">{DIAS[f.diaSemana]}</span>
                <span className="font-mono">{mm(f.horaInicio)}–{mm(f.horaFin)}</span>
                <button
                  className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 text-red-500 transition hover:border-red-300 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:text-red-400 dark:hover:border-red-800 dark:hover:bg-red-950/40"
                  title="Quitar franja" aria-label={`Quitar franja del ${DIAS[f.diaSemana]}`}
                  disabled={guardandoFranjas}
                  onClick={() => guardarFranjas(franjas.filter(x => x !== f))}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6" /><path d="M14 11v6" />
                  </svg>
                </button>
              </div>
            ))}
            {!franjas.length && <p className="text-sm text-gray-500 dark:text-gray-400">Sin franjas configuradas.</p>}
            <div className="mt-3 flex flex-wrap items-end gap-1.5">
              <Select className="w-20 shrink-0" arriba value={String(nuevaFranja.diaSemana)} onChange={v => setNuevaFranja({ ...nuevaFranja, diaSemana: Number(v) })}
                opciones={DIAS_CORTO.slice(1).map((d, i) => ({ value: String(i + 1), label: d }))} />
              <input type="time" className="input-base w-30 !px-2" value={nuevaFranja.inicio} onChange={e => setNuevaFranja({ ...nuevaFranja, inicio: e.target.value })} />
              <input type="time" className="input-base w-30 !px-2" value={nuevaFranja.fin} onChange={e => setNuevaFranja({ ...nuevaFranja, fin: e.target.value })} />
              <button className="btn-primary" disabled={guardandoFranjas}
                onClick={() => guardarFranjas([...franjas, { diaSemana: nuevaFranja.diaSemana, horaInicio: aMin(nuevaFranja.inicio), horaFin: aMin(nuevaFranja.fin) }])}>
                {guardandoFranjas ? "Guardando…" : "Añadir"}
              </button>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-primary dark:text-primary-soft mb-3">Excepciones</h3>
            {msgExc && (
              <div className={`mb-3 rounded-lg px-3 py-2 text-xs font-medium ${
                msgExc.tipo === "ok"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-200"
                  : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-200"
              }`}>{msgExc.texto}</div>
            )}
            {excepciones.map(e => (
              <div key={e.id} className="flex items-center gap-2 border-b border-gray-100 dark:border-night-800 py-2 text-sm">
                <span className="badge-amarillo shrink-0">{e.tipo.replaceAll("_", " ")}</span>
                <div className="min-w-0">
                  <div className="font-mono text-xs">{fmtFecha(e.iniciaAt)} → {fmtFecha(e.terminaAt)}</div>
                  {e.motivo && <div className="truncate text-xs text-gray-500 dark:text-gray-400">{e.motivo}</div>}
                </div>
                <button
                  className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-red-200 text-red-500 transition hover:border-red-300 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:text-red-400 dark:hover:border-red-800 dark:hover:bg-red-950/40"
                  title="Eliminar excepción" aria-label={`Eliminar excepción ${e.tipo.replaceAll("_", " ")}`}
                  disabled={guardandoExc}
                  onClick={() => eliminarExcepcion(e.id)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6" /><path d="M14 11v6" />
                  </svg>
                </button>
              </div>
            ))}
            {!excepciones.length && <p className="text-sm text-gray-500 dark:text-gray-400">Sin excepciones.</p>}
            <div className="mt-3 space-y-2">
              <Select arriba value={exc.tipo} onChange={v => setExc({ ...exc, tipo: v })}
                opciones={TIPOS_EXC.map(t => ({ value: t, label: t.replaceAll("_", " ") }))} />
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="label-base">Desde</label>
                  <input type="datetime-local" className="input-base !px-2 text-xs" value={exc.iniciaAt} onChange={e => setExc({ ...exc, iniciaAt: e.target.value })} />
                </div>
                <div>
                  <label className="label-base">Hasta</label>
                  <input type="datetime-local" className="input-base !px-2 text-xs" value={exc.terminaAt} onChange={e => setExc({ ...exc, terminaAt: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2">
                <input className="input-base flex-1" placeholder="Motivo (opcional)" value={exc.motivo} onChange={e => setExc({ ...exc, motivo: e.target.value })} />
                <button className="btn-primary shrink-0" onClick={agregarExcepcion} disabled={!exc.iniciaAt || !exc.terminaAt || guardandoExc}>
                  {guardandoExc ? "Guardando…" : "Añadir"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {cursoFormadores && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="card scroll-fino max-h-[90vh] w-full max-w-md overflow-auto p-6">
            <h3 className="text-lg font-semibold text-primary dark:text-primary-soft">Formadores de {cursoFormadores.nombre}</h3>
            <div className="mt-3"><ErrorMsg msg={errorFormadores} /></div>
            <div>
              {cursoFormadores.formadores.length === 0 && (
                <p className="py-2 text-sm text-gray-500 dark:text-gray-400">Sin formadores asignados.</p>
              )}
              {cursoFormadores.formadores.map(f => (
                <div key={f.formador.id} className="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-night-800 py-2 text-sm">
                  <span>{f.formador.cuenta.nombreCompleto}</span>
                  <button
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-red-200 text-red-500 transition hover:border-red-300 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:border-red-800 dark:hover:bg-red-950/40"
                    title="Quitar formador" aria-label={`Quitar a ${f.formador.cuenta.nombreCompleto} de ${cursoFormadores.nombre}`}
                    onClick={() => quitarFormadorCurso(f.formador.id)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                      <path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6" /><path d="M14 11v6" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="form-section">
              <div className="form-section-title">Agregar formador</div>
              <div className="flex items-start gap-2">
                <Select className="flex-1" value={formadorAgregarId} onChange={setFormadorAgregarId}
                  opciones={candidatos.map(f => ({ value: f.id, label: f.nombre }))}
                  placeholder={candidatos.length ? "Selecciona un formador" : "No hay formadores disponibles"} />
                <button className="btn-primary" disabled={!formadorAgregarId} onClick={agregarFormadorCurso}>Agregar</button>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 dark:border-night-800 pt-4">
              <button className="btn-secondary" onClick={() => setCursoFormadoresId(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
      {editCuenta && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="card scroll-fino max-h-[90vh] w-full max-w-lg overflow-auto p-6">
            <h3 className="text-lg font-semibold text-primary dark:text-primary-soft">Editar cuenta</h3>
            <div className="mt-2"><ErrorMsg msg={errorEdicion} /></div>
            <form onSubmit={e => { e.preventDefault(); guardarEdicion(); }}>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label-base">Usuario</label>
                <input className="input-base" value={editCuenta.usuario} onChange={e => setEditCuenta({ ...editCuenta, usuario: e.target.value })} />
              </div>
              <div>
                <label className="label-base">Nombre completo</label>
                <input className="input-base" value={editCuenta.nombreCompleto} onChange={e => setEditCuenta({ ...editCuenta, nombreCompleto: e.target.value })} />
              </div>
              <div>
                <label className="label-base">Correo</label>
                <input className="input-base" type="email" value={editCuenta.correo} onChange={e => setEditCuenta({ ...editCuenta, correo: e.target.value })} />
              </div>
              <div>
                <label className="label-base">Rol</label>
                <Select value={editCuenta.rol} onChange={v => setEditCuenta({ ...editCuenta, rol: v })}
                  opciones={rolesCrear.map(r => ({ value: r, label: r.replaceAll("_", " ") }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="label-base">Nueva contraseña (opcional — mín. 10)</label>
                <input className="input-base" type="password" placeholder="Dejar vacío para conservar la actual"
                  value={editCuenta.password} onChange={e => setEditCuenta({ ...editCuenta, password: e.target.value })} />
              </div>
            </div>
            {editCuenta.rol === "FORMADOR" && (
              <div className="form-section">
                <div className="form-section-title">Cursos que puede impartir</div>
                <ChipsCursos
                  cursos={cursosActivos}
                  esActivo={id => editCuenta.cursoIds.includes(id)}
                  onToggle={id => setEditCuenta({
                    ...editCuenta,
                    cursoIds: editCuenta.cursoIds.includes(id)
                      ? editCuenta.cursoIds.filter(x => x !== id)
                      : [...editCuenta.cursoIds, id],
                  })}
                />
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 dark:border-night-800 pt-4">
              <button type="button" className="btn-secondary" onClick={() => setEditCuenta(null)}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={enviando}>
                {enviando ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
