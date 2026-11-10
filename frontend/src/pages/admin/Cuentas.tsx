import { useEffect, useState } from "react";
import { api, mensajeError } from "../../api/client";
import { AdminLayout } from "../../components/Layout";
import { Spinner, ErrorMsg, OkMsg, Select, fmtFecha } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";

interface CuentaRow {
  id: string; usuario: string; correo: string; rol: string;
  nombreCompleto: string; activo: boolean;
  formador: { id: string; cursos: string[] } | null;
}
interface CursoRow {
  id: string; nombre: string; descripcion?: string | null; activo: boolean;
  formadores: { formador: { cuenta: { nombreCompleto: string } } }[];
}
interface FormadorRow { id: string; cuentaId: string; cursos: { id: string; nombre: string }[] }
interface Franja { diaSemana: number; horaInicio: number; horaFin: number }
interface Excepcion { id: string; tipo: string; iniciaAt: string; terminaAt: string; motivo?: string | null }

const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const TIPOS_EXC = ["VACACIONES", "INCAPACIDAD", "CALAMIDAD", "PERMISO", "BLOQUEO_ADMINISTRATIVO", "FECHA_ESPECIAL"];
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

  // Edición de cuenta
  const [editCuenta, setEditCuenta] = useState<{
    cuenta: CuentaRow; usuario: string; correo: string; nombreCompleto: string;
    rol: string; password: string; cursoIds: string[];
  } | null>(null);

  // Detalle de formador seleccionado
  const [sel, setSel] = useState<CuentaRow | null>(null);
  const [franjas, setFranjas] = useState<Franja[]>([]);
  const [excepciones, setExcepciones] = useState<Excepcion[]>([]);
  const [nuevaFranja, setNuevaFranja] = useState({ diaSemana: 1, inicio: "08:00", fin: "12:00" });
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

  // ── Detalle del formador ──
  const formadorDe = (c: CuentaRow) => formadores.find(f => f.cuentaId === c.id);

  // ── Edición de cuenta ──
  const abrirEdicion = (c: CuentaRow) => setEditCuenta({
    cuenta: c, usuario: c.usuario, correo: c.correo, nombreCompleto: c.nombreCompleto,
    rol: c.rol, password: "", cursoIds: formadorDe(c)?.cursos.map(x => x.id) ?? [],
  });

  const guardarEdicion = async () => {
    if (!editCuenta) return;
    setError(null);
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9._\- ]{3,40}$/.test(editCuenta.usuario.trim()))
      return setError("El usuario debe tener 3–40 caracteres: solo letras, números, espacios, punto y guion");
    if (editCuenta.nombreCompleto.trim().length < 3)
      return setError("El nombre completo debe tener al menos 3 caracteres");
    if (!/^\S+@\S+\.\S+$/.test(editCuenta.correo.trim()))
      return setError("El correo no es válido");
    if (editCuenta.password && editCuenta.password.length < 10)
      return setError("La contraseña debe tener mínimo 10 caracteres");
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
    } catch (e) { setError(mensajeError(e)); } finally { setEnviando(false); }
  };

  const gestionar = async (c: CuentaRow) => {
    const f = formadorDe(c);
    if (!f) return;
    setSel(c); setError(null);
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
      cargar();
    } catch (e) { setError(mensajeError(e)); }
  };

  const guardarFranjas = async () => {
    const f = sel && formadorDe(sel);
    if (!f) return;
    try {
      await api.put(`/admin/formadores/${f.id}/disponibilidad`, { franjas });
      setOk("Disponibilidad actualizada");
    } catch (e) { setError(mensajeError(e)); }
  };

  const agregarExcepcion = async () => {
    const f = sel && formadorDe(sel);
    if (!f) return;
    try {
      await api.post(`/admin/formadores/${f.id}/excepciones`, {
        tipo: exc.tipo,
        iniciaAt: new Date(exc.iniciaAt).toISOString(),
        terminaAt: new Date(exc.terminaAt).toISOString(),
        motivo: exc.motivo || undefined,
      });
      setOk("Excepción registrada"); gestionar(sel!);
    } catch (e) { setError(mensajeError(e)); }
  };

  const eliminarExcepcion = async (excepcionId: string) => {
    const f = sel && formadorDe(sel);
    if (!f) return;
    await api.delete(`/admin/formadores/${f.id}/excepciones/${excepcionId}`);
    gestionar(sel!);
  };

  const rolesCrear = yo?.rol === "SUPER_ADMIN" ? ["FORMADOR", "ADMIN", "SUPER_ADMIN"] : ["FORMADOR"];

  return (
    <AdminLayout titulo="Cuentas y cursos">
      <ErrorMsg msg={error} /><OkMsg msg={ok} />

      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="font-semibold text-primary mb-3">Nueva cuenta</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="input-base" placeholder="Usuario" value={nueva.usuario} onChange={e => setNueva({ ...nueva, usuario: e.target.value })} />
            <input className="input-base" placeholder="Nombre completo" value={nueva.nombreCompleto} onChange={e => setNueva({ ...nueva, nombreCompleto: e.target.value })} />
            <input className="input-base" type="email" placeholder="Correo" value={nueva.correo} onChange={e => setNueva({ ...nueva, correo: e.target.value })} />
            <input className="input-base" type="password" placeholder="Contraseña (mín. 10)" value={nueva.password} onChange={e => setNueva({ ...nueva, password: e.target.value })} />
            <Select value={nueva.rol} onChange={v => { setNueva({ ...nueva, rol: v }); setCursoIds([]); }}
              opciones={rolesCrear.map(r => ({ value: r, label: r }))} />
            <button className="btn-primary" disabled={enviando} onClick={crear}>
              {enviando ? "Creando…" : "Crear"}
            </button>
          </div>
          {nueva.rol === "FORMADOR" && (
            <div className="form-section">
              <div className="form-section-title">Cursos que puede impartir</div>
              {cursosActivos.length === 0 && <p className="text-sm text-gray-500">Primero crea un curso en el panel de la derecha.</p>}
              <div className="flex flex-wrap gap-2">
                {cursosActivos.map(c => {
                  const activo = cursoIds.includes(c.id);
                  return (
                    <button key={c.id} type="button" onClick={() => toggleNuevoCurso(c.id)}
                      className={`rounded-full border px-3 py-1 text-sm transition ${activo ? "border-primary bg-primary text-white" : "border-gray-300 hover:border-primary"}`}>
                      {c.nombre}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="font-semibold text-primary mb-3">Cursos</h3>
          <div className="flex gap-2 mb-3">
            <input className="input-base flex-1" placeholder="Nombre del curso" value={nuevoCurso.nombre} onChange={e => setNuevoCurso({ ...nuevoCurso, nombre: e.target.value })} />
            <input className="input-base flex-1" placeholder="Descripción" value={nuevoCurso.descripcion} onChange={e => setNuevoCurso({ ...nuevoCurso, descripcion: e.target.value })} />
            <button className="btn-primary" disabled={nuevoCurso.nombre.length < 3} onClick={crearCurso}>Crear</button>
          </div>
          {!cursos ? <Spinner /> : (
            <div className="max-h-80 overflow-auto">
              {cursos.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-2 border-b border-gray-100 py-2 text-sm">
                  {editando?.id === c.id ? (
                    <>
                      <input className="input-base flex-1" value={editando.nombre} onChange={e => setEditando({ ...editando, nombre: e.target.value })} />
                      <input className="input-base flex-1" value={editando.descripcion ?? ""} onChange={e => setEditando({ ...editando, descripcion: e.target.value })} />
                      <label className="text-xs"><input type="checkbox" checked={editando.activo} onChange={e => setEditando({ ...editando, activo: e.target.checked })} /> activo</label>
                      <button className="btn-primary text-xs" onClick={guardarCurso}>Guardar</button>
                    </>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <div className="font-medium">{c.nombre} {!c.activo && <span className="badge-gris">inactivo</span>}</div>
                        <div className="truncate text-xs text-gray-500">
                          {c.descripcion || "—"} · {c.formadores.length ? c.formadores.map(f => f.formador.cuenta.nombreCompleto).join(", ") : "sin formadores"}
                        </div>
                      </div>
                      <button className="btn-secondary text-xs" onClick={() => setEditando({ ...c })}>Editar</button>
                    </>
                  )}
                </div>
              ))}
              {!cursos.length && <p className="text-sm text-gray-500">Aún no hay cursos creados.</p>}
            </div>
          )}
        </div>
      </div>

      <div className="card mt-4 overflow-auto">
        <h3 className="font-semibold text-primary mb-3">Cuentas</h3>
        {!lista ? <Spinner /> : (
          <table className="w-full">
            <thead><tr><th className="th">Usuario</th><th className="th">Nombre</th><th className="th">Correo</th><th className="th">Rol</th><th className="th">Cursos</th><th className="th">Estado</th><th className="th"></th></tr></thead>
            <tbody>
              {lista.map(c => (
                <tr key={c.id} className={`border-t border-gray-100 ${sel?.id === c.id ? "bg-primary/5" : ""}`}>
                  <td className="td font-mono">{c.usuario}</td>
                  <td className="td">{c.nombreCompleto}</td>
                  <td className="td">{c.correo}</td>
                  <td className="td"><span className="badge-azul">{c.rol}</span></td>
                  <td className="td">
                    {c.formador
                      ? <div className="flex flex-wrap gap-1">{c.formador.cursos.map(n => <span key={n} className="badge-verde">{n}</span>)}</div>
                      : <span className="text-xs text-gray-400">—</span>}
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
            <h3 className="font-semibold text-primary">{sel.nombreCompleto}</h3>
            <div className="text-sm text-gray-500 mb-3">{sel.correo}</div>
            <div className="form-section-title">Cursos que puede impartir</div>
            <div className="flex flex-wrap gap-2">
              {(cursos ?? []).map(c => {
                const hab = formadorDe(sel)!.cursos.some(x => x.id === c.id);
                return (
                  <button key={c.id} onClick={() => toggleCursoFormador(c.id, hab)}
                    className={`rounded-full border px-3 py-1 text-sm transition ${hab ? "border-primary bg-primary text-white" : "border-gray-300 hover:border-primary"}`}>
                    {c.nombre}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-primary mb-3">Disponibilidad semanal</h3>
            {franjas.sort((a, b) => a.diaSemana - b.diaSemana || a.horaInicio - b.horaInicio).map((f, i) => (
              <div key={i} className="flex items-center gap-2 py-1 text-sm">
                <span className="w-24">{DIAS[f.diaSemana]}</span>
                <span>{mm(f.horaInicio)}–{mm(f.horaFin)}</span>
                <button className="ml-auto text-xs text-red-500" onClick={() => setFranjas(franjas.filter((_, j) => j !== i))}>quitar</button>
              </div>
            ))}
            {!franjas.length && <p className="text-sm text-gray-500">Sin franjas configuradas.</p>}
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Select className="w-36" value={String(nuevaFranja.diaSemana)} onChange={v => setNuevaFranja({ ...nuevaFranja, diaSemana: Number(v) })}
                opciones={DIAS.slice(1).map((d, i) => ({ value: String(i + 1), label: d }))} />
              <input type="time" className="input-base w-28" value={nuevaFranja.inicio} onChange={e => setNuevaFranja({ ...nuevaFranja, inicio: e.target.value })} />
              <input type="time" className="input-base w-28" value={nuevaFranja.fin} onChange={e => setNuevaFranja({ ...nuevaFranja, fin: e.target.value })} />
              <button className="btn-secondary" onClick={() => setFranjas([...franjas, { diaSemana: nuevaFranja.diaSemana, horaInicio: aMin(nuevaFranja.inicio), horaFin: aMin(nuevaFranja.fin) }])}>Añadir</button>
              <button className="btn-primary" onClick={guardarFranjas}>Guardar</button>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-primary mb-3">Excepciones</h3>
            {excepciones.map(e => (
              <div key={e.id} className="flex items-center gap-2 border-b border-gray-100 py-1 text-sm">
                <span className="badge-amarillo">{e.tipo}</span>
                <span>{fmtFecha(e.iniciaAt)} → {fmtFecha(e.terminaAt)}</span>
                <span className="text-xs text-gray-500">{e.motivo}</span>
                <button className="ml-auto text-xs text-red-500" onClick={() => eliminarExcepcion(e.id)}>eliminar</button>
              </div>
            ))}
            {!excepciones.length && <p className="text-sm text-gray-500">Sin excepciones.</p>}
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Select value={exc.tipo} onChange={v => setExc({ ...exc, tipo: v })}
                opciones={TIPOS_EXC.map(t => ({ value: t, label: t }))} />
              <input type="datetime-local" className="input-base flex-1" value={exc.iniciaAt} onChange={e => setExc({ ...exc, iniciaAt: e.target.value })} />
              <input type="datetime-local" className="input-base flex-1" value={exc.terminaAt} onChange={e => setExc({ ...exc, terminaAt: e.target.value })} />
              <input className="input-base flex-1" placeholder="Motivo" value={exc.motivo} onChange={e => setExc({ ...exc, motivo: e.target.value })} />
              <button className="btn-primary" onClick={agregarExcepcion} disabled={!exc.iniciaAt || !exc.terminaAt}>Añadir</button>
            </div>
          </div>
        </div>
      )}
      {editCuenta && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="card max-h-[90vh] w-full max-w-lg overflow-auto p-6">
            <h3 className="text-lg font-semibold text-primary">Editar cuenta</h3>
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
                  opciones={rolesCrear.map(r => ({ value: r, label: r }))} />
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
                <div className="flex flex-wrap gap-2">
                  {(cursos ?? []).map(c => {
                    const activo = editCuenta.cursoIds.includes(c.id);
                    return (
                      <button key={c.id} type="button"
                        onClick={() => setEditCuenta({
                          ...editCuenta,
                          cursoIds: activo ? editCuenta.cursoIds.filter(x => x !== c.id) : [...editCuenta.cursoIds, c.id],
                        })}
                        className={`rounded-full border px-3 py-1 text-sm transition ${activo ? "border-primary bg-primary text-white" : "border-gray-300 hover:border-primary"}`}>
                        {c.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4">
              <button className="btn-secondary" onClick={() => setEditCuenta(null)}>Cancelar</button>
              <button className="btn-primary" disabled={enviando} onClick={guardarEdicion}>
                {enviando ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
