import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";
import {
  expandirDisponibilidad, restarIntervalos, intervaloCubierto,
  minutosTotales, fusionar,
} from "../../src/utils/disponibilidad";
import { inicioSemana, minutosSolape } from "../../src/utils/tiempo";

const Z = "America/Bogota";
const dt = (s: string) => DateTime.fromISO(s, { zone: Z });

describe("expandirDisponibilidad", () => {
  it("expande franjas semanales a días concretos", () => {
    // lunes 10/11/2025 es weekday 1
    const franjas = expandirDisponibilidad(
      [{ diaSemana: 1, horaInicio: 8 * 60, horaFin: 12 * 60 }],
      dt("2025-11-10T00:00"), dt("2025-11-12T00:00")
    );
    expect(franjas).toHaveLength(1);
    expect(franjas[0].inicio.toFormat("HH:mm")).toBe("08:00");
    expect(franjas[0].fin.toFormat("HH:mm")).toBe("12:00");
    expect(franjas[0].inicio.weekday).toBe(1);
  });

  it("recorta al rango consultado", () => {
    const franjas = expandirDisponibilidad(
      [{ diaSemana: 1, horaInicio: 8 * 60, horaFin: 17 * 60 }],
      dt("2025-11-10T10:00"), dt("2025-11-10T11:00")
    );
    expect(franjas).toHaveLength(1);
    expect(franjas[0].inicio.toFormat("HH:mm")).toBe("10:00");
    expect(franjas[0].fin.toFormat("HH:mm")).toBe("11:00");
  });

  it("ignora franjas inválidas (inicio >= fin)", () => {
    const franjas = expandirDisponibilidad(
      [{ diaSemana: 1, horaInicio: 600, horaFin: 600 }],
      dt("2025-11-10T00:00"), dt("2025-11-11T00:00")
    );
    expect(franjas).toHaveLength(0);
  });
});

describe("restarIntervalos", () => {
  const base = [{ inicio: dt("2025-11-10T08:00"), fin: dt("2025-11-10T17:00") }];

  it("resta en el medio produce dos segmentos", () => {
    const r = restarIntervalos(base, [{ inicio: dt("2025-11-10T12:00"), fin: dt("2025-11-10T13:00") }]);
    expect(r).toHaveLength(2);
    expect(minutosTotales(r)).toBe(8 * 60);
  });

  it("resta total produce cero", () => {
    const r = restarIntervalos(base, [{ inicio: dt("2025-11-10T07:00"), fin: dt("2025-11-10T18:00") }]);
    expect(r).toHaveLength(0);
  });

  it("intervalos ocupados superpuestos no duplican descuento", () => {
    const r = restarIntervalos(base, [
      { inicio: dt("2025-11-10T09:00"), fin: dt("2025-11-10T12:00") },
      { inicio: dt("2025-11-10T10:00"), fin: dt("2025-11-10T14:00") },
    ]);
    expect(minutosTotales(r)).toBe(4 * 60); // solo 9-14 ocupado → quedan 8-9 y 14-17
  });
});

describe("intervaloCubierto", () => {
  it("detecta cobertura completa con varias franjas contiguas", () => {
    const cubierto = intervaloCubierto(
      dt("2025-11-10T08:30"), dt("2025-11-10T11:00"),
      [
        { inicio: dt("2025-11-10T08:00"), fin: dt("2025-11-10T10:00") },
        { inicio: dt("2025-11-10T10:00"), fin: dt("2025-11-10T12:00") },
      ]
    );
    expect(cubierto).toBe(true);
  });

  it("rechaza cuando hay un hueco", () => {
    const cubierto = intervaloCubierto(
      dt("2025-11-10T08:30"), dt("2025-11-10T11:30"),
      [
        { inicio: dt("2025-11-10T08:00"), fin: dt("2025-11-10T09:00") },
        { inicio: dt("2025-11-10T10:00"), fin: dt("2025-11-10T12:00") },
      ]
    );
    expect(cubierto).toBe(false);
  });

  it("rechaza rango de duración cero", () => {
    const d = dt("2025-11-10T09:00");
    expect(intervaloCubierto(d, d, [{ inicio: dt("2025-11-10T08:00"), fin: dt("2025-11-10T17:00") }])).toBe(false);
  });
});

describe("fusionar y minutosSolape", () => {
  it("fusiona contiguos y solapados", () => {
    const f = fusionar([
      { inicio: dt("2025-11-10T08:00"), fin: dt("2025-11-10T09:00") },
      { inicio: dt("2025-11-10T09:00"), fin: dt("2025-11-10T10:00") },
      { inicio: dt("2025-11-10T09:30"), fin: dt("2025-11-10T11:00") },
    ]);
    expect(f).toHaveLength(1);
    expect(minutosTotales(f)).toBe(180);
  });

  it("minutosSolape: bordes que se tocan no solapan", () => {
    expect(minutosSolape(dt("2025-11-10T08:00"), dt("2025-11-10T10:00"), dt("2025-11-10T10:00"), dt("2025-11-10T12:00"))).toBe(0);
    expect(minutosSolape(dt("2025-11-10T08:00"), dt("2025-11-10T11:00"), dt("2025-11-10T10:00"), dt("2025-11-10T12:00"))).toBe(60);
  });
});

describe("inicioSemana", () => {
  it("la semana empieza en lunes 00:00 Bogotá", () => {
    const d = dt("2025-11-12T15:00"); // miércoles
    const ini = inicioSemana(d);
    expect(ini.weekday).toBe(1);
    expect(ini.toFormat("HH:mm")).toBe("00:00");
    expect(ini.zoneName).toBe(Z);
  });
});
