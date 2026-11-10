import ExcelJS from "exceljs";
import { prisma } from "../repositories/prisma";
import { aBogota } from "../utils/tiempo";
import { FiltroEstadisticas, estadisticasAdmin, whereReserva } from "./estadisticas.service";

// Paleta Colmayor (Estilos_Colmayor.md)
const PRIMARIO = "FF0A6A50";
const CEBRA = "FFF1F8F3";
const BORDE = "FFD5E5DB";
const GRIS = "FF6B7280";
const BLANCO = "FFFFFFFF";

const COLOR_ESTADO: Record<string, string> = {
  CONFIRMADA: "FF0A6A50",
  EN_CURSO: "FFB45309",
  FINALIZADA: "FF1D4ED8",
  CANCELADA: "FFDC2626",
};

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function bordeFino(): Partial<ExcelJS.Borders> {
  const lado: ExcelJS.Border = { style: "thin", color: { argb: BORDE } };
  return { top: lado, bottom: lado, left: lado, right: lado };
}

/** Escribe la franja de título (fila 1) y el subtítulo (fila 2). Devuelve la siguiente fila libre. */
function tituloYSubtitulo(ws: ExcelJS.Worksheet, titulo: string, subtitulo: string, nCols: number): number {
  for (let c = 1; c <= nCols; c++) {
    ws.getCell(1, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARIO } };
  }
  ws.mergeCells(1, 1, 1, nCols);
  const t = ws.getCell(1, 1);
  t.value = titulo;
  t.font = { bold: true, size: 14, color: { argb: BLANCO } };
  t.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(1).height = 28;

  ws.mergeCells(2, 1, 2, nCols);
  const s = ws.getCell(2, 1);
  s.value = subtitulo;
  s.font = { italic: true, size: 10, color: { argb: GRIS } };
  s.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(2).height = 16;

  return 4;
}

/** Pinta la fila de encabezados de la tabla, aplica autofiltro y congela hasta esa fila. */
function cabeceraTabla(ws: ExcelJS.Worksheet, fila: number, nCols: number): number {
  const row = ws.getRow(fila);
  row.height = 24;
  for (let c = 1; c <= nCols; c++) {
    const cell = row.getCell(c);
    cell.font = { bold: true, size: 11, color: { argb: BLANCO } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PRIMARIO } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = bordeFino();
  }
  ws.autoFilter = { from: { row: fila, column: 1 }, to: { row: fila, column: nCols } };
  ws.views = [{ state: "frozen", ySplit: fila }];
  return fila + 1;
}

function filaDatos(row: ExcelJS.Row, nCols: number, impar: boolean) {
  for (let c = 1; c <= nCols; c++) {
    const cell = row.getCell(c);
    cell.border = bordeFino();
    cell.alignment = { vertical: "top", wrapText: true };
    if (impar) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CEBRA } };
  }
}

function nuevoLibro(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SIBER · Colmayor";
  wb.created = new Date();
  return wb;
}

async function describirFiltros(f: FiltroEstadisticas): Promise<string> {
  const [curso, formador, facultad] = await Promise.all([
    f.cursoId ? prisma.curso.findUnique({ where: { id: f.cursoId }, select: { nombre: true } }) : null,
    f.formadorId ? prisma.formador.findUnique({ where: { id: f.formadorId }, select: { cuenta: { select: { nombreCompleto: true } } } }) : null,
    f.facultadId ? prisma.facultad.findUnique({ where: { id: f.facultadId }, select: { nombre: true } }) : null,
  ]);
  const partes: string[] = [];
  if (curso) partes.push(`Curso: ${curso.nombre}`);
  if (formador) partes.push(`Formador: ${formador.cuenta.nombreCompleto}`);
  if (facultad) partes.push(`Facultad: ${facultad.nombre}`);
  if (f.estado) partes.push(`Estado: ${f.estado}`);
  if (f.anio) {
    partes.push(`Periodo: ${f.mes ? `${MESES[f.mes - 1]} ` : ""}${f.semestre ? `semestre ${f.semestre} de ` : ""}${f.anio}`);
  } else if (f.desde || f.hasta) {
    const d = f.desde ? aBogota(f.desde).toFormat("dd/MM/yyyy") : "…";
    const h = f.hasta ? aBogota(f.hasta).toFormat("dd/MM/yyyy") : "…";
    partes.push(`Rango: ${d} – ${h}`);
  }
  return `Generado el ${aBogota(new Date()).toFormat("dd/MM/yyyy HH:mm")} · ${partes.length ? partes.join(" · ") : "Sin filtros"}`;
}

async function workbookReservas(f: FiltroEstadisticas): Promise<ExcelJS.Buffer> {
  const wb = nuevoLibro();
  const ws = wb.addWorksheet("Reservas");
  ws.columns = [
    { key: "codigo", width: 13 },
    { key: "estado", width: 13 },
    { key: "fecha", width: 12 },
    { key: "inicio", width: 8 },
    { key: "fin", width: 8 },
    { key: "curso", width: 32 },
    { key: "formador", width: 26 },
    { key: "docente", width: 26 },
    { key: "correo", width: 30 },
    { key: "telefono", width: 16 },
    { key: "aula", width: 16 },
    { key: "facultad", width: 24 },
    { key: "asistentes", width: 11 },
    { key: "evaluaciones", width: 11 },
    { key: "califProm", width: 11 },
    { key: "incidencia", width: 11 },
    { key: "creada", width: 17 },
    { key: "cancelada", width: 17 },
    { key: "motivo", width: 40 },
    { key: "finalizada", width: 17 },
  ];
  const nCols = ws.columns.length;
  let fila = tituloYSubtitulo(ws, "SIBER · Reservas de formaciones", await describirFiltros(f), nCols);
  ws.getRow(fila).values = [
    "Código", "Estado", "Fecha", "Inicio", "Fin", "Curso", "Formador", "Docente",
    "Correo docente", "Teléfono docente", "Aula", "Facultad", "Asistentes",
    "Evaluaciones", "Calif. prom.", "Incidencia", "Creada el", "Cancelada el",
    "Motivo cancelación", "Finalizada el",
  ];
  fila = cabeceraTabla(ws, fila, nCols);

  const reservas = await prisma.reserva.findMany({
    where: whereReserva(f),
    include: {
      curso: true, facultad: true,
      formador: { include: { cuenta: true } },
      evaluaciones: { select: { calificacionGeneral: true } },
      _count: { select: { asistencias: true } },
    },
    orderBy: { iniciaAt: "desc" },
  });
  let impar = false;
  for (const r of reservas) {
    const ini = aBogota(r.iniciaAt);
    const cals = r.evaluaciones.map(e => e.calificacionGeneral);
    const prom = cals.length ? Math.round((cals.reduce((a, b) => a + b, 0) / cals.length) * 100) / 100 : null;
    const row = ws.addRow({
      codigo: r.codigo, estado: r.estado,
      fecha: ini.toFormat("dd/MM/yyyy"), inicio: ini.toFormat("HH:mm"),
      fin: aBogota(r.terminaAt).toFormat("HH:mm"),
      curso: r.curso.nombre, formador: r.formador.cuenta.nombreCompleto,
      docente: r.docenteNombre, correo: r.docenteCorreo,
      telefono: r.docenteTelefono ?? "", aula: r.aula ?? "",
      facultad: r.facultad?.nombre ?? "",
      asistentes: r._count.asistencias, evaluaciones: r.evaluaciones.length,
      califProm: prom ?? "—",
      incidencia: r.incidenciaPendiente ? "Sí" : "",
      creada: aBogota(r.createdAt).toFormat("dd/MM/yyyy HH:mm"),
      cancelada: r.canceladaAt ? aBogota(r.canceladaAt).toFormat("dd/MM/yyyy HH:mm") : "",
      motivo: r.motivoCancelacion ?? "",
      finalizada: r.finalizadaAt ? aBogota(r.finalizadaAt).toFormat("dd/MM/yyyy HH:mm") : "",
    });
    filaDatos(row, nCols, impar);
    impar = !impar;
    const color = COLOR_ESTADO[r.estado];
    if (color) row.getCell("estado").font = { bold: true, color: { argb: color } };
    row.getCell("asistentes").alignment = { vertical: "top", horizontal: "center" };
    row.getCell("evaluaciones").alignment = { vertical: "top", horizontal: "center" };
    row.getCell("califProm").alignment = { vertical: "top", horizontal: "center" };
    row.getCell("incidencia").alignment = { vertical: "top", horizontal: "center" };
  }
  return wb.xlsx.writeBuffer();
}

function hojaTabla(
  wb: ExcelJS.Workbook, nombre: string, titulo: string, subtitulo: string,
  anchos: number[], encabezados: string[], filas: (string | number | null)[][],
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(nombre);
  ws.columns = anchos.map(width => ({ width }));
  const nCols = anchos.length;
  const filaCab = tituloYSubtitulo(ws, titulo, subtitulo, nCols);
  ws.getRow(filaCab).values = encabezados;
  cabeceraTabla(ws, filaCab, nCols);
  let impar = false;
  for (const datos of filas) {
    const row = ws.addRow(datos.map(v => v ?? "—"));
    filaDatos(row, nCols, impar);
    impar = !impar;
  }
  return ws;
}

async function workbookEstadisticas(f: FiltroEstadisticas): Promise<ExcelJS.Buffer> {
  const stats = await estadisticasAdmin(f);
  const subtitulo = await describirFiltros(f);
  const wb = nuevoLibro();

  // Resumen (etiqueta/valor, sin autofiltro)
  const res = wb.addWorksheet("Resumen");
  res.columns = [{ width: 44 }, { width: 22 }];
  tituloYSubtitulo(res, "SIBER · Estadísticas de formaciones", subtitulo, 2);
  const filas: [string, string | number | null][] = [
    ["Formaciones solicitadas", stats.reservas.solicitadas],
    ["Confirmadas", stats.reservas.confirmadas],
    ["En curso", stats.reservas.enCurso],
    ["Finalizadas", stats.reservas.finalizadas],
    ["Finalizadas sin evaluación", stats.satisfaccion.finalizadasSinEvaluacion],
    ["Canceladas", stats.reservas.canceladas],
    ["Próximas", stats.reservas.proximas],
    ["Reasignaciones pendientes", stats.reasignacionesPendientes],
    ["Total asistentes", stats.totalAsistentes],
    ["Horas impartidas", stats.horasImpartidas],
    ["Calificación promedio institucional", stats.satisfaccion.calificacionGeneral.promedio],
    ["Evaluaciones recibidas", stats.satisfaccion.totalEvaluaciones],
    ["Tasa de respuesta (%)", stats.satisfaccion.tasaRespuesta],
  ];
  let imparRes = false;
  for (const [k, v] of filas) {
    const row = res.addRow([k, v ?? "—"]);
    row.getCell(1).font = { bold: true, color: { argb: PRIMARIO } };
    row.getCell(2).alignment = { horizontal: "right", vertical: "top" };
    filaDatos(row, 2, imparRes);
    row.getCell(2).alignment = { horizontal: "right", vertical: "top" };
    imparRes = !imparRes;
  }

  hojaTabla(wb, "Por curso", "SIBER · Satisfacción por curso", subtitulo,
    [36, 12, 12, 12],
    ["Curso", "Promedio", "Respuestas", "Reservas"],
    stats.satisfaccion.porCurso.map(c => [
      c.nombre, c.promedio, c.respuestas,
      stats.cursosMasSolicitados.find(d => d.cursoId === c.cursoId)?.reservas ?? 0,
    ]),
  );

  hojaTabla(wb, "Por formador", "SIBER · Satisfacción y carga por formador", subtitulo,
    [36, 12, 12, 12, 12],
    ["Formador", "Promedio", "Respuestas", "Horas", "Reservas"],
    stats.satisfaccion.porFormador.map(fm => {
      const carga = stats.cargaPorFormador.find(c => c.formadorId === fm.formadorId);
      return [fm.nombre, fm.promedio, fm.respuestas, carga?.horas ?? 0, carga?.reservas ?? 0];
    }),
  );

  const evolPorMes = new Map(stats.satisfaccion.evolucion.map(e => [e.mes, e]));
  const meses = [...new Set([...stats.reservasPorMes.map(r => r.mes), ...stats.satisfaccion.evolucion.map(e => e.mes)])].sort();
  hojaTabla(wb, "Por mes", "SIBER · Reservas y satisfacción por mes", subtitulo,
    [14, 12, 14, 14],
    ["Mes", "Reservas", "Evaluaciones", "Calif. prom."],
    meses.map(m => {
      const ev = evolPorMes.get(m);
      return [m, stats.reservasPorMes.find(r => r.mes === m)?.total ?? 0, ev?.respuestas ?? 0, ev?.promedio ?? null];
    }),
  );

  const totalEval = stats.satisfaccion.totalEvaluaciones || 1;
  hojaTabla(wb, "Distribución", "SIBER · Distribución de calificaciones", subtitulo,
    [14, 12, 14],
    ["Estrellas", "Cantidad", "% del total"],
    stats.satisfaccion.distribucion.map(d => [
      `${"★".repeat(d.estrellas)} (${d.estrellas})`, d.cantidad,
      Math.round((d.cantidad / totalEval) * 1000) / 10,
    ]),
  );

  const com = hojaTabla(wb, "Observaciones", "SIBER · Observaciones de los asistentes", subtitulo,
    [12, 30, 26, 26, 16, 12, 70],
    ["Código", "Curso", "Formador", "Asistente", "Fecha", "Calificación", "Observaciones"],
    stats.satisfaccion.comentarios.map(c => [
      c.codigo, c.curso, c.formador, c.asistente,
      aBogota(c.fecha).toFormat("dd/MM/yyyy HH:mm"), c.calificacion, c.observaciones,
    ]),
  );
  com.getColumn(7).alignment = { wrapText: true, vertical: "top" };

  return wb.xlsx.writeBuffer();
}

async function workbookAsistencia(reservaId: string): Promise<ExcelJS.Buffer> {
  const reserva = await prisma.reserva.findUnique({
    where: { id: reservaId },
    include: { curso: true, facultad: true, formador: { include: { cuenta: true } } },
  });
  if (!reserva) throw new Error("Reserva no encontrada");

  const wb = nuevoLibro();
  const ws = wb.addWorksheet("Asistencia");
  ws.columns = [
    { key: "nombre", width: 30 }, { key: "documento", width: 16 },
    { key: "correo", width: 30 }, { key: "programa", width: 28 },
    { key: "tratamiento", width: 13 }, { key: "registro", width: 18 },
    { key: "calificacion", width: 12 }, { key: "fechaEval", width: 18 },
    { key: "observaciones", width: 55 },
  ];
  const nCols = ws.columns.length;
  const ini = aBogota(reserva.iniciaAt);
  tituloYSubtitulo(
    ws,
    `SIBER · Asistencia — ${reserva.curso.nombre}`,
    `Generado el ${aBogota(new Date()).toFormat("dd/MM/yyyy HH:mm")}`,
    nCols,
  );

  const info: [string, string][] = [
    ["Código", reserva.codigo],
    ["Formador", reserva.formador.cuenta.nombreCompleto],
    ["Docente", `${reserva.docenteNombre} (${reserva.docenteCorreo})`],
    ["Fecha y horario", `${ini.toFormat("dd/MM/yyyy")} · ${ini.toFormat("HH:mm")} – ${aBogota(reserva.terminaAt).toFormat("HH:mm")}`],
    ["Aula / Facultad", [reserva.aula, reserva.facultad?.nombre].filter(Boolean).join(" · ") || "—"],
    ["Estado", reserva.estado],
  ];
  info.forEach(([k, v], i) => {
    const row = ws.getRow(4 + i);
    row.getCell(1).value = k;
    row.getCell(1).font = { bold: true, color: { argb: PRIMARIO } };
    row.getCell(2).value = v;
    if (k === "Estado" && COLOR_ESTADO[v]) row.getCell(2).font = { bold: true, color: { argb: COLOR_ESTADO[v] } };
  });

  const filaCab = 4 + info.length + 1;
  ws.getRow(filaCab).values = [
    "Nombre", "Documento", "Correo", "Programa", "Tratamiento datos",
    "Fecha registro", "Calificación", "Fecha evaluación", "Observaciones",
  ];
  cabeceraTabla(ws, filaCab, nCols);

  const asistencias = await prisma.asistencia.findMany({
    where: { reservaId },
    include: { programa: true, evaluacion: true },
    orderBy: { fechaRegistro: "asc" },
  });
  let impar = false;
  for (const a of asistencias) {
    const row = ws.addRow({
      nombre: a.nombreCompleto, documento: a.documento, correo: a.correo,
      programa: a.programa.nombre, tratamiento: a.aceptaTratamiento ? "Sí" : "No",
      registro: aBogota(a.fechaRegistro).toFormat("dd/MM/yyyy HH:mm"),
      calificacion: a.evaluacion?.calificacionGeneral ?? "",
      fechaEval: a.evaluacion ? aBogota(a.evaluacion.fechaRegistro).toFormat("dd/MM/yyyy HH:mm") : "",
      observaciones: a.evaluacion?.observaciones ?? "",
    });
    filaDatos(row, nCols, impar);
    impar = !impar;
    row.getCell("tratamiento").alignment = { vertical: "top", horizontal: "center" };
    row.getCell("calificacion").alignment = { vertical: "top", horizontal: "center" };
  }
  return wb.xlsx.writeBuffer();
}

export async function exportar(
  tipo: "reservas" | "estadisticas" | "asistencia",
  f: FiltroEstadisticas, reservaId?: string
): Promise<ExcelJS.Buffer> {
  if (tipo === "reservas") return workbookReservas(f);
  if (tipo === "asistencia") {
    if (!reservaId) throw new Error("reservaId requerido");
    return workbookAsistencia(reservaId);
  }
  return workbookEstadisticas(f);
}
