// Tests ocultos del estudio.
import { describe, expect, test } from "vitest";

import { computeVideoFit, type Size } from "../utils/videoFit";

const hd: Size = { width: 1280, height: 720 };
const tile43: Size = { width: 400, height: 300 };

describe("T005 · computeVideoFit", () => {
  test("calcula el ajuste y el recorte desde tamaños", () => {
    const result = computeVideoFit(hd, tile43);
    expect(result.fit).toBe("cover");
    expect(result.cropFraction).toBeCloseTo(0.25, 10);
  });

  test("con contain el recorte es 0", () => {
    expect(computeVideoFit(hd, { width: 300, height: 600 })).toEqual({
      fit: "contain",
      cropFraction: 0,
    });
  });

  test("pasa las opciones", () => {
    expect(
      computeVideoFit({ width: 2100, height: 900 }, tile43, { maxCrop: 0.3 }),
    ).toEqual({ fit: "contain", cropFraction: 0 });
  });

  test("tamaños ausentes o vacíos dan cover sin recorte", () => {
    expect(computeVideoFit({ width: 0, height: 0 }, tile43)).toEqual({
      fit: "cover",
      cropFraction: 0,
    });
    expect(computeVideoFit(hd, { width: 300, height: 0 })).toEqual({
      fit: "cover",
      cropFraction: 0,
    });
    expect(computeVideoFit(undefined, tile43)).toEqual({
      fit: "cover",
      cropFraction: 0,
    });
    expect(computeVideoFit(hd, null)).toEqual({ fit: "cover", cropFraction: 0 });
  });

  test("respeta los mosaicos casi cuadrados", () => {
    const result = computeVideoFit({ width: 720, height: 1280 }, { width: 400, height: 390 });
    expect(result.fit).toBe("cover");
    expect(result.cropFraction).toBeGreaterThan(0.4);
  });
});
