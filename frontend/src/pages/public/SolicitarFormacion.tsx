import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { api, mensajeError } from "../../api/client";
import { PublicLayout } from "../../components/Layout";
import { Spinner, ErrorMsg, OkMsg, IconoExito, ComboBox, fmtHora, useBloquearScroll } from "../../components/ui";
import { Curso, CatalogoItem, Franja, DisponibilidadPublica } from "../../api/types";

const enCA = (d: string | Date) => new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

function Encabezado({ n, titulo, listo }: { n: number; titulo: string; listo: boolean }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
        listo ? "bg-primary text-white dark:bg-primary-soft dark:text-night-950" : "bg-gray-200 text-gray-500 dark:bg-night-700 dark:text-gray-400"}`}>
        {listo ? "✓" : n}
      </span>
      <h2 className="font-semibold text-primary dark:text-primary-soft">{titulo}</h2>
    </div>
  );
}

export default function SolicitarFormacion() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [facultades, setFacultades] = useState<CatalogoItem[]>([]);
  const [programas, setProgramas] = useState<CatalogoItem[]>([]);
  const [franjas, setFranjas] = useState<Franja[]>([]);
  const [ocupados, setOcupados] = useState<Franja[]>([]);
  const [cargandoFranjas, setCargandoFranjas] = useState(false);
  const [anticipacionDias, setAnticipacionDias] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmacion, setConfirmacion] = useState<{ codigo: string } | null>(null);

  const [f, setF] = useState({
    cursoId: "", fecha: "", horaInicio: "", horaFin: "",
    docenteNombre: "", docenteCorreo: "", docenteTelefono: "", aula: "", facultadId: "", programaAcademicoId: "",
  });
  const [idemKey] = useState(() => crypto.randomUUID());
  const [mesVisible, setMesVisible] = useState(() => {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  });
  const [franjaSel, setFranjaSel] = useState<Franja | null>(null);
  const [cursoExpandido, setCursoExpandido] = useState(false);
  const [revisando, setRevisando] = useState(false);
  useBloquearScroll(revisando);
  const fechaRef = useRef<HTMLElement>(null);

  // 429 (rate limit) merece mensaje propio: el usuario refrescó demasiado
  const avisarFallo = (e: unknown) => setErrorCatalogo(
    axios.isAxiosError(e) && e.response?.status === 429
      ? "Hiciste muchas solicitudes seguidas. Deja descansar el sistema un momento y reintenta en un minuto."
      : mensajeError(e));

  const cargarCatalogos = () => {
    setErrorCatalogo(null);
    api.get("/publico/cursos").then(r => setCursos(r.data)).catch(avisarFallo);
    api.get("/publico/facultades").then(r => setFacultades(r.data)).catch(avisarFallo);
    api.get("/publico/programas").then(r => setProgramas(r.data)).catch(avisarFallo);
  };

  useEffect(() => { cargarCatalogos(); }, []);

  // Con facultad elegida el programa filtra por ella; sin facultad, catálogo completo
  const programasVisibles = useMemo(
    () => (f.facultadId ? programas.filter(p => p.facultadId === f.facultadId) : programas),
    [programas, f.facultadId],
  );

  // Cambiar de facultad conserva el programa solo si pertenece a la nueva
  const elegirFacultad = (v: string) => setF(prev => ({
    ...prev,
    facultadId: v,
    programaAcademicoId:
      prev.programaAcademicoId && programas.find(p => p.id === prev.programaAcademicoId)?.facultadId === v
        ? prev.programaAcademicoId : "",
  }));

  // Elegir programa primero autoselecciona su facultad
  const elegirPrograma = (v: string) => setF(prev => ({
    ...prev,
    programaAcademicoId: v,
    facultadId: programas.find(p => p.id === v)?.facultadId ?? prev.facultadId,
  }));

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
      .catch(e => { setFranjas([]); setOcupados([]); avisarFallo(e); })
      .finally(() => setCargandoFranjas(false));
  }, [f.cursoId]);

  // Escape cierra el modal de revisión
  useEffect(() => {
    if (!revisando) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setRevisando(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revisando]);

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

  const datosListos = Boolean(f.docenteNombre.trim() && f.docenteCorreo.trim());
  const formularioListo = Boolean(f.cursoId) && horarioValido && datosListos;

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
        programaAcademicoId: f.programaAcademicoId || undefined,
        cursoId: f.cursoId,
        iniciaAt: iniciaAt.toISOString(),
        terminaAt: terminaAt.toISOString(),
        idempotencyKey: idemKey,
      });
      setConfirmacion(r.data);
      setRevisando(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setEnviando(false);
    }
  };

  // Panel de horarios del día elegido: en pantallas anchas va bajo el bloque
  // de cursos; en pantallas pequeñas queda dentro de la tarjeta del calendario.
  const horariosDia = !f.fecha ? (
    <p className="text-sm text-gray-500 dark:text-gray-400">Elige un día en el calendario para ver los horarios.</p>
  ) : (
    <>
      <div className="label-base mb-2 capitalize">
        {new Date(`${f.fecha}T12:00:00-05:00`).toLocaleDateString("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long" })}
      </div>

      {segmentosDelDia.length > 0 && (
        <div className="mb-3">
          <div className="relative h-8 w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-night-800">
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
                    s.ocupado ? "bg-gray-300 dark:bg-night-700 cursor-not-allowed" : "bg-primary/80 hover:bg-primary cursor-pointer"}`}
                />
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-xs text-gray-400 dark:text-gray-500">
            <span>{fmtHora(new Date(ejeMin))}</span>
            <span>{fmtHora(new Date(ejeMax))}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-primary/80" />Disponible</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-gray-300 dark:bg-night-700" />Ocupado</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-gray-200 dark:border-night-700 bg-gray-100 dark:bg-night-800" />Sin horario</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        {segmentosDelDia.map(s => s.ocupado ? (
          <span key={`o-${s.ini}`}
            className="rounded-full border border-gray-200 dark:border-night-700 bg-gray-100 dark:bg-night-800 px-3 py-1.5 text-sm text-gray-400 dark:text-gray-500">
            {fmtHora(new Date(s.ini))}–{fmtHora(new Date(s.fin))} · ocupado
          </span>
        ) : (
          <button key={`l-${s.ini}`} type="button" onClick={() => s.fr && elegirFranja(s.fr)}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              franjaSel?.inicio === s.fr?.inicio && franjaSel?.fin === s.fr?.fin
                ? "border-primary dark:border-primary-soft/50 bg-primary text-white"
                : "border-gray-300 dark:border-night-600 hover:border-primary"}`}>
            {fmtHora(new Date(s.ini))}–{fmtHora(new Date(s.fin))}
          </button>
        ))}
        {!segmentosDelDia.length && <p className="text-sm text-gray-500 dark:text-gray-400">Sin horarios disponibles este día.</p>}
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
  );

  if (confirmacion) {
    return (
      <PublicLayout>
        <div className="card mt-6 text-center py-8">
          <IconoExito />
          <h2 className="mt-4 text-xl font-bold text-primary dark:text-primary-soft">Reserva confirmada</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Tu código de reserva es</p>
          <p className="mt-1 inline-block rounded-xl bg-gray-50 dark:bg-night-800 px-4 py-2 text-2xl font-mono font-bold tracking-wider text-gray-900 dark:text-gray-100">{confirmacion.codigo}</p>
          <div className="mt-4"><OkMsg msg="Recibirás un correo con los detalles y el enlace de cancelación." /></div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout amplio>
      <p className="mb-4 text-sm font-medium text-white/90">
        Solicita una formación en tres pasos: elige el curso, escoge fecha y horario, y completa tus datos.
      </p>

      {errorCatalogo && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-white dark:bg-night-900 p-3 shadow">
          <div className="flex-1"><ErrorMsg msg={errorCatalogo} /></div>
          <button type="button" className="btn-secondary shrink-0 px-3 py-1.5 text-sm" onClick={cargarCatalogos}>
            Reintentar
          </button>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-3">
          <section className="card">
            <Encabezado n={1} titulo="Elige el curso" listo={Boolean(f.cursoId)} />
          {f.cursoId && !cursoExpandido ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 p-3 dark:border-primary-soft/40 dark:bg-primary/20">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{cursos.find(c => c.id === f.cursoId)?.nombre}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Curso seleccionado</div>
              </div>
              <button type="button" className="btn-secondary shrink-0 px-3 py-1.5 text-xs" onClick={() => setCursoExpandido(true)}>
                Cambiar
              </button>
            </div>
          ) : (
            <div className={`grid gap-2 sm:grid-cols-2 xl:grid-cols-1 xl:overflow-y-auto xl:pr-1 ${
              f.cursoId ? "xl:max-h-[calc(100vh-33rem)]" : "xl:max-h-[calc(100vh-15rem)]"}`}>
              {cursos.map(c => (
                <button key={c.id} type="button"
                  className={`text-left rounded-xl border p-3 transition ${f.cursoId === c.id ? "border-primary dark:border-primary-soft/50 bg-primary/10 dark:bg-primary/20 ring-1 ring-primary/40 dark:ring-primary-soft/30" : "border-gray-200 dark:border-night-700 hover:border-primary dark:hover:border-primary-soft/60"}`}
                  onClick={() => {
                    setF({ ...f, cursoId: c.id, fecha: "", horaInicio: "", horaFin: "" });
                    setFranjaSel(null);
                    setCursoExpandido(false);
                    setTimeout(() => fechaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
                  }}>
                  <div className="font-medium text-sm">{c.nombre}</div>
                  {c.descripcion && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{c.descripcion}</div>}
                </button>
              ))}
              {!cursos.length && !errorCatalogo && <p className="text-sm text-gray-500 dark:text-gray-400 sm:col-span-2 xl:col-span-1">No hay cursos disponibles por ahora.</p>}
            </div>
          )}
          </section>

          {f.cursoId && (
            <section className="card hidden xl:block">
              <div className="label-base mb-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Horarios del día</div>
              {cargandoFranjas ? <Spinner /> : horariosDia}
            </section>
          )}
        </div>

        <section ref={fechaRef} className="card xl:col-span-5 xl:self-start">
            <Encabezado n={2} titulo="Fecha y horario" listo={horarioValido} />
            {!f.cursoId ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Elige primero un curso para ver la disponibilidad de los formadores.</p>
            ) : cargandoFranjas ? <Spinner /> : (
              <div className="grid gap-3">
                <div className="rounded-xl border border-gray-200 dark:border-night-700 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <button type="button" className="btn-secondary px-3 py-1" disabled={mesVisible <= mesMin}
                      onClick={() => setMesVisible(new Date(mesVisible.getFullYear(), mesVisible.getMonth() - 1, 1))}>‹</button>
                    <div className="font-medium text-primary dark:text-primary-soft capitalize">
                      {mesVisible.toLocaleDateString("es-CO", { month: "long", year: "numeric" })}
                    </div>
                    <button type="button" className="btn-secondary px-3 py-1" disabled={mesVisible >= mesMax}
                      onClick={() => setMesVisible(new Date(mesVisible.getFullYear(), mesVisible.getMonth() + 1, 1))}>›</button>
                  </div>
                  <div className="grid grid-cols-7 text-center text-xs text-gray-500 dark:text-gray-400 mb-1">
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
                          className={`h-9 rounded-lg text-sm transition ${
                            activo ? "bg-primary text-white font-semibold"
                            : disp ? "bg-accent/40 dark:bg-primary/30 text-primary dark:text-primary-soft hover:bg-accent dark:hover:bg-primary/50 font-medium"
                            : "text-gray-300 dark:text-gray-500 cursor-not-allowed"}`}>
                          {d.getDate()}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">Los días marcados tienen horarios disponibles.</p>
                </div>

                <div className="xl:hidden">{horariosDia}</div>
              </div>
            )}
        </section>

        <div className="xl:col-span-4">
          <section className="card xl:sticky xl:top-4">
            <Encabezado n={3} titulo="Tus datos" listo={datosListos} />

            <div className="space-y-3">
              <div>
                <label className="label-base">Nombre completo *</label>
                <input className="input-base" value={f.docenteNombre} onChange={e => setF({ ...f, docenteNombre: e.target.value })} />
              </div>
              <div>
                <label className="label-base">Correo institucional *</label>
                <input type="email" className="input-base" value={f.docenteCorreo} onChange={e => setF({ ...f, docenteCorreo: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
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
                <label className="label-base" htmlFor="sol-facultad">Facultad</label>
                <ComboBox id="sol-facultad" value={f.facultadId} onChange={elegirFacultad}
                  opciones={facultades.map(x => ({ value: x.id, label: x.nombre }))}
                  placeholder="Escribe o elige tu facultad" />
              </div>
              <div>
                <label className="label-base" htmlFor="sol-programa">Programa académico</label>
                <ComboBox id="sol-programa" value={f.programaAcademicoId} onChange={elegirPrograma}
                  opciones={programasVisibles.map(x => ({ value: x.id, label: x.nombre }))}
                  placeholder={f.facultadId ? "Programas de tu facultad" : "Escribe o elige tu programa"} />
              </div>
            </div>

            <div className="mt-4">
              <button className="btn-primary w-full" disabled={!formularioListo} onClick={() => { setError(null); setRevisando(true); }}>
                Revisar y confirmar
              </button>
              {!formularioListo && (
                <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
                  Completa el curso, la fecha con su horario y tus datos para confirmar.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>

      {revisando && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" onClick={() => { if (!enviando) setRevisando(false); }}>
          <div
            role="dialog" aria-modal="true" aria-label="Revisar solicitud"
            className="w-full max-w-md rounded-2xl border border-gray-100 dark:border-night-800 bg-white dark:bg-night-900 shadow-2xl p-5"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-primary dark:text-primary-soft">Revisa tu solicitud</h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Confirma que todo esté bien antes de enviar la reserva.</p>

            <dl className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500 dark:text-gray-400">Curso</dt>
                <dd className="text-right font-medium">{cursos.find(c => c.id === f.cursoId)?.nombre}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500 dark:text-gray-400">Fecha</dt>
                <dd className="text-right font-medium capitalize">
                  {new Date(`${f.fecha}T12:00:00-05:00`).toLocaleDateString("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long" })}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500 dark:text-gray-400">Horario</dt>
                <dd className="text-right font-medium">{f.horaInicio}–{f.horaFin}</dd>
              </div>
              {f.aula && (
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500 dark:text-gray-400">Aula / lugar</dt>
                  <dd className="text-right font-medium">{f.aula}</dd>
                </div>
              )}
            </dl>

            <hr className="my-3 border-gray-100 dark:border-night-800" />

            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500 dark:text-gray-400">Nombre</dt>
                <dd className="text-right font-medium">{f.docenteNombre}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500 dark:text-gray-400">Correo</dt>
                <dd className="text-right font-medium break-all">{f.docenteCorreo}</dd>
              </div>
              {f.docenteTelefono && (
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500 dark:text-gray-400">Teléfono</dt>
                  <dd className="text-right font-medium">{f.docenteTelefono}</dd>
                </div>
              )}
              {f.facultadId && (
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500 dark:text-gray-400">Facultad</dt>
                  <dd className="text-right font-medium">{facultades.find(x => x.id === f.facultadId)?.nombre}</dd>
                </div>
              )}
              {f.programaAcademicoId && (
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500 dark:text-gray-400">Programa</dt>
                  <dd className="text-right font-medium">{programas.find(x => x.id === f.programaAcademicoId)?.nombre}</dd>
                </div>
              )}
            </dl>

            <div className="mt-4"><ErrorMsg msg={error} /></div>

            <div className="mt-4 flex gap-2">
              <button type="button" className="btn-secondary flex-1" disabled={enviando} onClick={() => setRevisando(false)}>
                Volver a editar
              </button>
              <button type="button" className="btn-primary flex-1" disabled={enviando} onClick={enviar}>
                {enviando ? "Confirmando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PublicLayout>
  );
}
