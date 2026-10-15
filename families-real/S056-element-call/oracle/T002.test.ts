// Tests ocultos del estudio.
import { describe, expect, test } from "vitest";

import {
  autoVideoFit,
  SQUARE_ASPECT_RATIO_MAX,
  SQUARE_ASPECT_RATIO_MIN,
} from "../utils/videoFit";

describe("T002 · mosaicos casi cuadrados", () => {
  test("exporta las cotas", () => {
    expect(SQUARE_ASPECT_RATIO_MIN).toBe(0.9);
    expect(SQUARE_ASPECT_RATIO_MAX).toBe(1.1);
  });

  test.each([0.9, 0.95, 1, 400 / 390, 1.1])(
    "un mosaico de proporción %s usa cover con cualquier vídeo",
    (tile) => {
      expect(autoVideoFit(16 / 9, tile)).toBe("cover");
      expect(autoVideoFit(9 / 16, tile)).toBe("cover");
    },
  );

  test("fuera de las cotas se decide como siempre", () => {
    expect(autoVideoFit(9 / 16, 1.11)).toBe("contain");
    expect(autoVideoFit(16 / 9, 0.89)).toBe("contain");
  });

  test("un vídeo cuadrado en un mosaico horizontal sigue como antes", () => {
    expect(autoVideoFit(1, 16 / 9)).toBe("contain");
  });

  test("las proporciones no válidas siguen dando cover", () => {
    expect(autoVideoFit(0, 1)).toBe("cover");
  });
});
