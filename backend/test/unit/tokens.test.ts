import { describe, it, expect } from "vitest";

process.env.JWT_SECRET = "test-secret-para-tokens";

import { generarToken, hashToken, cifrarToken, descifrarToken, generarCodigoReserva } from "../../src/utils/tokens";

describe("tokens", () => {
  it("genera tokens únicos y opacos", () => {
    const a = generarToken(), b = generarToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(30);
  });

  it("hashToken es determinista", () => {
    const t = generarToken();
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toBe(t);
  });

  it("cifrar/descifrar es simétrico y el cifrado no expone el token", () => {
    const t = generarToken();
    const c = cifrarToken(t);
    expect(c).not.toContain(t);
    expect(descifrarToken(c)).toBe(t);
  });

  it("descifrar con dato corrupto falla", () => {
    const c = cifrarToken(generarToken());
    const partes = c.split(".");
    partes[2] = Buffer.from("corrupto").toString("base64");
    expect(() => descifrarToken(partes.join("."))).toThrow();
  });

  it("codigo de reserva tiene formato SIF-XXXXXX", () => {
    expect(generarCodigoReserva()).toMatch(/^SIF-[0-9A-Z]{6}$/);
  });
});
