import ExcelJS from "exceljs";
import { prisma } from "../repositories/prisma";
import { aBogota } from "../utils/tiempo";
import { FiltroEstadisticas, estadisticasAdmin } from "./estadisticas.service";

async function workbookReservas(f: FiltroEstadisticas): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Reservas");
  ws.columns = [
    { header: "Código", key: "codigo", width: 14 },
    { header: "Curso", key: "curso", width: 30 },
    { header: "Formador", key: "formador", width: 28 },
    { header: "Docente", key: "docente", width: 28 },
    { header: "Correo docente", key: "correo", width: 30 },
    { header: "Teléfono docente", key: "telefono", width: 18 },
    { header: "Aula", key: "aula", width: 20 },
    { header: "Facultad", key: "facultad", width: 24 },
    { header: "Fecha", key: "fecha", width: 14 },
    { header: "Inicio", key: "inicio", width: 10 },
    { header: "Fin", key: "fin", width: 10 },
    { header: "Estado", key: "estado", width: 14 },
    { header: "Asistentes", key: "asistentes", width: 12 },
  ];
  const reservas = await prisma.reserva.findMany({
    where: {
      ...(f.cursoId ? { cursoId: f.cursoId } : {}),
      ...(f.formadorId ? { formadorId: f.formadorId } : {}),
      ...(f.estado ? { estado: f.estado } : {}),
      ...(f.desde || f.hasta ? { iniciaAt: { ...(f.desde ? { gte: f.desde } : {}), ...(f.hasta ? { lt: f.hasta } : {}) } } : {}),
    },
    include: {
      curso: true, facultad: true,
      formador: { include: { cuenta: true } },
      _count: { select: { asistencias: true } },
    },
    orderBy: { iniciaAt: "desc" },
  });
  for (const r of reservas) {
    const ini = aBogota(r.iniciaAt);
    ws.addRow({
      codigo: r.codigo, curso: r.curso.nombre,
      formador: r.formador.cuenta.nombreCompleto,
      docente: r.docenteNombre, correo: r.docenteCorreo,
      telefono: r.docenteTelefono ?? "", aula: r.aula ?? "",
      facultad: r.facultad?.nombre ?? "",
      fecha: ini.toFormat("dd/MM/yyyy"), inicio: ini.toFormat("HH:mm"),
      fin: aBogota(r.terminaAt).toFormat("HH:mm"),
      estado: r.estado, asistentes: r._count.asistencias,
    });
  }
  return wb.xlsx.writeBuffer();
}

async function workbookEstadisticas(f: FiltroEstadisticas): Promise<ExcelJS.Buffer> {
  const stats = await estadisticasAdmin(f);
  const wb = new ExcelJS.Workbook();

  const res = wb.addWorksheet("Resumen");
  res.columns = [{ width: 42 }, { width: 20 }];
  const filas: [string, string | number | null][] = [
    ["Formaciones solicitadas", stats.reservas.solicitadas],
    ["Confirmadas", stats.reservas.confirmadas],
    ["Finalizadas", stats.reservas.finalizadas],
    ["Canceladas", stats.reservas.canceladas],
    ["Próximas", stats.reservas.proximas],
    ["Total asistentes", stats.totalAsistentes],
    ["Horas impartidas", stats.horasImpartidas],
    ["Calificación promedio institucional", stats.satisfaccion.calificacionGeneral.promedio],
    ["Evaluaciones recibidas", stats.satisfaccion.totalEvaluaciones],
    ["Tasa de respuesta (%)", stats.satisfaccion.tasaRespuesta],
  ];
  for (const [k, v] of filas) res.addRow([k, v ?? "—"]);

  const cursos = wb.addWorksheet("Por curso");
  cursos.columns = [{ header: "Curso", width: 34 }, { header: "Promedio", width: 12 }, { header: "Respuestas", width: 12 }, { header: "Reservas", width: 12 }];
  for (const c of stats.satisfaccion.porCurso) {
    const demanda = stats.cursosMasSolicitados.find(d => d.cursoId === c.cursoId);
    cursos.addRow([c.nombre, c.promedio ?? "—", c.respuestas, demanda?.reservas ?? 0]);
  }

  const forms = wb.addWorksheet("Por formador");
  forms.columns = [{ header: "Formador", width: 34 }, { header: "Promedio", width: 12 }, { header: "Respuestas", width: 12 }, { header: "Horas", width: 12 }];
  for (const fm of stats.satisfaccion.porFormador) {
    const carga = stats.cargaPorFormador.find(c => c.formadorId === fm.formadorId);
    forms.addRow([fm.nombre, fm.promedio ?? "—", fm.respuestas, carga?.horas ?? 0]);
  }

  const com = wb.addWorksheet("Observaciones");
  com.columns = [
    { header: "Curso", width: 30 }, { header: "Formador", width: 28 },
    { header: "Calificación", width: 12 }, { header: "Observaciones", width: 60 },
  ];
  for (const c of stats.satisfaccion.comentarios) {
    com.addRow([c.curso, c.formador, c.calificacion, c.observaciones ?? ""]);
  }
  return wb.xlsx.writeBuffer();
}

async function workbookAsistencia(reservaId: string): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Asistencia");
  ws.columns = [
    { header: "Nombre", width: 32 }, { header: "Documento", width: 18 },
    { header: "Correo", width: 32 }, { header: "Programa", width: 30 },
    { header: "Fecha registro", width: 20 }, { header: "Calificación", width: 12 },
  ];
  const asistencias = await prisma.asistencia.findMany({
    where: { reservaId },
    include: { programa: true, evaluacion: true },
    orderBy: { fechaRegistro: "asc" },
  });
  for (const a of asistencias) {
    ws.addRow([
      a.nombreCompleto, a.documento, a.correo, a.programa.nombre,
      aBogota(a.fechaRegistro).toFormat("dd/MM/yyyy HH:mm"),
      a.evaluacion?.calificacionGeneral ?? "",
    ]);
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
