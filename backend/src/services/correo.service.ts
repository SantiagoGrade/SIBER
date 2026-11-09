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
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f5;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden">
<tr><td style="background:#0A6A50;color:#fff;padding:20px 28px;font-size:18px;font-weight:bold">
SIFOIN — Sistema de Formación Institucional</td></tr>
<tr><td style="padding:28px;color:#222;font-size:15px;line-height:1.5">
<h1 style="font-size:19px;margin:0 0 14px;color:#0A6A50">${titulo}</h1>
${cuerpo}
</td></tr>
<tr><td style="padding:16px 28px;background:#f4f6f5;color:#666;font-size:12px">
Biblioteca — Institución Universitaria Colegio Mayor de Antioquia.<br>
Este es un mensaje automático, por favor no responder.
</td></tr></table></td></tr></table></body></html>`;
}

export function enlace(texto: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;background:#0A6A50;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;margin:8px 0">${texto}</a>
<p style="font-size:12px;color:#666;word-break:break-all">Si el botón no funciona, copia este enlace: ${url}</p>`;
}

export async function enviarCorreo(opts: {
  para: string; asunto: string; html: string;
  adjuntos?: { filename: string; content: Buffer; contentType?: string; cid?: string }[];
}) {
  const t = obtenerTransporte();
  await t.sendMail({
    from: env.smtp.from,
    to: opts.para,
    subject: opts.asunto,
    html: opts.html,
    attachments: opts.adjuntos?.map(a => ({
      filename: a.filename, content: a.content, contentType: a.contentType, cid: a.cid,
    })),
  });
}
