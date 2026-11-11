/**
 * Entorno de pruebas de integración.
 * - Base de datos PostgreSQL REAL `siber_test` en :5433 (mismo contenedor `db`).
 * - Los tests deben importar `db`, `resetDb`, `crearEscenario` desde aquí.
 * - El servidor SMTP de captura (`smtp-test.ts`) permite probar el outbox
 *   y el job del QR con SMTP real (y simular fallos apagándolo).
 */
import { execSync } from "child_process";
import path from "path";

process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  "postgresql://siber:siber_dev_password@localhost:5433/siber_test?schema=public";
process.env.JWT_SECRET = "test-secret-siber-0123456789abcdef0123456789abcdef";
process.env.PUBLIC_APP_URL = "http://localhost:3999";
process.env.OUTBOX_POLL_MS = "100";
process.env.QR_JOB_POLL_MS = "100";
process.env.FINALIZA_JOB_POLL_MS = "100";
process.env.RECORDATORIO_JOB_POLL_MS = "100";
process.env.CORS_ORIGIN = "http://localhost:3999";
// SMTP: el test lo configura explícitamente por escenario (puerto 3525)
process.env.SMTP_HOST = "localhost";
process.env.SMTP_PORT = "3525";
process.env.SMTP_SECURE = "false";
process.env.SMTP_FROM = "SIBER Test <test@localhost>";
process.env.SMTP_USER = "";
process.env.SMTP_PASS = "";

let esquemaAplicado = false;

export function asegurarEsquema() {
  if (esquemaAplicado) return;
  execSync("npx prisma migrate deploy", {
    cwd: path.join(__dirname, "..", ".."),
    env: { ...process.env },
    stdio: "inherit",
  });
  esquemaAplicado = true;
}
