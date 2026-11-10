import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config/env";

let transporter: Transporter | null = null;

export function correoHabilitado(): boolean {
  return Boolean(env.smtp.host);
}

export function obtenerTransporte(): Transporter {
  if (!transporter) {
    if (!correoHabilitado()) {
      throw new Error("SMTP no configurado (SMTP_HOST vacío)");
    }
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
}

export function reiniciarTransporte() { transporter = null; }

export function plantillaBase(titulo: string, cuerpo: string): string {
  const anio = new Date().getFullYear();
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#e9edeb;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9edeb;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #dde3e0">
<tr><td style="background:#0A6A50;padding:18px 28px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="padding-right:14px;vertical-align:middle">
      <img src="${env.escudoUrl}" alt="Escudo Colegio Mayor de Antioquia" width="52" style="display:block;border:0"/>
    </td>
    <td style="vertical-align:middle">
      <div style="color:#ffffff;font-size:20px;font-weight:bold;line-height:1.25">${titulo}</div>
      <div style="color:#cfeee0;font-size:12.5px;margin-top:3px">Institución Universitaria Colegio Mayor de Antioquia</div>
    </td>
  </tr></table>
</td></tr>
<tr><td style="padding:28px;color:#2b2b2b;font-size:15px;line-height:1.55">
${cuerpo}
</td></tr>
<tr><td align="center" style="background:#0A6A50;color:#e7f5ee;padding:16px 28px;font-size:12px;line-height:1.7">
Este correo fue enviado automáticamente. Por favor, no responda a este mensaje.<br>
&copy; ${anio} Institución Universitaria Colegio Mayor de Antioquia
</td></tr></table></td></tr></table></body></html>`;
}

export function enlace(texto: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;background:#0A6A50;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;margin:8px 0">${texto}</a>
<p style="font-size:12px;color:#666;word-break:break-all">Si el botón no funciona, copia este enlace: ${url}</p>`;
}

export async function enviarCorreo(opts: {
  para: string; asunto: string; html: string;
  adjuntos?: { filename: string; content: Buffer; contentType?: string; cid?: string }[];
}) {
  const t = obtenerTransporte();
  const adjuntos = (opts.adjuntos ?? []).map(a => ({
    // Sin filename en recursos CID: evita que los clientes los muestren
    // como archivos adjuntos (van inline en multipart/related).
    filename: a.cid ? undefined : a.filename,
    content: a.content,
    contentType: a.contentType,
    cid: a.cid,
    contentDisposition: (a.cid ? "inline" : "attachment") as "inline" | "attachment",
  }));
  await t.sendMail({
    from: env.smtp.from,
    to: opts.para,
    subject: opts.asunto,
    html: opts.html,
    attachments: adjuntos.length ? adjuntos : undefined,
  });
}
