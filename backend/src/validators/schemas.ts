import { z } from "zod";

const fecha = z.coerce.date();
const correo = z.string().email("Correo inválido").max(254, "Correo demasiado largo");
const nombre = z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres").max(120, "El nombre no puede superar 120 caracteres");
const id = z.string().min(1).max(40);
const usuario = z.string().trim()
  .min(3, "El usuario debe tener al menos 3 caracteres")
  .max(40, "El usuario no puede superar 40 caracteres")
  .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9._\- ]+$/, "El usuario solo admite letras, números, espacios, punto y guion");

export const loginSchema = z.object({
  usuario: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(200),
});

export const crearCuentaSchema = z.object({
  usuario,
  correo,
  password: z.string().min(10, "Mínimo 10 caracteres").max(200),
  nombreCompleto: nombre,
  rol: z.enum(["SUPER_ADMIN", "ADMIN", "FORMADOR"]),
  cursoIds: z.array(id).max(20).optional(),
});

export const actualizarCuentaSchema = z.object({
  usuario: usuario.optional(),
  correo: correo.optional(),
  password: z.string().min(10, "Mínimo 10 caracteres").max(200).optional(),
  nombreCompleto: nombre.optional(),
  rol: z.enum(["SUPER_ADMIN", "ADMIN", "FORMADOR"]).optional(),
  cursoIds: z.array(id).max(20).optional(),
});

export const cambiarPasswordSchema = z.object({
  actual: z.string().min(1),
  nueva: z.string().min(10).max(200),
});

export const recuperarSchema = z.object({ correo });
export const restablecerSchema = z.object({ token: z.string().min(10), nueva: z.string().min(10).max(200) });

export const crearCursoSchema = z.object({
  nombre: z.string().trim().min(3).max(120),
  descripcion: z.string().trim().max(1000).optional(),
});
export const actualizarCursoSchema = crearCursoSchema.partial().extend({
  activo: z.boolean().optional(),
});

export const habilitarFormadorSchema = z.object({ formadorId: id });

export const franjaSchema = z.object({
  diaSemana: z.number().int().min(1).max(7),
  horaInicio: z.number().int().min(0).max(1439),
  horaFin: z.number().int().min(1).max(1440),
});
export const disponibilidadSchema = z.object({ franjas: z.array(franjaSchema).max(21) });

export const excepcionSchema = z.object({
  tipo: z.enum(["VACACIONES", "INCAPACIDAD", "CALAMIDAD", "PERMISO", "BLOQUEO_ADMINISTRATIVO", "FECHA_ESPECIAL"]),
  iniciaAt: fecha,
  terminaAt: fecha,
  motivo: z.string().trim().max(500).optional(),
});

export const solicitudReservaSchema = z.object({
  docenteNombre: nombre,
  docenteCorreo: correo,
  docenteTelefono: z.string().trim().min(7).max(30).regex(/^[0-9+()\-\s]+$/, "Teléfono inválido").optional(),
  aula: z.string().trim().min(2).max(120).optional(),
  facultadId: id.optional(),
  cursoId: id,
  iniciaAt: fecha,
  terminaAt: fecha,
  idempotencyKey: z.string().max(80).optional(),
});

export const disponibilidadPublicaQuery = z.object({
  cursoId: id,
  desde: fecha,
  hasta: fecha,
});

export const cancelarReservaSchema = z.object({ token: z.string().min(10) });
export const cancelarAdminSchema = z.object({ motivo: z.string().trim().min(3).max(500) });

export const reasignacionSchema = z.object({
  reservaId: id,
  motivo: z.string().trim().min(5).max(300),
  observacion: z.string().trim().max(1000).optional(),
});
export const aprobarReasignacionSchema = z.object({ formadorId: id });
export const rechazarReasignacionSchema = z.object({ motivo: z.string().trim().min(3).max(500) });
export const propuestaFechaSchema = z.object({ iniciaAt: fecha, terminaAt: fecha });
export const responderPropuestaSchema = z.object({ token: z.string().min(10), aceptar: z.boolean() });

export const asistenciaSchema = z.object({
  nombreCompleto: nombre,
  documento: z.string().trim().min(4).max(30).regex(/^[A-Za-z0-9.-]+$/, "Documento inválido"),
  correo,
  programaAcademicoId: id,
  evaluacion: z.object({
    calificacionGeneral: z.number().int().min(1).max(5),
    observaciones: z.string().trim().max(1000).optional(),
  }),
});



export const filtroEstadisticasSchema = z.object({
  desde: fecha.optional(),
  hasta: fecha.optional(),
  cursoId: id.optional(),
  formadorId: id.optional(),
  facultadId: id.optional(),
  estado: z.enum(["CONFIRMADA", "EN_CURSO", "FINALIZADA", "CANCELADA"]).optional(),
  orden: z.enum(["asc", "desc"]).optional(),
  mes: z.coerce.number().int().min(1).max(12).optional(),
  semestre: z.coerce.number().int().min(1).max(2).optional(),
  anio: z.coerce.number().int().min(2020).max(2100).optional(),
});

export const configSchema = z.object({
  clave: z.string().trim().min(2).max(80),
  valor: z.unknown(),
});
