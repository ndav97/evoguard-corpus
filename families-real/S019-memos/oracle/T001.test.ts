// Tests ocultos del estudio.
import { describe, expect, it } from "vitest";
import { formatFileSize } from "@/utils/format";

// T001 — Tamaños de archivo sin unidades inválidas ni «1024.0».
describe("T001 · formatFileSize", () => {
  it("pasa a la unidad siguiente cuando el redondeo llega a 1024", () => {
    expect(formatFileSize(1048570)).toBe("1.0 MB");
    expect(formatFileSize(1024 * 1024 - 1)).toBe("1.0 MB");
    expect(formatFileSize(1024 ** 3 - 1)).toBe("1.0 GB");
  });

  it("no sobrepasa los terabytes", () => {
    expect(formatFileSize(1024 ** 5)).toBe("1024.0 TB");
    expect(formatFileSize(1024 ** 4 * 1.5)).toBe("1.5 TB");
  });

  it("los bytes van sin decimales y las fracciones se redondean hacia abajo", () => {
    expect(formatFileSize(1023)).toBe("1023 B");
    expect(formatFileSize(512.9)).toBe("512 B");
    expect(formatFileSize(0.5)).toBe("0 B");
  });

  it("valores no válidos", () => {
    expect(formatFileSize(-1)).toBe("Invalid size");
    expect(formatFileSize(Number.NaN)).toBe("Invalid size");
    expect(formatFileSize(Number.POSITIVE_INFINITY)).toBe("Invalid size");
  });

  it("los casos habituales no cambian", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
  });
});
