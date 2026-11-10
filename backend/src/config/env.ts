import { config as dotenv } from "dotenv";
dotenv();

function req(name: string, def?: string): string {
  const v = process.env[name] ?? def;
  if (v === undefined) throw new Error(`Variable de entorno requerida: ${name}`);
  return v;
}

export const env = {
  databaseUrl: req("DATABASE_URL", "postgresql://siber:siber_dev_password@localhost:5433/siber?schema=public"),
  jwtSecret: req("JWT_SECRET", "dev-secret-no-usar-en-produccion"),
  sessionTtlHours: Number(req("SESSION_TTL_HOURS", "8")),
  corsOrigins: req("CORS_ORIGIN", "http://localhost:3000,http://localhost:5173").split(",").map(s => s.trim()),
  publicAppUrl: req("PUBLIC_APP_URL", "http://localhost:3000"),
  escudoUrl: req("ESCUDO_URL", "https://ecosistema.colmayor.edu.co/auditorio/colmayor.png"),
  smtp: {
    host: req("SMTP_HOST", ""),
    port: Number(req("SMTP_PORT", "587")),
    secure: req("SMTP_SECURE", "false") === "true",
    user: req("SMTP_USER", ""),
    pass: req("SMTP_PASS", ""),
    from: req("SMTP_FROM", "SIBER <no-responder@colmayor.edu.co>"),
  },
  port: Number(req("PORT", "3005")),
  outboxPollMs: Number(req("OUTBOX_POLL_MS", "15000")),
  qrJobPollMs: Number(req("QR_JOB_POLL_MS", "30000")),
  finalizaJobPollMs: Number(req("FINALIZA_JOB_POLL_MS", "600000")),
  recordatorioJobPollMs: Number(req("RECORDATORIO_JOB_POLL_MS", "300000")),
  nodeEnv: req("NODE_ENV", "development"),
};

export const ZONA = "America/Bogota" as const;
