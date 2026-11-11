/**
 * Datos de demostración: 30 reservas con todos los flujos del sistema.
 *
 *   - FINALIZADA: QR enviado/cerrado + asistencias (incl. docente) + evaluaciones
 *     por aspectos con perfiles de calidad variados + outbox ENVIADA.
 *   - EN_CURSO:   QR abierto/enviado + asistencias parciales ya registradas.
 *   - CONFIRMADA: QR programado pendiente + correos de confirmación enviados.
 *   - CANCELADA:  motivo + QR invalidado/omitido.
 *   - Reasignaciones: una PENDIENTE y una SIN_REEMPLAZO (incidenciaPendiente).
 *
 * Idempotente: todo lo creado usa idempotencyKey `demo:<n>` y dedupKey
 * `demo:*`; al re-ejecutar borra lo sembrado antes y lo vuelve a crear.
 *
 * Uso: cd backend && npx tsx prisma/seed-demo.ts
 */
import { PrismaClient, EstadoReserva } from "@prisma/client";
import { DateTime } from "luxon";
import { generarCodigoReserva, generarToken, hashToken, cifrarToken } from "../src/utils/tokens";
import { construirCorreo } from "../src/services/plantillasCorreo";

const prisma = new PrismaClient();
const ZONA = "America/Bogota";
const MARCA = "demo:";

// ── RNG determinista (mulberry32) ────────────────────────────────────────────
let semilla = 20261111;
function rng() {
  semilla |= 0; semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entero = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
const elige = <T>(arr: T[]) => arr[Math.floor(rng() * arr.length)];

// ── Datos sintéticos ─────────────────────────────────────────────────────────
const NOMBRES = [
  "María Fernanda", "Juan Camilo", "Luisa", "Andrés Felipe", "Catalina", "Santiago",
  "Valentina", "Daniel", "Paola", "Sebastián", "Alejandra", "Nicolás", "Juliana",
  "Felipe", "Carolina", "Esteban", "Manuela", "Ricardo", "Tatiana", "Óscar",
  "Diana Marcela", "Javier", "Lorena", "Camila", "Fernando", "Ángela", "Mauricio",
  "Sandra", "Hernán", "Claudia",
];
const APELLIDOS = [
  "García", "Rodríguez", "Martínez", "López", "González", "Hernández", "Pérez",
  "Sánchez", "Ramírez", "Torres", "Gómez", "Díaz", "Vargas", "Castro", "Ruiz",
  "Álvarez", "Romero", "Suárez", "Rojas", "Moreno", "Muñoz", "Valencia", "Ortiz",
  "Cárdenas", "Guerrero", "Prieto", "Cortés", "Parra", "Salazar", "Mejía",
];
const DOCENTES = [
  ["Ana María Cifuentes", "ana.cifuentes@colmayor.edu.co"],
  ["Pedro José Almanza", "pedro.almanza@colmayor.edu.co"],
  ["Liliana Rentería", "liliana.renteria@colmayor.edu.co"],
  ["Gustavo Adolfo Peña", "gustavo.pena@colmayor.edu.co"],
  ["Mónica Delgado", "monica.delgado@colmayor.edu.co"],
  ["Iván Darío Montoya", "ivan.montoya@colmayor.edu.co"],
  ["Soraya Bustos", "soraya.bustos@colmayor.edu.co"],
  ["Fabián Andrés Cubillos", "fabian.cubillos@colmayor.edu.co"],
  ["Rocío Jiménez", "rocio.jimenez@colmayor.edu.co"],
  ["Héctor Fabio Serna", "hector.serna@colmayor.edu.co"],
  ["Nubia Esperanza Leal", "nubia.leal@colmayor.edu.co"],
  ["Wilson Javier Cruz", "wilson.cruz@colmayor.edu.co"],
  ["Patricia Escallón", "patricia.escallon@colmayor.edu.co"],
  ["Ómar Leonardo Ruíz", "omar.ruiz@colmayor.edu.co"],
] as const;
const AULAS = ["Aula 101", "Aula 203", "Aula 305", "Laboratorio 2", "Auditorio Menor", "Sala de Cómputo 1", "Aula 410", "Biblioteca - Sala 3"];
const MOTIVOS_CANCELACION = [
  "El docente reportó una incapacidad médica para la fecha programada",
  "Conflicto de agenda con evento institucional en el aula asignada",
  "Solicitud del docente por reprogramación académica",
];
const OBS_POS = [
  "Excelente formación, muy clara y aplicable a mi labor docente.",
  "El formador dominó el tema y resolvió todas las dudas.",
  "Muy útil, llevo herramientas concretas para el aula.",
  "Buen ritmo y ejemplos prácticos durante toda la sesión.",
];
const OBS_NEU = [
  "El contenido fue pertinente aunque el tiempo quedó corto.",
  "Buena formación; sería ideal una segunda parte más práctica.",
  "Cumplió el objetivo, aunque faltó material de apoyo previo.",
];
const OBS_NEG = [
  "La sesión fue muy teórica, faltaron ejercicios prácticos.",
  "El contenido no se ajustó del todo a lo que esperaba el grupo.",
  "Se notó poca interacción; el tema podría explicarse mejor.",
];

function nombreCompleto() { return `${elige(NOMBRES)} ${elige(APELLIDOS)} ${elige(APELLIDOS)}`; }
function correoDe(nombre: string) {
  const limpio = nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, "").trim().split(/\s+/);
  return `${limpio[0]}.${limpio[limpio.length - 2] ?? limpio[1]}@${rng() < 0.7 ? "colmayor.edu.co" : "gmail.com"}`;
}

type Perfil = "excelente" | "buena" | "regular" | "baja";
function perfilAleatorio(): Perfil {
  const r = rng();
  return r < 0.55 ? "excelente" : r < 0.8 ? "buena" : r < 0.92 ? "regular" : "baja";
}
function nota(perfil: Perfil): number {
  const r = rng();
  switch (perfil) {
    case "excelente": return r < 0.7 ? 5 : 4;
    case "buena": return r < 0.35 ? 5 : r < 0.8 ? 4 : 3;
    case "regular": return r < 0.2 ? 4 : r < 0.75 ? 3 : 2;
    case "baja": return r < 0.2 ? 3 : r < 0.7 ? 2 : 1;
  }
}
function evaluacion(perfil: Perfil) {
  const aspectos = [nota(perfil), nota(perfil), nota(perfil), nota(perfil)];
  const media = aspectos.reduce((a, b) => a + b, 0) / 4;
  const general = Math.max(1, Math.min(5, Math.round(media + (rng() - 0.4))));
  const r = rng();
  const observaciones =
    r < 0.55 ? null :
    perfil === "baja" || (perfil === "regular" && r < 0.8) ? elige(OBS_NEG) :
    perfil === "regular" ? elige(OBS_NEU) :
    rng() < 0.75 ? elige(OBS_POS) : elige(OBS_NEU);
  return {
    contenidoObjetivo: aspectos[0], metodologiaAdecuada: aspectos[1],
    dominioTema: aspectos[2], coherenciaExposicion: aspectos[3],
    calificacionGeneral: general, observaciones,
  };
}

// ── Utilidades de tiempo/solape ──────────────────────────────────────────────
const ocupados = new Map<string, { ini: DateTime; fin: DateTime }[]>();
function libre(formadorId: string, ini: DateTime, fin: DateTime) {
  return !(ocupados.get(formadorId) ?? []).some(s => ini < s.fin && fin > s.ini);
}
function ocupar(formadorId: string, ini: DateTime, fin: DateTime) {
  const arr = ocupados.get(formadorId) ?? [];
  arr.push({ ini, fin });
  ocupados.set(formadorId, arr);
}
const bogota = (iso: string) => DateTime.fromISO(iso, { zone: ZONA });

async function configNum(clave: string, def: number) {
  const row = await prisma.configuracionSistema.findUnique({ where: { clave } });
  const v = row ? Number(row.valor) : def;
  return Number.isFinite(v) ? v : def;
}

async function limpiarDemo() {
  const viejas = await prisma.reserva.findMany({
    where: { idempotencyKey: { startsWith: MARCA } }, select: { id: true },
  });
  if (viejas.length === 0) return;
  await prisma.notificacion.deleteMany({ where: { dedupKey: { startsWith: MARCA } } });
  await prisma.reserva.deleteMany({ where: { id: { in: viejas.map(r => r.id) } } });
  console.log(`Limpiadas ${viejas.length} reservas demo anteriores.`);
}

async function main() {
  await limpiarDemo();

  const formadores = await prisma.formador.findMany({
    include: { cuenta: true, cursos: { include: { curso: true } } },
  });
  if (formadores.length === 0) throw new Error("No hay formadores; crea al menos uno primero.");
  const programas = await prisma.programaAcademico.findMany({
    where: { activo: true, facultadId: { not: null } }, include: { facultad: true },
  });
  if (programas.length === 0) throw new Error("No hay programas académicos activos.");

  const envioMin = await configNum("qr_envio_minutos", 30);
  const cierreMin = await configNum("asistencia_cierre_minutos", 60);

  // Precargar franjas ya ocupadas (la exclusion constraint cubre los 3 estados activos)
  const previas = await prisma.reserva.findMany({
    where: { estado: { in: ["CONFIRMADA", "EN_CURSO", "FINALIZADA"] } },
    select: { formadorId: true, iniciaAt: true, terminaAt: true },
  });
  for (const r of previas) ocupar(r.formadorId, bogota(r.iniciaAt.toISOString()!), bogota(r.terminaAt.toISOString()!));

  const ahora = DateTime.now().setZone(ZONA);
  let seq = 0;
  const resumen: Record<string, number> = { FINALIZADA: 0, EN_CURSO: 0, CONFIRMADA: 0, CANCELADA: 0 };
  let totalAsistencias = 0, totalEvaluaciones = 0;

  interface Plan {
    estado: EstadoReserva; ini: DateTime; fin: DateTime; formador: (typeof formadores)[number];
    reasignacion?: "PENDIENTE" | "SIN_REEMPLAZO"; qrIncidencia?: boolean;
  }
  const planes: Plan[] = [];

  // Franjas candidatas: bloques de 2h en jornada diurna
  const horas = [8, 10, 14, 16];
  function planificar(cantidad: number, estado: EstadoReserva, desde: DateTime, hasta: DateTime, extra?: Partial<Plan>) {
    let colocadas = 0, intentos = 0;
    while (colocadas < cantidad && intentos < 500) {
      intentos++;
      const dia = desde.plus({ days: Math.floor(rng() * (hasta.diff(desde, "days").days + 1)) });
      if (dia.weekday === 7) continue; // sin domingos
      const ini = dia.set({ hour: elige(horas), minute: elige([0, 0, 0, 30]), second: 0, millisecond: 0 });
      const fin = ini.plus({ hours: 2 });
      const candidatos = formadores.filter(f => libre(f.id, ini, fin));
      if (candidatos.length === 0) continue;
      const formador = elige(candidatos);
      ocupar(formador.id, ini, fin);
      planes.push({ estado, ini, fin, formador, ...extra });
      colocadas++;
    }
    if (colocadas < cantidad) throw new Error(`Solo se pudieron planificar ${colocadas}/${cantidad} reservas ${estado}`);
  }

  // 19 FINALIZADA en las últimas ~4 semanas
  planificar(19, "FINALIZADA", ahora.minus({ days: 28 }), ahora.minus({ days: 1 }));
  // 7 CONFIRMADA en las próximas ~3 semanas
  planificar(7, "CONFIRMADA", ahora.plus({ days: 1 }), ahora.plus({ days: 20 }));
  // 2 CANCELADA futuras (no aplican a la constraint, pero se ubican igual)
  planificar(2, "CANCELADA", ahora.plus({ days: 5 }), ahora.plus({ days: 25 }));

  // 2 EN_CURSO: en este momento, en formadores distintos
  const iniCurso = ahora.minus({ minutes: 45 }).startOf("minute");
  const finCurso = ahora.plus({ minutes: 75 }).startOf("minute");
  const libresAhora = formadores.filter(f => libre(f.id, iniCurso, finCurso));
  for (const f of libresAhora.slice(0, 2)) {
    ocupar(f.id, iniCurso, finCurso);
    planes.push({ estado: "EN_CURSO", ini: iniCurso, fin: finCurso, formador: f });
  }

  // Reasignaciones demo sobre dos CONFIRMADAS distintas
  const confirmadas = planes.filter(p => p.estado === "CONFIRMADA");
  if (confirmadas[0]) confirmadas[0].reasignacion = "PENDIENTE";
  if (confirmadas[1]) confirmadas[1].reasignacion = "SIN_REEMPLAZO";
  // Una FINALIZADA con incidencia de envío del QR
  const finalizadas = planes.filter(p => p.estado === "FINALIZADA");
  if (finalizadas[0]) finalizadas[0].qrIncidencia = true;

  for (const plan of planes) {
    seq++;
    const clave = `${MARCA}${seq}`;
    const [docenteNombre, docenteCorreo] = elige([...DOCENTES]);
    const programaReserva = elige(programas);
    const programaAsistentes = programas.filter(p => p.facultadId === programaReserva.facultadId);
    const curso = elige(plan.formador.cursos.map(fc => fc.curso).filter(c => c.activo));
    if (!curso) { console.warn(`Formador ${plan.formador.cuenta.correo} sin cursos activos; se omite una reserva.`); continue; }

    const creada = plan.ini.minus({ days: entero(2, 6), hours: entero(0, 8) });
    const envioQr = plan.ini.plus({ minutes: envioMin });
    const cierreQr = plan.fin.plus({ minutes: cierreMin });
    const cancelada = plan.estado === "CANCELADA";
    const canceladaAt = cancelada ? creada.plus({ days: entero(0, 2), hours: entero(1, 20) }) : null;

    const reserva = await prisma.reserva.create({
      data: {
        codigo: generarCodigoReserva(),
        idempotencyKey: clave,
        cursoId: curso.id,
        formadorId: plan.formador.id,
        docenteNombre,
        docenteCorreo,
        docenteTelefono: `3${entero(100000000, 199999999)}`,
        aula: elige(AULAS),
        facultadId: programaReserva.facultadId,
        programaAcademicoId: programaReserva.id,
        iniciaAt: plan.ini.toJSDate(),
        terminaAt: plan.fin.toJSDate(),
        estado: plan.estado,
        incidenciaPendiente: plan.reasignacion === "SIN_REEMPLAZO",
        motivoCancelacion: cancelada ? elige(MOTIVOS_CANCELACION) : null,
        canceladaAt: canceladaAt?.toJSDate() ?? null,
        finalizadaAt: plan.estado === "FINALIZADA" ? plan.fin.toJSDate() : null,
        createdAt: creada.toJSDate(),
      },
    });
    resumen[plan.estado]++;

    // ── Historial ──
    const eventos: { evento: string; detalle?: object; createdAt: DateTime }[] = [
      { evento: "CREADA", detalle: { formadorId: plan.formador.id, ocupacion: Math.round(rng() * 4000) / 100 }, createdAt: creada },
    ];
    if (plan.reasignacion) eventos.push({ evento: "REASIGNACION_SOLICITADA", detalle: { motivo: "Calamidad doméstica", observacion: "No puedo asistir ese día" }, createdAt: creada.plus({ hours: entero(5, 40) }) });
    if (plan.estado === "EN_CURSO" || plan.estado === "FINALIZADA") eventos.push({ evento: "EN_CURSO", createdAt: plan.ini });
    if (plan.estado === "FINALIZADA") eventos.push({ evento: "FINALIZADA", createdAt: plan.fin });
    if (cancelada) eventos.push({ evento: "CANCELADA", detalle: { motivo: "cancelada" }, createdAt: canceladaAt! });
    await prisma.historialReserva.createMany({
      data: eventos.map(e => ({ reservaId: reserva.id, evento: e.evento, detalle: e.detalle, createdAt: e.createdAt.toJSDate() })),
    });

    // ── Token de cancelación + outbox ──
    await prisma.tokenSeguro.create({
      data: { tipo: "CANCELACION_RESERVA", hash: hashToken(generarToken()), reservaId: reserva.id, expiraAt: plan.ini.toJSDate() },
    });
    const datosCorreo = {
      curso: curso.nombre, fecha: plan.ini.toFormat("dd/MM/yyyy"),
      horaInicio: plan.ini.toFormat("HH:mm"), horaFin: plan.fin.toFormat("HH:mm"),
      formador: plan.formador.cuenta.nombreCompleto, codigoReserva: reserva.codigo,
      aula: reserva.aula ?? undefined, docenteTelefono: reserva.docenteTelefono ?? undefined,
    };
    const enviadaEn = creada.plus({ seconds: entero(3, 40) });
    const correosBase = [
      { tipo: "CONFIRMACION_RESERVA" as const, destinatario: docenteCorreo, datos: { ...datosCorreo, nombreDestinatario: docenteNombre, enlaceAccion: "https://demo.invalid/cancelar" }, dedupKey: `${MARCA}confirmacion:${seq}` },
      { tipo: "NUEVA_FORMACION_ASIGNADA" as const, destinatario: plan.formador.cuenta.correo, datos: { ...datosCorreo, nombreDestinatario: plan.formador.cuenta.nombreCompleto }, dedupKey: `${MARCA}asignacion:${seq}` },
    ];
    for (const c of correosBase) {
      const { asunto, html } = construirCorreo(c.tipo, c.datos);
      await prisma.notificacion.create({
        data: { tipo: c.tipo, destinatario: c.destinatario, asunto, payload: { html, datos: c.datos }, dedupKey: c.dedupKey, estado: "ENVIADA", programadaPara: creada.toJSDate(), enviadaAt: enviadaEn.toJSDate(), createdAt: creada.toJSDate() },
      });
    }
    if (plan.estado === "FINALIZADA") {
      const diaAntes = plan.ini.minus({ days: 1 }).set({ hour: 12, minute: 0 });
      for (const c of [
        { tipo: "RECORDATORIO_DOCENTE" as const, destinatario: docenteCorreo, datos: { ...datosCorreo, nombreDestinatario: docenteNombre } },
        { tipo: "RECORDATORIO_FORMADOR" as const, destinatario: plan.formador.cuenta.correo, datos: { ...datosCorreo, nombreDestinatario: plan.formador.cuenta.nombreCompleto } },
      ]) {
        const { asunto, html } = construirCorreo(c.tipo, c.datos);
        await prisma.notificacion.create({
          data: { tipo: c.tipo, destinatario: c.destinatario, asunto, payload: { html, datos: c.datos }, dedupKey: `${MARCA}${c.tipo.toLowerCase()}:${seq}`, estado: "ENVIADA", programadaPara: diaAntes.toJSDate(), enviadaAt: diaAntes.plus({ seconds: entero(5, 60) }).toJSDate(), createdAt: diaAntes.toJSDate() },
        });
      }
    }

    // ── QR ──
    const token = generarToken();
    const qrBase = { reservaId: reserva.id, tokenHash: hashToken(token), tokenCifrado: cifrarToken(token), fechaHabilitacion: envioQr.toJSDate(), fechaCierre: cierreQr.toJSDate(), fechaEnvioProgramado: envioQr.toJSDate() };
    if (cancelada) {
      await prisma.registroQrFormacion.create({ data: { ...qrBase, estado: "INVALIDADO", estadoEnvio: "OMITIDO", ultimoError: "Reserva cancelada" } });
    } else if (plan.estado === "CONFIRMADA") {
      await prisma.registroQrFormacion.create({ data: { ...qrBase, estado: "PROGRAMADO", estadoEnvio: "PENDIENTE" } });
    } else if (plan.qrIncidencia) {
      await prisma.registroQrFormacion.create({ data: { ...qrBase, estado: "PROGRAMADO", estadoEnvio: "INCIDENCIA", intentosEnvio: 4, ultimoError: "SMTP: timeout de conexión con el servidor de correo" } });
    } else {
      await prisma.registroQrFormacion.create({
        data: {
          ...qrBase,
          estado: plan.estado === "FINALIZADA" ? "CERRADO" : "ABIERTO",
          estadoEnvio: "ENVIADO",
          fechaEnvioReal: envioQr.plus({ seconds: entero(2, 15) }).toJSDate(),
          destinatario: plan.formador.cuenta.correo,
          intentosEnvio: 1,
        },
      });
    }

    // ── Asistencias + evaluaciones ──
    const conAsistencia = plan.estado === "FINALIZADA" || plan.estado === "EN_CURSO";
    if (conAsistencia && !plan.qrIncidencia) {
      const perfil = perfilAleatorio();
      const hastaRegistro = plan.estado === "EN_CURSO" ? ahora : cierreQr;
      const nAsistentes = plan.estado === "EN_CURSO" ? entero(3, 6) : entero(5, 12);
      const docenteAsiste = plan.estado === "FINALIZADA" ? rng() < 0.75 : rng() < 0.5;
      const usados = new Set<string>();

      const asistentes = Array.from({ length: nAsistentes }, () => {
        const nombre = nombreCompleto();
        return { nombre, correo: correoDe(nombre), esDocente: false };
      });
      if (docenteAsiste) asistentes[0] = { nombre: docenteNombre, correo: docenteCorreo, esDocente: true };

      for (const a of asistentes) {
        let documento = String(entero(1020000000, 1129999999));
        while (usados.has(documento)) documento = String(entero(1020000000, 1129999999));
        usados.add(documento);
        const registro = envioQr.plus({ minutes: entero(0, Math.max(1, Math.floor(hastaRegistro.diff(envioQr, "minutes").minutes))) });
        const asistencia = await prisma.asistencia.create({
          data: {
            reservaId: reserva.id, nombreCompleto: a.nombre, documento,
            correo: a.correo.toLowerCase(), programaAcademicoId: elige(programaAsistentes).id,
            aceptaTratamiento: true, esDocente: a.esDocente, fechaRegistro: registro.toJSDate(),
          },
        });
        totalAsistencias++;
        await prisma.evaluacionFormacion.create({
          data: { reservaId: reserva.id, asistenciaId: asistencia.id, ...evaluacion(perfil), fechaRegistro: registro.plus({ seconds: entero(5, 90) }).toJSDate() },
        });
        totalEvaluaciones++;
      }
    }

    // ── Reasignaciones ──
    if (plan.reasignacion) {
      await prisma.solicitudReasignacion.create({
        data: {
          reservaId: reserva.id,
          formadorSolicitanteId: plan.formador.id,
          motivo: "Calamidad doméstica",
          observacion: "No puedo asistir ese día",
          estado: plan.reasignacion,
          createdAt: creada.plus({ hours: entero(5, 40) }).toJSDate(),
          resueltaAt: plan.reasignacion === "SIN_REEMPLAZO" ? ahora.minus({ hours: entero(2, 20) }).toJSDate() : null,
        },
      });
    }
  }

  // Algunos intentos de QR inválidos para enriquecer el monitoreo
  const algunaReserva = await prisma.reserva.findFirst({ where: { idempotencyKey: { startsWith: MARCA }, estado: "FINALIZADA" } });
  if (algunaReserva) {
    await prisma.registroIntentoQr.createMany({
      data: [
        { reservaId: algunaReserva.id, motivo: "El registro de asistencia está cerrado", ip: "190.84.32.10" },
        { reservaId: null, motivo: "TOKEN_DESCONOCIDO", ip: "181.53.12.77" },
        { reservaId: algunaReserva.id, motivo: "El registro de asistencia está cerrado", ip: "186.31.90.4" },
      ],
    });
  }

  console.log("Demo lista:");
  console.log(`  Reservas creadas: ${seq} →`, resumen);
  console.log(`  Asistencias: ${totalAsistencias} · Evaluaciones: ${totalEvaluaciones}`);
}

main().finally(() => prisma.$disconnect());
