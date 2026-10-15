// Tests ocultos del estudio.
import { describe, expect, it } from "vitest";
import { formatFileSize } from "@/utils/format";

// T004 — Unidades decimales (SI) opcionales.
describe("T004 · formatFileSize con unidades SI", () => {
  it("usa base 1000 y kB", () => {
    expect(formatFileSize(1000, { si: true })).toBe("1.0 kB");
    expect(formatFileSize(1500, { si: true })).toBe("1.5 kB");
    expect(formatFileSize(2_500_000, { si: true })).toBe("2.5 MB");
    expect(formatFileSize(3 * 1000 ** 3, { si: true })).toBe("3.0 GB");
  });

  it("los bytes siguen sin decimales", () => {
    expect(formatFileSize(999, { si: true })).toBe("999 B");
    expect(formatFileSize(0, { si: true })).toBe("0 B");
    expect(formatFileSize(512.9, { si: true })).toBe("512 B");
  });

  it("pasa a la unidad siguiente cuando el redondeo llega a 1000", () => {
    expect(formatFileSize(999_960, { si: true })).toBe("1.0 MB");
    expect(formatFileSize(1000 ** 3 - 1, { si: true })).toBe("1.0 GB");
  });

  it("no sobrepasa los terabytes", () => {
    expect(formatFileSize(1000 ** 5, { si: true })).toBe("1000.0 TB");
  });

  it("valores no válidos", () => {
    expect(formatFileSize(-1, { si: true })).toBe("Invalid size");
    expect(formatFileSize(Number.NaN, { si: true })).toBe("Invalid size");
  });

  it("sin la opción, o con si: false, se usa base 1024 como siempre", () => {
    expect(formatFileSize(1000)).toBe("1000 B");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(1536, { si: false })).toBe("1.5 KB");
    expect(formatFileSize(1536, {})).toBe("1.5 KB");
  });
});
