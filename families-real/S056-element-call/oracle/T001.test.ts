// Tests ocultos del estudio.
import { describe, expect, test } from "vitest";

import { autoVideoFit } from "../utils/videoFit";

const LANDSCAPE = 16 / 9;
const PORTRAIT = 9 / 16;

describe("T001 · proporciones no válidas", () => {
  test.each([0, -1, Infinity, -Infinity, NaN])(
    "devuelve cover si la proporción del vídeo es %s",
    (ratio) => {
      expect(autoVideoFit(ratio, PORTRAIT)).toBe("cover");
      expect(autoVideoFit(ratio, LANDSCAPE)).toBe("cover");
    },
  );

  test.each([0, -2, Infinity, -Infinity, NaN])(
    "devuelve cover si la proporción del mosaico es %s",
    (ratio) => {
      expect(autoVideoFit(PORTRAIT, ratio)).toBe("cover");
      expect(autoVideoFit(LANDSCAPE, ratio)).toBe("cover");
    },
  );

  test("con proporciones válidas no cambia", () => {
    expect(autoVideoFit(LANDSCAPE, PORTRAIT)).toBe("contain");
    expect(autoVideoFit(PORTRAIT, PORTRAIT)).toBe("cover");
    expect(autoVideoFit(LANDSCAPE, 4 / 3)).toBe("cover");
  });
});
