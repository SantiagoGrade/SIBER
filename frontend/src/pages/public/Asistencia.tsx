import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api, mensajeError } from "../../api/client";
import { PublicLayout } from "../../components/Layout";
import { Spinner, ErrorMsg, Estrellas, IconoExito } from "../../components/ui";
import { CatalogoItem } from "../../api/types";

interface InfoQr { ok: boolean; reservaId?: string; curso?: string; fecha?: string; horaInicio?: string; horaFin?: string; codigo?: string }

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default function Asistencia() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<InfoQr | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [programas, setProgramas] = useState<CatalogoItem[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);

  const [progTexto, setProgTexto] = useState("");
  const [progAbierto, setProgAbierto] = useState(false);
  const [progIdx, setProgIdx] = useState(0);

  const [f, setF] = useState({
    nombreCompleto: "", documento: "", correo: "", programaAcademicoId: "",
    calificacionGeneral: 0, observaciones: "",
  });

  const programasFiltrados = useMemo(
    () => programas.filter(p => normalizar(p.nombre).includes(normalizar(progTexto.trim()))),
    [programas, progTexto]
  );

  const elegirPrograma = (p: CatalogoItem) => {
    setProgTexto(p.nombre);
    setF(prev => ({ ...prev, programaAcademicoId: p.id }));
    setProgAbierto(false);
  };

  useEffect(() => {
    api.get(`/publico/asistencia/${token}`)
      .then(r => setInfo(r.data))
      .catch(e => setError(mensajeError(e)));
    api.get("/publico/programas").then(r => setProgramas(r.data)).catch(() => {});
  }, [token]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true); setError(null);
    try {
      await api.post(`/publico/asistencia/${token}`, {
        nombreCompleto: f.nombreCompleto,
        documento: f.documento,
        correo: f.correo,
        programaAcademicoId: f.programaAcademicoId,
        evaluacion: {
          calificacionGeneral: f.calificacionGeneral,
          observaciones: f.observaciones || undefined,
        },
      });
      setConfirmado(true);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };

  if (error && !info) {
    return <PublicLayout><div className="card mt-6"><ErrorMsg msg={error} /></div></PublicLayout>;
  }
  if (!info) return <PublicLayout><Spinner /></PublicLayout>;

  if (confirmado) {
    return (
      <PublicLayout>
        <div className="card mt-6 text-center py-10">
          <IconoExito />
          <h1 className="mt-4 text-xl font-bold text-primary">¡Gracias por participar!</h1>
          <p className="mt-2 text-sm text-gray-600">Tu asistencia y evaluación quedaron registradas.</p>
        </div>
      </PublicLayout>
    );
  }

  const obligatorioOk =
    f.nombreCompleto.trim() && f.documento.trim() && f.correo.trim() && f.programaAcademicoId &&
    f.calificacionGeneral > 0;

  return (
    <PublicLayout>
      <div className="card mt-4">
        <h1 className="text-lg font-bold text-primary">Registro de asistencia y evaluación</h1>
        <p className="text-sm text-gray-600 mt-1">
          <strong>{info.curso}</strong> · {info.fecha} · {info.horaInicio}–{info.horaFin} · {info.codigo}
        </p>
      </div>

      <form onSubmit={enviar} className="card mt-4 space-y-5">
        <ErrorMsg msg={error} />

        <section>
          <h2 className="form-section-title">Tus datos</h2>
          <div className="space-y-3">
            <div>
              <label className="label-base" htmlFor="nombre">Nombre completo *</label>
              <input id="nombre" className="input-base" required value={f.nombreCompleto}
                onChange={e => setF({ ...f, nombreCompleto: e.target.value })} />
            </div>
            <div>
              <label className="label-base" htmlFor="doc">Número de documento *</label>
              <input id="doc" className="input-base" required inputMode="numeric" value={f.documento}
                onChange={e => setF({ ...f, documento: e.target.value })} />
            </div>
            <div>
              <label className="label-base" htmlFor="correo">Correo institucional *</label>
              <input id="correo" type="email" className="input-base" required value={f.correo}
                onChange={e => setF({ ...f, correo: e.target.value })} />
            </div>
            <div className="relative">
              <label className="label-base" htmlFor="prog">Programa académico *</label>
              <input
                id="prog" className="input-base" required autoComplete="off"
                placeholder="Escribe para filtrar tu programa"
                value={progTexto}
                onFocus={() => { setProgAbierto(true); setProgIdx(0); }}
                onBlur={() => setProgAbierto(false)}
                onChange={e => {
                  setProgTexto(e.target.value);
                  setF({ ...f, programaAcademicoId: "" });
                  setProgAbierto(true);
                  setProgIdx(0);
                }}
                onKeyDown={e => {
                  if (e.key === "Escape") { setProgAbierto(false); return; }
                  if (!progAbierto || !programasFiltrados.length) return;
                  if (e.key === "ArrowDown") { e.preventDefault(); setProgIdx(i => Math.min(i + 1, programasFiltrados.length - 1)); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setProgIdx(i => Math.max(i - 1, 0)); }
                  if (e.key === "Enter") { e.preventDefault(); elegirPrograma(programasFiltrados[progIdx]); }
                }}
              />
              {progAbierto && (
                <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                  {programasFiltrados.length === 0 && (
                    <li className="px-3 py-2 text-sm text-gray-500">Sin resultados</li>
                  )}
                  {programasFiltrados.map((p, i) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className={`w-full px-3 py-2 text-left text-sm ${i === progIdx ? "bg-primary/10 text-primary" : "hover:bg-gray-50"}`}
                        onMouseDown={e => { e.preventDefault(); elegirPrograma(p); }}
                      >
                        {p.nombre}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {progTexto && !f.programaAcademicoId && !progAbierto && (
                <p className="mt-1 text-xs text-amber-700">Selecciona un programa de la lista.</p>
              )}
            </div>
          </div>
        </section>

        <section className="form-section">
          <h2 className="form-section-title">Evalúa la formación</h2>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-700 mb-1">¿Cómo calificas la formación recibida? *</div>
              <Estrellas
                valor={f.calificacionGeneral}
                onChange={v => setF({ ...f, calificacionGeneral: v })}
              />
            </div>

            <div>
              <label className="label-base" htmlFor="obs">Observaciones (opcional)</label>
              <textarea id="obs" className="input-base" rows={3} value={f.observaciones}
                onChange={e => setF({ ...f, observaciones: e.target.value })} />
            </div>
          </div>
        </section>

        <button type="submit" className="btn-primary w-full py-3" disabled={!obligatorioOk || enviando}>
          {enviando ? "Enviando…" : "Registrar asistencia y evaluación"}
        </button>
      </form>
    </PublicLayout>
  );
}
