export interface Cuenta {
  id: string; usuario: string; correo: string;
  rol: "SUPER_ADMIN" | "ADMIN" | "FORMADOR";
  nombreCompleto: string; formadorId: string | null;
  cursos?: { id: string; nombre: string }[];
}

export interface Curso { id: string; nombre: string; descripcion?: string | null; activo: boolean }
export interface CatalogoItem { id: string; nombre: string; activo?: boolean }
export interface Franja { inicio: string; fin: string }
export interface DisponibilidadPublica { libres: Franja[]; ocupados: Franja[]; anticipacionMinimaDias?: number }

export interface Reserva {
  id: string; codigo: string; curso: string; cursoId?: string;
  formador: string; formadorId?: string; formadorCorreo?: string;
  docenteNombre: string; docenteCorreo: string;
  docenteTelefono?: string | null; aula?: string | null;
  facultad: string | null;
  iniciaAt: string; terminaAt: string;
  estado: "CONFIRMADA" | "FINALIZADA" | "CANCELADA";
  incidenciaPendiente: boolean; asistentes: number;
}

export interface EstadoQr {
  estado: "PROGRAMADO" | "ABIERTO" | "CERRADO" | "INVALIDADO";
  estadoEnvio: "PENDIENTE" | "ENVIADO" | "OMITIDO" | "INCIDENCIA";
  fechaEnvioProgramado: string; fechaEnvioReal: string | null;
  fechaHabilitacion: string; fechaCierre: string;
  destinatario: string | null; ultimoError: string | null;
  asistencias: number; evaluaciones: number;
}

export interface Reasignacion {
  id: string; estado: string; motivo: string; observacion?: string | null;
  createdAt: string;
  reserva: { id: string; codigo: string; curso: string; iniciaAt: string; terminaAt: string; estado?: string; docenteNombre?: string };
  solicitante?: string; reemplazoSugerido?: string | null;
  propuestas?: { id: string; iniciaAt: string; terminaAt: string; estado: string }[];
}

export interface Promedio { promedio: number | null; respuestas: number }

export interface StatsAdmin {
  reservas: { solicitadas: number; confirmadas: number; finalizadas: number; canceladas: number; proximas: number };
  reasignacionesPendientes: number;
  totalAsistentes: number;
  horasImpartidas: number;
  cargaPorFormador: { formadorId: string; nombre: string; minutos: number; reservas: number; horas: number }[];
  cursosMasSolicitados: { cursoId: string; nombre: string; reservas: number }[];
  satisfaccion: {
    calificacionGeneral: Promedio;
    totalEvaluaciones: number;
    tasaRespuesta: number | null;
    porCurso: { cursoId: string; nombre: string; promedio: number | null; respuestas: number }[];
    porFormador: { formadorId: string; nombre: string; promedio: number | null; respuestas: number }[];
    evolucion: { mes: string; promedio: number | null; respuestas: number }[];
    distribucion: { estrellas: number; cantidad: number }[];
    comentarios: { curso: string; formador: string; fecha: string; observaciones: string | null; calificacion: number }[];
    finalizadasSinEvaluacion: number;
  };
}

export interface StatsFormador extends StatsAdmin {
  proximas: { id: string; codigo: string; curso: string; iniciaAt: string; terminaAt: string; docenteNombre: string; estado: string; incidenciaPendiente: boolean }[];
  horasEstaSemana: number;
  horasDisponiblesSemana: number;
  ocupacionSemana: number | null;
  reasignacionesPendientesPropias: number;
  formacionesImpartidas: number;
  evolucionCalificaciones: { mes: string; promedio: number | null; respuestas: number }[];
  comparacionCursos: { curso: string; promedio: number | null; respuestas: number }[];
  asistenciaPorFormacion: { reservaId: string; asistentes: number }[];
}
