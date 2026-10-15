// Tests ocultos del estudio.
import { describe, expect, test } from "vitest";

import { autoVideoFit, type AutoVideoFitOptions } from "../utils/videoFit";

const ULTRAWIDE = 21 / 9;
const STANDARD = 4 / 3;

describe("T004 · maxCrop", () => {
  test("con mucho recorte usa contain aunque la orientación coincida", () => {
    const options: AutoVideoFitOptions = { maxCrop: 0.3 };
    expect(autoVideoFit(ULTRAWIDE, STANDARD, options)).toBe("contain");
    expect(autoVideoFit(ULTRAWIDE, STANDARD)).toBe("cover");
  });

  test("con poco recorte sigue usando cover", () => {
    expect(autoVideoFit(16 / 9, STANDARD, { maxCrop: 0.3 })).toBe("cover");
    expect(autoVideoFit(16 / 9, STANDARD, { maxCrop: 0.25 })).toBe("cover");
  });

  test("también se aplica a los mosaicos casi cuadrados", () => {
    expect(autoVideoFit(16 / 9, 1, { maxCrop: 0.2 })).toBe("contain");
    expect(autoVideoFit(16 / 9, 1, { maxCrop: 0.5 })).toBe("cover");
  });

  test("límites fuera de rango se ignoran", () => {
    for (const maxCrop of [-0.1, 1.5, NaN]) {
      expect(autoVideoFit(ULTRAWIDE, STANDARD, { maxCrop })).toBe("cover");
    }
    expect(autoVideoFit(ULTRAWIDE, STANDARD, { maxCrop: 0 })).toBe("contain");
    expect(autoVideoFit(STANDARD, STANDARD, { maxCrop: 0 })).toBe("cover");
  });

  test("las demás reglas no cambian", () => {
    expect(autoVideoFit(NaN, STANDARD, { maxCrop: 0 })).toBe("cover");
    expect(autoVideoFit(9 / 16, STANDARD, { maxCrop: 1 })).toBe("contain");
  });
});
