-- CreateEnum
CREATE TYPE "RolCuenta" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'FORMADOR');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('CONFIRMADA', 'FINALIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "EstadoReasignacion" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'SIN_REEMPLAZO', 'PENDIENTE_RESPUESTA_DOCENTE', 'RESUELTA');

-- CreateEnum
CREATE TYPE "EstadoPropuesta" AS ENUM ('PENDIENTE', 'ACEPTADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "EstadoQr" AS ENUM ('PROGRAMADO', 'ABIERTO', 'CERRADO', 'INVALIDADO');

-- CreateEnum
CREATE TYPE "EstadoEnvio" AS ENUM ('PENDIENTE', 'ENVIADO', 'OMITIDO', 'INCIDENCIA');

-- CreateEnum
CREATE TYPE "EstadoNotificacion" AS ENUM ('PENDIENTE', 'ENVIADA', 'FALLIDA');

-- CreateEnum
CREATE TYPE "TipoExcepcion" AS ENUM ('VACACIONES', 'INCAPACIDAD', 'CALAMIDAD', 'PERMISO', 'BLOQUEO_ADMINISTRATIVO', 'FECHA_ESPECIAL');

-- CreateEnum
CREATE TYPE "TipoToken" AS ENUM ('CANCELACION_RESERVA', 'PROPUESTA_FECHA', 'RECUPERACION_PASSWORD');

-- CreateTable
CREATE TABLE "Cuenta" (
    "id" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "RolCuenta" NOT NULL,
    "nombreCompleto" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cuenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Formador" (
    "id" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Formador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Curso" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Curso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormadorCurso" (
    "formadorId" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,

    CONSTRAINT "FormadorCurso_pkey" PRIMARY KEY ("formadorId","cursoId")
);

-- CreateTable
CREATE TABLE "DisponibilidadSemanal" (
    "id" TEXT NOT NULL,
    "formadorId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaInicio" INTEGER NOT NULL,
    "horaFin" INTEGER NOT NULL,

    CONSTRAINT "DisponibilidadSemanal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExcepcionDisponibilidad" (
    "id" TEXT NOT NULL,
    "formadorId" TEXT NOT NULL,
    "tipo" "TipoExcepcion" NOT NULL,
    "iniciaAt" TIMESTAMP(3) NOT NULL,
    "terminaAt" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExcepcionDisponibilidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Facultad" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Facultad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramaAcademico" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProgramaAcademico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reserva" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "formadorId" TEXT NOT NULL,
    "docenteNombre" TEXT NOT NULL,
    "docenteCorreo" TEXT NOT NULL,
    "facultadId" TEXT,
    "iniciaAt" TIMESTAMP(3) NOT NULL,
    "terminaAt" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'CONFIRMADA',
    "incidenciaPendiente" BOOLEAN NOT NULL DEFAULT false,
    "motivoCancelacion" TEXT,
    "canceladaAt" TIMESTAMP(3),
    "finalizadaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistorialReserva" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "detalle" JSONB,
    "actorCuentaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialReserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitudReasignacion" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "formadorSolicitanteId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "observacion" TEXT,
    "estado" "EstadoReasignacion" NOT NULL DEFAULT 'PENDIENTE',
    "reemplazoSugeridoId" TEXT,
    "gestionadaPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltaAt" TIMESTAMP(3),

    CONSTRAINT "SolicitudReasignacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropuestaFecha" (
    "id" TEXT NOT NULL,
    "solicitudId" TEXT NOT NULL,
    "iniciaAt" TIMESTAMP(3) NOT NULL,
    "terminaAt" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoPropuesta" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondidaAt" TIMESTAMP(3),

    CONSTRAINT "PropuestaFecha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenSeguro" (
    "id" TEXT NOT NULL,
    "tipo" "TipoToken" NOT NULL,
    "hash" TEXT NOT NULL,
    "reservaId" TEXT,
    "propuestaId" TEXT,
    "cuentaId" TEXT,
    "expiraAt" TIMESTAMP(3) NOT NULL,
    "usadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenSeguro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asistencia" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "nombreCompleto" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "programaAcademicoId" TEXT NOT NULL,
    "aceptaTratamiento" BOOLEAN NOT NULL DEFAULT false,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asistencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluacionFormacion" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "asistenciaId" TEXT NOT NULL,
    "calificacionGeneral" INTEGER NOT NULL,
    "claridadFormador" INTEGER NOT NULL,
    "utilidadContenido" INTEGER NOT NULL,
    "recomendaria" BOOLEAN NOT NULL,
    "aspectosMejorar" TEXT,
    "aspectosPositivos" TEXT,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluacionFormacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroQrFormacion" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "fechaHabilitacion" TIMESTAMP(3) NOT NULL,
    "fechaCierre" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoQr" NOT NULL DEFAULT 'PROGRAMADO',
    "estadoEnvio" "EstadoEnvio" NOT NULL DEFAULT 'PENDIENTE',
    "fechaEnvioProgramado" TIMESTAMP(3) NOT NULL,
    "fechaEnvioReal" TIMESTAMP(3),
    "destinatario" TEXT,
    "intentosEnvio" INTEGER NOT NULL DEFAULT 0,
    "ultimoError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistroQrFormacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroIntentoQr" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT,
    "motivo" TEXT NOT NULL,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroIntentoQr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "destinatario" TEXT NOT NULL,
    "asunto" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupKey" TEXT,
    "estado" "EstadoNotificacion" NOT NULL DEFAULT 'PENDIENTE',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimoError" TEXT,
    "programadaPara" TIMESTAMP(3) NOT NULL,
    "enviadaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" TEXT NOT NULL,
    "actorCuentaId" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "detalle" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionSistema" (
    "clave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionSistema_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cuenta_usuario_key" ON "Cuenta"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "Cuenta_correo_key" ON "Cuenta"("correo");

-- CreateIndex
CREATE INDEX "Cuenta_rol_activo_idx" ON "Cuenta"("rol", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "Formador_cuentaId_key" ON "Formador"("cuentaId");

-- CreateIndex
CREATE UNIQUE INDEX "Curso_nombre_key" ON "Curso"("nombre");

-- CreateIndex
CREATE INDEX "DisponibilidadSemanal_formadorId_diaSemana_idx" ON "DisponibilidadSemanal"("formadorId", "diaSemana");

-- CreateIndex
CREATE INDEX "ExcepcionDisponibilidad_formadorId_iniciaAt_terminaAt_idx" ON "ExcepcionDisponibilidad"("formadorId", "iniciaAt", "terminaAt");

-- CreateIndex
CREATE UNIQUE INDEX "Facultad_nombre_key" ON "Facultad"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramaAcademico_nombre_key" ON "ProgramaAcademico"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Reserva_codigo_key" ON "Reserva"("codigo");

-- CreateIndex
CREATE INDEX "Reserva_formadorId_estado_iniciaAt_idx" ON "Reserva"("formadorId", "estado", "iniciaAt");

-- CreateIndex
CREATE INDEX "Reserva_estado_iniciaAt_idx" ON "Reserva"("estado", "iniciaAt");

-- CreateIndex
CREATE INDEX "Reserva_cursoId_estado_idx" ON "Reserva"("cursoId", "estado");

-- CreateIndex
CREATE INDEX "Reserva_docenteCorreo_idx" ON "Reserva"("docenteCorreo");

-- CreateIndex
CREATE INDEX "HistorialReserva_reservaId_createdAt_idx" ON "HistorialReserva"("reservaId", "createdAt");

-- CreateIndex
CREATE INDEX "SolicitudReasignacion_reservaId_estado_idx" ON "SolicitudReasignacion"("reservaId", "estado");

-- CreateIndex
CREATE INDEX "SolicitudReasignacion_estado_idx" ON "SolicitudReasignacion"("estado");

-- CreateIndex
CREATE INDEX "PropuestaFecha_solicitudId_estado_idx" ON "PropuestaFecha"("solicitudId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "TokenSeguro_hash_key" ON "TokenSeguro"("hash");

-- CreateIndex
CREATE INDEX "TokenSeguro_tipo_expiraAt_idx" ON "TokenSeguro"("tipo", "expiraAt");

-- CreateIndex
CREATE INDEX "Asistencia_reservaId_idx" ON "Asistencia"("reservaId");

-- CreateIndex
CREATE INDEX "Asistencia_fechaRegistro_idx" ON "Asistencia"("fechaRegistro");

-- CreateIndex
CREATE UNIQUE INDEX "Asistencia_reservaId_documento_key" ON "Asistencia"("reservaId", "documento");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluacionFormacion_asistenciaId_key" ON "EvaluacionFormacion"("asistenciaId");

-- CreateIndex
CREATE INDEX "EvaluacionFormacion_reservaId_idx" ON "EvaluacionFormacion"("reservaId");

-- CreateIndex
CREATE INDEX "EvaluacionFormacion_fechaRegistro_idx" ON "EvaluacionFormacion"("fechaRegistro");

-- CreateIndex
CREATE UNIQUE INDEX "RegistroQrFormacion_reservaId_key" ON "RegistroQrFormacion"("reservaId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistroQrFormacion_tokenHash_key" ON "RegistroQrFormacion"("tokenHash");

-- CreateIndex
CREATE INDEX "RegistroQrFormacion_estadoEnvio_fechaEnvioProgramado_idx" ON "RegistroQrFormacion"("estadoEnvio", "fechaEnvioProgramado");

-- CreateIndex
CREATE INDEX "RegistroQrFormacion_estado_idx" ON "RegistroQrFormacion"("estado");

-- CreateIndex
CREATE INDEX "RegistroIntentoQr_reservaId_createdAt_idx" ON "RegistroIntentoQr"("reservaId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notificacion_dedupKey_key" ON "Notificacion"("dedupKey");

-- CreateIndex
CREATE INDEX "Notificacion_estado_programadaPara_idx" ON "Notificacion"("estado", "programadaPara");

-- CreateIndex
CREATE INDEX "Auditoria_entidad_entidadId_idx" ON "Auditoria"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "Auditoria_createdAt_idx" ON "Auditoria"("createdAt");

-- AddForeignKey
ALTER TABLE "Formador" ADD CONSTRAINT "Formador_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormadorCurso" ADD CONSTRAINT "FormadorCurso_formadorId_fkey" FOREIGN KEY ("formadorId") REFERENCES "Formador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormadorCurso" ADD CONSTRAINT "FormadorCurso_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisponibilidadSemanal" ADD CONSTRAINT "DisponibilidadSemanal_formadorId_fkey" FOREIGN KEY ("formadorId") REFERENCES "Formador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcepcionDisponibilidad" ADD CONSTRAINT "ExcepcionDisponibilidad_formadorId_fkey" FOREIGN KEY ("formadorId") REFERENCES "Formador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_formadorId_fkey" FOREIGN KEY ("formadorId") REFERENCES "Formador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_facultadId_fkey" FOREIGN KEY ("facultadId") REFERENCES "Facultad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialReserva" ADD CONSTRAINT "HistorialReserva_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudReasignacion" ADD CONSTRAINT "SolicitudReasignacion_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudReasignacion" ADD CONSTRAINT "SolicitudReasignacion_formadorSolicitanteId_fkey" FOREIGN KEY ("formadorSolicitanteId") REFERENCES "Formador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudReasignacion" ADD CONSTRAINT "SolicitudReasignacion_reemplazoSugeridoId_fkey" FOREIGN KEY ("reemplazoSugeridoId") REFERENCES "Formador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropuestaFecha" ADD CONSTRAINT "PropuestaFecha_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudReasignacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenSeguro" ADD CONSTRAINT "TokenSeguro_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenSeguro" ADD CONSTRAINT "TokenSeguro_propuestaId_fkey" FOREIGN KEY ("propuestaId") REFERENCES "PropuestaFecha"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenSeguro" ADD CONSTRAINT "TokenSeguro_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_programaAcademicoId_fkey" FOREIGN KEY ("programaAcademicoId") REFERENCES "ProgramaAcademico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluacionFormacion" ADD CONSTRAINT "EvaluacionFormacion_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluacionFormacion" ADD CONSTRAINT "EvaluacionFormacion_asistenciaId_fkey" FOREIGN KEY ("asistenciaId") REFERENCES "Asistencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroQrFormacion" ADD CONSTRAINT "RegistroQrFormacion_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Auditoria" ADD CONSTRAINT "Auditoria_actorCuentaId_fkey" FOREIGN KEY ("actorCuentaId") REFERENCES "Cuenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
