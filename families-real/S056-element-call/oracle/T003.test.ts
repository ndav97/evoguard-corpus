// Tests ocultos del estudio.
import { describe, expect, test } from "vitest";

import { autoVideoFit, videoCropFraction } from "../utils/videoFit";

describe("T003 · fracción recortada", () => {
  test("es 0 con las mismas proporciones", () => {
    expect(videoCropFraction(16 / 9, 16 / 9)).toBe(0);
    expect(videoCropFraction(1, 1)).toBe(0);
  });

  test("16:9 en 4:3 pierde una cuarta parte, y al revés también", () => {
    expect(videoCropFraction(16 / 9, 4 / 3)).toBeCloseTo(0.25, 10);
    expect(videoCropFraction(4 / 3, 16 / 9)).toBeCloseTo(0.25, 10);
  });

  test("vertical en horizontal", () => {
    expect(videoCropFraction(9 / 16, 16 / 9)).toBeCloseTo(1 - 81 / 256, 10);
  });

  test("siempre entre 0 y 1", () => {
    for (const [v, t] of [
      [0.01, 100],
      [3, 0.2],
      [1.5, 1.5],
    ]) {
      const fraction = videoCropFraction(v, t);
      expect(fraction).toBeGreaterThan(-1e-12);
      expect(fraction).toBeLessThan(1);
    }
  });

  test.each([NaN, 0, -1, Infinity])("con %s devuelve 0", (bad) => {
    expect(videoCropFraction(bad, 1.5)).toBe(0);
    expect(videoCropFraction(1.5, bad)).toBe(0);
  });

  test("autoVideoFit no cambia", () => {
    expect(autoVideoFit(16 / 9, 9 / 16)).toBe("contain");
  });
});
