import { useEffect, useMemo, useState } from "react";
import { api, mensajeError } from "../../api/client";
import { PublicLayout } from "../../components/Layout";
import { Spinner, ErrorMsg, OkMsg, IconoExito, Select, fmtHora } from "../../components/ui";
import { Curso, CatalogoItem, Franja, DisponibilidadPublica } from "../../api/types";

const PASOS = ["Curso", "Fecha y hora", "Tus datos", "Confirmación"];
const enCA = (d: string | Date) => new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

export default function SolicitarFormacion() {
  const [paso, setPaso] = useState(0);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [facultades, setFacultades] = useState<CatalogoItem[]>([]);
  const [franjas, setFranjas] = useState<Franja[]>([]);
  const [ocupados, setOcupados] = useState<Franja[]>([]);
  const [cargandoFranjas, setCargandoFranjas] = useState(false);
  const [anticipacionDias, setAnticipacionDias] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmacion, setConfirmacion] = useState<{ codigo: string } | null>(null);

  const [f, setF] = useState({
    cursoId: "", fecha: "", horaInicio: "", horaFin: "",
    docenteNombre: "", docenteCorreo: "", docenteTelefono: "", aula: "", facultadId: "",
  });
  const [idemKey] = useState(() => crypto.randomUUID());
  const [mesVisible, setMesVisible] = useState(() => {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  });
  const [franjaSel, setFranjaSel] = useState<Franja | null>(null);

  useEffect(() => {
    api.get("/publico/cursos").then(r => setCursos(r.data)).catch(() => {});
    api.get("/publico/facultades").then(r => setFacultades(r.data)).catch(() => {});
  }, []);

  // Consultar disponibilidad de los próximos 30 días al elegir curso
  useEffect(() => {
    setFranjaSel(null);
    if (!f.cursoId) { setFranjas([]); setOcupados([]); return; }
    setCargandoFranjas(true);
    const desde = new Date();
    const hasta = new Date(Date.now() + 30 * 86400000);
    api.get<DisponibilidadPublica>("/publico/disponibilidad", {
      params: { cursoId: f.cursoId, desde: desde.toISOString(), hasta: hasta.toISOString() },
    })
      .then(r => {
        setFranjas(r.data.libres); setOcupados(r.data.ocupados);
        if (typeof r.data.anticipacionMinimaDias === "number") setAnticipacionDias(r.data.anticipacionMinimaDias);
      })
      .catch(() => { setFranjas([]); setOcupados([]); })
      .finally(() => setCargandoFranjas(false));
  }, [f.cursoId]);

  // Límite por días de calendario: medianoche de hoy (Bogotá) + N días;
  // a partir de ahí el día completo queda reservable.
  const limiteAnticipacion = useMemo(
    () => new Date(`${enCA(new Date())}T00:00:00-05:00`).getTime() + anticipacionDias * 864e5,
    [anticipacionDias],
  );

  // Días con al menos una franja reservable (respeta la anticipación mínima)
  const diasDisponibles = useMemo(() => {
    const s = new Set<string>();
    for (const fr of franjas) {
      if (new Date(fr.fin).getTime() > limiteAnticipacion) s.add(enCA(fr.inicio));
    }
    return s;
  }, [franjas, limiteAnticipacion]);

  const franjasDelDia = useMemo(
    () => franjas.filter(fr => enCA(fr.inicio) === f.fecha && new Date(fr.fin).getTime() > limiteAnticipacion),
    [franjas, f.fecha, limiteAnticipacion],
  );

  // Segmentos del día para la barra de tiempo: libres (clicables) + ocupados
  const segmentosDelDia = useMemo(() => {
    const libresDia = franjasDelDia.map(fr => ({
      ini: new Date(fr.inicio).getTime(), fin: new Date(fr.fin).getTime(),
      ocupado: false as const, fr,
    }));
    const ocupDia = ocupados
      .filter(o => enCA(o.inicio) === f.fecha)
      .map(o => ({
        ini: new Date(o.inicio).getTime(), fin: new Date(o.fin).getTime(),
        ocupado: true as const,
      }));
    return [...libresDia, ...ocupDia].sort((a, b) => a.ini - b.ini);
  }, [franjasDelDia, ocupados, f.fecha]);

  const ejeMin = segmentosDelDia.length ? segmentosDelDia[0].ini : 0;
  const ejeMax = segmentosDelDia.length ? Math.max(...segmentosDelDia.map(s => s.fin)) : 1;

  // Celdas del calendario mensual (semana inicia en lunes)
  const celdas = useMemo(() => {
    const y = mesVisible.getFullYear(), m = mesVisible.getMonth();
    const offset = (new Date(y, m, 1).getDay() + 6) % 7;
    const total = new Date(y, m + 1, 0).getDate();
    const arr: (Date | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= total; d++) arr.push(new Date(y, m, d));
    return arr;
  }, [mesVisible]);

  const { mesMin, mesMax } = useMemo(() => {
    const min = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const tope = new Date(Date.now() + 30 * 86400000);
    return { mesMin: min, mesMax: new Date(tope.getFullYear(), tope.getMonth(), 1) };
  }, []);

  // Límites de la franja elegida (el inicio se ajusta a la anticipación mínima)
  const iniFranja = franjaSel ? Math.max(new Date(franjaSel.inicio).getTime(), limiteAnticipacion) : 0;
  const finFranja = franjaSel ? new Date(franjaSel.fin).getTime() : 0;
  const selIni = f.fecha && f.horaInicio ? new Date(`${f.fecha}T${f.horaInicio}:00-05:00`).getTime() : 0;
  const selFin = f.fecha && f.horaFin ? new Date(`${f.fecha}T${f.horaFin}:00-05:00`).getTime() : 0;
  const horarioValido = Boolean(franjaSel) && selIni >= iniFranja && selFin <= finFranja && selFin > selIni;

  const elegirDia = (d: Date) => {
    setF(prev => ({ ...prev, fecha: enCA(d), horaInicio: "", horaFin: "" }));
    setFranjaSel(null);
  };

  const elegirFranja = (fr: Franja) => {
    setFranjaSel(fr);
    const ini = Math.max(new Date(fr.inicio).getTime(), limiteAnticipacion);
    setF(prev => ({ ...prev, horaInicio: fmtHora(new Date(ini)), horaFin: fmtHora(fr.fin) }));
  };

  const enviar = async () => {
    setEnviando(true); setError(null);
    try {
      const iniciaAt = new Date(`${f.fecha}T${f.horaInicio}:00-05:00`);
      const terminaAt = new Date(`${f.fecha}T${f.horaFin}:00-05:00`);
      const r = await api.post("/publico/reservas", {
        docenteNombre: f.docenteNombre,
        docenteCorreo: f.docenteCorreo,
        docenteTelefono: f.docenteTelefono || undefined,
        aula: f.aula || undefined,
        facultadId: f.facultadId || undefined,
        cursoId: f.cursoId,
        iniciaAt: iniciaAt.toISOString(),
        terminaAt: terminaAt.toISOString(),
        idempotencyKey: idemKey,
      });
      setConfirmacion(r.data);
      setPaso(3);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <PublicLayout>
      <div className="mt-4 mb-6 flex gap-2">
        {PASOS.slice(0, 3).map((p, i) => (
          <div key={p} className={`flex-1 text-center text-xs py-2 rounded-full ${paso >= i ? "bg-primary text-white" : "bg-gray-200 text-gray-500"}`}>
            {i + 1}. {p}
          </div>
        ))}
      </div>

      <div className="card">
        <ErrorMsg msg={error} />

        {paso === 0 && (
          <div>
            <h2 className="font-semibold text-primary mb-3">Elige el curso</h2>
            <div className="grid gap-2">
              {cursos.map(c => (
                <button key={c.id} type="button"
                  className={`text-left rounded-xl border p-4 transition ${f.cursoId === c.id ? "border-primary bg-primary/10" : "border-gray-200 hover:border-primary"}`}
                  onClick={() => { setF({ ...f, cursoId: c.id, fecha: "", horaInicio: "", horaFin: "" }); setFranjaSel(null); setPaso(1); }}>
                  <div className="font-medium">{c.nombre}</div>
                  {c.descripcion && <div className="text-sm text-gray-500 mt-1">{c.descripcion}</div>}
                </button>
              ))}
              {!cursos.length && <p className="text-sm text-gray-500">No hay cursos disponibles por ahora.</p>}
            </div>
          </div>
        )}

        {paso === 1 && (
          <div>
            <h2 className="font-semibold text-primary mb-3">Fecha y horario</h2>
            {cargandoFranjas ? <Spinner /> : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <button type="button" className="btn-secondary px-3 py-1" disabled={mesVisible <= mesMin}
                      onClick={() => setMesVisible(new Date(mesVisible.getFullYear(), mesVisible.getMonth() - 1, 1))}>‹</button>
                    <div className="font-medium text-primary capitalize">
                      {mesVisible.toLocaleDateString("es-CO", { month: "long", year: "numeric" })}
                    </div>
                    <button type="button" className="btn-secondary px-3 py-1" disabled={mesVisible >= mesMax}
                      onClick={() => setMesVisible(new Date(mesVisible.getFullYear(), mesVisible.getMonth() + 1, 1))}>›</button>
                  </div>
                  <div className="grid grid-cols-7 text-center text-xs text-gray-500 mb-1">
                    {["L", "M", "X", "J", "V", "S", "D"].map(d => <div key={d} className="py-1 font-medium">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {celdas.map((d, i) => {
                      if (!d) return <div key={`v-${i}`} />;
                      const key = enCA(d);
                      const disp = diasDisponibles.has(key);
                      const activo = key === f.fecha;
                      return (
                        <button key={key} type="button" disabled={!disp} onClick={() => elegirDia(d)}
                          className={`aspect-square rounded-lg text-sm transition ${
                            activo ? "bg-primary text-white font-semibold"
                            : disp ? "bg-accent/40 text-primary hover:bg-accent font-medium"
                            : "text-gray-300 cursor-not-allowed"}`}>
                          {d.getDate()}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Los días marcados tienen horarios disponibles.</p>
                </div>

                <div>
                  {!f.fecha ? (
                    <p className="text-sm text-gray-500">Elige un día en el calendario para ver los horarios.</p>
                  ) : (
                    <>
                      <div className="label-base mb-2 capitalize">
                        {new Date(`${f.fecha}T12:00:00-05:00`).toLocaleDateString("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long" })}
                      </div>

                      {segmentosDelDia.length > 0 && (
                        <div className="mb-4">
                          <div className="relative h-9 w-full overflow-hidden rounded-lg bg-gray-100">
                            {segmentosDelDia.map(s => {
                              const left = ((s.ini - ejeMin) / (ejeMax - ejeMin)) * 100;
                              const width = ((s.fin - s.ini) / (ejeMax - ejeMin)) * 100;
                              const etiqueta = `${fmtHora(new Date(s.ini))}–${fmtHora(new Date(s.fin))}`;
                              return (
                                <button key={`${s.ini}-${s.ocupado}`} type="button"
                                  disabled={s.ocupado}
                                  onClick={() => { if (!s.ocupado && s.fr) elegirFranja(s.fr); }}
                                  style={{ left: `${left}%`, width: `${width}%` }}
                                  title={`${s.ocupado ? "Ocupado" : "Disponible"} ${etiqueta}`}
                                  className={`absolute inset-y-0 border-r border-white last:border-0 ${
                                    s.ocupado ? "bg-gray-300 cursor-not-allowed" : "bg-primary/80 hover:bg-primary cursor-pointer"}`}
                                />
                              );
                            })}
                          </div>
                          <div className="mt-1 flex justify-between text-xs text-gray-400">
                            <span>{fmtHora(new Date(ejeMin))}</span>
                            <span>{fmtHora(new Date(ejeMax))}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-primary/80" />Disponible</span>
                            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-gray-300" />Ocupado</span>
                            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-gray-200 bg-gray-100" />Sin horario</span>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 mb-4">
                        {segmentosDelDia.map(s => s.ocupado ? (
                          <span key={`o-${s.ini}`}
                            className="rounded-full border border-gray-200 bg-gray-100 px-4 py-2 text-sm text-gray-400">
                            {fmtHora(new Date(s.ini))}–{fmtHora(new Date(s.fin))} · ocupado
                          </span>
                        ) : (
                          <button key={`l-${s.ini}`} type="button" onClick={() => s.fr && elegirFranja(s.fr)}
                            className={`rounded-full border px-4 py-2 text-sm transition ${
                              franjaSel?.inicio === s.fr?.inicio && franjaSel?.fin === s.fr?.fin
                                ? "border-primary bg-primary text-white"
                                : "border-gray-300 hover:border-primary"}`}>
                            {fmtHora(new Date(s.ini))}–{fmtHora(new Date(s.fin))}
                          </button>
                        ))}
                        {!segmentosDelDia.length && <p className="text-sm text-gray-500">Sin horarios disponibles este día.</p>}
                      </div>
                      {franjaSel && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="label-base">Hora de inicio</label>
                            <input type="time" className="input-base" value={f.horaInicio}
                              min={fmtHora(new Date(iniFranja))} max={fmtHora(new Date(finFranja))}
                              onChange={e => setF({ ...f, horaInicio: e.target.value })} />
                          </div>
                          <div>
                            <label className="label-base">Hora de finalización</label>
                            <input type="time" className="input-base" value={f.horaFin}
                              min={f.horaInicio} max={fmtHora(new Date(finFranja))}
                              onChange={e => setF({ ...f, horaFin: e.target.value })} />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button className="btn-secondary" onClick={() => setPaso(0)}>Atrás</button>
              <button className="btn-primary flex-1" disabled={!horarioValido} onClick={() => setPaso(2)}>Continuar</button>
            </div>
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-primary">Tus datos</h2>
            <div>
              <label className="label-base">Nombre completo *</label>
              <input className="input-base" value={f.docenteNombre} onChange={e => setF({ ...f, docenteNombre: e.target.value })} />
            </div>
            <div>
              <label className="label-base">Correo institucional *</label>
              <input type="email" className="input-base" value={f.docenteCorreo} onChange={e => setF({ ...f, docenteCorreo: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-base">Teléfono</label>
                <input type="tel" className="input-base" placeholder="Ej: 300 123 4567"
                  value={f.docenteTelefono} onChange={e => setF({ ...f, docenteTelefono: e.target.value })} />
              </div>
              <div>
                <label className="label-base">Aula / lugar</label>
                <input className="input-base" placeholder="Ej: Aula 204, Bloque B"
                  value={f.aula} onChange={e => setF({ ...f, aula: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label-base">Facultad</label>
              <Select value={f.facultadId} onChange={v => setF({ ...f, facultadId: v })}
                opciones={[{ value: "", label: "Selecciona tu facultad" }, ...facultades.map(x => ({ value: x.id, label: x.nombre }))]} />
            </div>
            <div className="text-sm bg-gray-50 rounded-xl p-3">
              <strong>Resumen:</strong> {cursos.find(c => c.id === f.cursoId)?.nombre} · {f.fecha} · {f.horaInicio}–{f.horaFin}
              {f.aula && ` · ${f.aula}`}
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => setPaso(1)}>Atrás</button>
              <button className="btn-primary flex-1" disabled={enviando || !f.docenteNombre || !f.docenteCorreo}
                onClick={enviar}>{enviando ? "Confirmando…" : "Confirmar solicitud"}</button>
            </div>
          </div>
        )}

        {paso === 3 && confirmacion && (
          <div className="text-center py-8">
            <IconoExito />
            <h2 className="mt-4 text-xl font-bold text-primary">Reserva confirmada</h2>
            <p className="mt-2 text-sm text-gray-500">Tu código de reserva es</p>
            <p className="mt-1 inline-block rounded-xl bg-gray-50 px-4 py-2 text-2xl font-mono font-bold tracking-wider text-gray-900">{confirmacion.codigo}</p>
            <div className="mt-4"><OkMsg msg="Recibirás un correo con los detalles y el enlace de cancelación." /></div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
