import crypto from "crypto";

/** Genera un token opaco URL-safe (256 bits) */
export function generarToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** Hash SHA-256 del token: solo esto se persiste */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generarCodigoReserva(): string {
  const n = crypto.randomInt(0, 36 ** 6);
  return `SIF-${n.toString(36).toUpperCase().padStart(6, "0")}`;
}

export function compararHashSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// ── Cifrado simétrico para tokens que deben reconstruirse más tarde ──
// Clave derivada del secreto JWT; formato: base64(iv).base64(tag).base64(ct)

function claveCifrado(): Buffer {
  return crypto.createHash("sha256").update(process.env.JWT_SECRET ?? "dev-secret").digest();
}

export function cifrarToken(token: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", claveCifrado(), iv);
  const ct = Buffer.concat([c.update(token, "utf8"), c.final()]);
  return `${iv.toString("base64")}.${c.getAuthTag().toString("base64")}.${ct.toString("base64")}`;
}

export function descifrarToken(dato: string): string {
  const [iv64, tag64, ct64] = dato.split(".");
  const d = crypto.createDecipheriv("aes-256-gcm", claveCifrado(), Buffer.from(iv64, "base64"));
  d.setAuthTag(Buffer.from(tag64, "base64"));
  return Buffer.concat([d.update(Buffer.from(ct64, "base64")), d.final()]).toString("utf8");
}
