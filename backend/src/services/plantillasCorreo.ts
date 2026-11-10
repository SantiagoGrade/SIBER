import { plantillaBase, enlace } from "./correo.service";

export type TipoNotificacion =
  | "CONFIRMACION_RESERVA"
  | "NUEVA_FORMACION_ASIGNADA"
  | "CANCELACION_RESERVA"
  | "SOLICITUD_REASIGNACION_ADMIN"
  | "REASIGNACION_APROBADA"
  | "REASIGNACION_RECHAZADA"
  | "CAMBIO_FORMADOR"
  | "PROPUESTA_NUEVA_FECHA"
  | "ACEPTACION_NUEVA_FECHA"
  | "RECHAZO_PROPUESTA"
  | "CONFIRMACION_FECHA_MODIFICADA"
  | "RECUPERACION_PASSWORD"
  | "QR_ASISTENCIA"
  | "RECORDATORIO_DOCENTE"
  | "RECORDATORIO_FORMADOR";

export interface DatosCorreo {
  nombreDestinatario?: string;
  curso?: string;
  fecha?: string;
  horaInicio?: string;
  horaFin?: string;
  formador?: string;
  aula?: string;
  docenteNombre?: string;
  docenteCorreo?: string;
  docenteTelefono?: string;
  codigoReserva?: string;
  enlaceAccion?: string;
  motivo?: string;
  observacion?: string;
  qrPngBase64?: string;
  items?: DatosCorreo[];
  extra?: Record<string, string>;
}

function fila(etiqueta: string, valor?: string): string {
  return valor ? `<p style="margin:4px 0"><strong>${etiqueta}:</strong> ${valor}</p>` : "";
}

function datosReserva(d: DatosCorreo): string {
  return [
    fila("Curso", d.curso),
    fila("Fecha", d.fecha),
    fila("Hora de inicio", d.horaInicio),
    fila("Hora de finalización", d.horaFin),
    fila("Formador", d.formador),
    fila("Aula / lugar", d.aula),
    fila("Docente solicitante", d.docenteNombre),
    fila("Correo del docente", d.docenteCorreo),
    fila("Teléfono del docente", d.docenteTelefono),
    fila("Código de reserva", d.codigoReserva),
  ].join("");
}

/** Bloque independiente por reserva para correos que agrupan varias. */
function bloqueReserva(d: DatosCorreo): string {
  return `<div style="border:1px solid #dde3e0;border-left:4px solid #0A6A50;border-radius:8px;padding:10px 16px;margin:14px 0">${datosReserva(d)}</div>`;
}

export function construirCorreo(tipo: TipoNotificacion, d: DatosCorreo): {
  asunto: string; html: string;
  adjuntosMeta?: { filename: string; contentBase64: string; cid?: string }[];
} {
  const saludo = d.nombreDestinatario ? `<p>Hola, <strong>${d.nombreDestinatario}</strong>.</p>` : "<p>Hola.</p>";
  let titulo = "", cuerpo = "", asunto = "";
  let adjuntosMeta: { filename: string; contentBase64: string; cid?: string }[] | undefined;

  switch (tipo) {
    case "CONFIRMACION_RESERVA":
      asunto = `SIFOIN — Confirmación de reserva ${d.codigoReserva ?? ""}`;
      titulo = "Tu solicitud de formación fue confirmada";
      cuerpo = saludo + `<p>La reserva de tu formación quedó registrada:</p>` + datosReserva(d)
        + `<p>Si necesitas cancelarla, puedes hacerlo hasta 2 horas antes del inicio:</p>`
        + (d.enlaceAccion ? enlace("Cancelar mi reserva", d.enlaceAccion) : "");
      break;
    case "NUEVA_FORMACION_ASIGNADA":
      asunto = `SIFOIN — Nueva formación asignada: ${d.curso ?? ""}`;
      titulo = "Tienes una nueva formación asignada";
      cuerpo = saludo + `<p>Se te asignó una formación:</p>` + datosReserva(d);
      break;
    case "CANCELACION_RESERVA":
      asunto = `SIFOIN — Reserva cancelada ${d.codigoReserva ?? ""}`;
      titulo = "Una reserva fue cancelada";
      cuerpo = saludo + `<p>La siguiente reserva fue cancelada:</p>` + datosReserva(d)
        + fila("Motivo", d.motivo);
      break;
    case "SOLICITUD_REASIGNACION_ADMIN":
      asunto = `SIFOIN — Solicitud de reasignación pendiente`;
      titulo = "Hay una solicitud de reasignación por calamidad";
      cuerpo = saludo + `<p>El formador <strong>${d.formador ?? ""}</strong> solicitó reasignar:</p>`
        + datosReserva(d) + fila("Motivo", d.motivo) + fila("Observación", d.observacion);
      break;
    case "REASIGNACION_APROBADA":
      asunto = `SIFOIN — Reasignación aprobada`;
      titulo = "La reasignación fue aprobada";
      cuerpo = saludo + `<p>La reasignación de la siguiente formación fue aprobada:</p>` + datosReserva(d);
      break;
    case "REASIGNACION_RECHAZADA":
      asunto = `SIFOIN — Reasignación rechazada`;
      titulo = "La reasignación fue rechazada";
      cuerpo = saludo + datosReserva(d) + fila("Motivo", d.motivo);
      break;
    case "CAMBIO_FORMADOR":
      asunto = `SIFOIN — Cambio de formador ${d.codigoReserva ?? ""}`;
      titulo = "Cambio de formador en una formación";
      cuerpo = saludo + `<p>La formación ahora será impartida por otro formador:</p>` + datosReserva(d);
      break;
    case "PROPUESTA_NUEVA_FECHA":
      asunto = `SIFOIN — Propuesta de nueva fecha ${d.codigoReserva ?? ""}`;
      titulo = "Te proponemos una nueva fecha para tu formación";
      cuerpo = saludo + `<p>No fue posible mantener la fecha original. Te proponemos:</p>`
        + datosReserva(d) + `<p>Puedes aceptar o rechazar la propuesta:</p>`
        + (d.enlaceAccion ? enlace("Responder a la propuesta", d.enlaceAccion) : "");
      break;
    case "ACEPTACION_NUEVA_FECHA":
      asunto = `SIFOIN — Propuesta aceptada ${d.codigoReserva ?? ""}`;
      titulo = "El docente aceptó la nueva fecha";
      cuerpo = saludo + datosReserva(d);
      break;
    case "RECHAZO_PROPUESTA":
      asunto = `SIFOIN — Propuesta rechazada ${d.codigoReserva ?? ""}`;
      titulo = "El docente rechazó la propuesta de fecha";
      cuerpo = saludo + datosReserva(d);
      break;
    case "CONFIRMACION_FECHA_MODIFICADA":
      asunto = `SIFOIN — Fecha modificada ${d.codigoReserva ?? ""}`;
      titulo = "Tu formación tiene una nueva fecha confirmada";
      cuerpo = saludo + datosReserva(d);
      break;
    case "RECUPERACION_PASSWORD":
      asunto = `SIFOIN — Recuperación de contraseña`;
      titulo = "Recuperación de contraseña";
      cuerpo = saludo + `<p>Usa el siguiente enlace para restablecer tu contraseña. Caduca en 1 hora.</p>`
        + (d.enlaceAccion ? enlace("Restablecer contraseña", d.enlaceAccion) : "");
      break;
    case "QR_ASISTENCIA":
      asunto = `SIFOIN — Código QR de asistencia para tu formación`;
      titulo = "Código QR de asistencia de tu formación";
      cuerpo = saludo
        + `<p>Ya puedes compartir con los estudiantes el código QR de asistencia y evaluación de tu formación:</p>`
        + datosReserva(d)
        + (d.qrPngBase64
          ? `<p style="text-align:center"><img src="cid:qr-asistencia" alt="QR de asistencia" width="220" height="220"/></p>`
          : "")
        + `<p>Los estudiantes deben escanearlo para registrar su asistencia y evaluar el curso.
           El formulario también está disponible en este enlace:</p>`
        + (d.enlaceAccion ? enlace("Abrir formulario de asistencia", d.enlaceAccion) : "")
        + `<p style="font-size:13px;color:#555">El registro cierra automáticamente ${d.extra?.cierre ?? "a la hora configurada"}.</p>`;
      if (d.qrPngBase64) {
        adjuntosMeta = [{ filename: "qr-asistencia.png", contentBase64: d.qrPngBase64, cid: "qr-asistencia" }];
      }
      break;
    case "RECORDATORIO_DOCENTE": {
      const items = d.items ?? [];
      asunto = `SIFOIN — Recordatorio: tu formación de mañana`;
      titulo = "Recordatorio de formación";
      cuerpo = saludo
        + `<p>Te recordamos que mañana, <strong>${d.fecha ?? ""}</strong>, tienes programada${items.length > 1 ? "s" : ""} la${items.length > 1 ? "s" : ""} siguiente${items.length > 1 ? "s" : ""} formación${items.length > 1 ? "es" : ""}:</p>`
        + items.map(bloqueReserva).join("")
        + `<p>Si no puedes asistir, cancela la reserva desde el enlace de tu correo de confirmación.</p>`;
      break;
    }
    case "RECORDATORIO_FORMADOR": {
      const items = d.items ?? [];
      asunto = `SIFOIN — Recordatorio: formaciones de mañana`;
      titulo = "Recordatorio de formaciones";
      cuerpo = saludo
        + `<p>Te recordamos que mañana, <strong>${d.fecha ?? ""}</strong>, impartirás la${items.length > 1 ? "s" : ""} siguiente${items.length > 1 ? "s" : ""} formación${items.length > 1 ? "es" : ""}:</p>`
        + items.map(bloqueReserva).join("")
        + `<p>El código QR de asistencia llegará a tu correo durante la formación, como siempre.</p>`;
      break;
    }
  }
  return { asunto, html: plantillaBase(titulo, cuerpo), adjuntosMeta };
}
