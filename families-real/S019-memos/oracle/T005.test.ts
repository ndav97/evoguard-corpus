// Tests ocultos del estudio.
import { describe, expect, it } from "vitest";
import { formatStorageUsage } from "@/utils/format";

// T005 — Uso del almacenamiento respecto de una cuota.
describe("T005 · formatStorageUsage", () => {
  it("muestra lo usado, la cuota y el porcentaje redondeado", () => {
    expect(formatStorageUsage(1536 * 1024, 10 * 1024 * 1024)).toBe("1.5 MB of 10.0 MB (15%)");
    expect(formatStorageUsage(1024, 3 * 1024)).toBe("1.0 KB of 3.0 KB (33%)");
    expect(formatStorageUsage(2 * 1024, 3 * 1024)).toBe("2.0 KB of 3.0 KB (67%)");
  });

  it("puede superar el 100 %", () => {
    expect(formatStorageUsage(12 * 1024, 10 * 1024)).toBe("12.0 KB of 10.0 KB (120%)");
  });

  it("sin cuota útil muestra solo lo usado", () => {
    expect(formatStorageUsage(1536)).toBe("1.5 KB");
    expect(formatStorageUsage(1536, 0)).toBe("1.5 KB");
    expect(formatStorageUsage(1536, -5)).toBe("1.5 KB");
    expect(formatStorageUsage(1536, Number.POSITIVE_INFINITY)).toBe("1.5 KB");
    expect(formatStorageUsage(1536, 0.5)).toBe("1.5 KB");
  });

  it("con un uso no válido devuelve Invalid size", () => {
    expect(formatStorageUsage(Number.NaN, 1024)).toBe("Invalid size");
    expect(formatStorageUsage(-1, 1024)).toBe("Invalid size");
  });

  it("sin nada usado indica 0 %", () => {
    expect(formatStorageUsage(0, 1024)).toBe("0 B of 1.0 KB (0%)");
  });

  it("acepta las unidades SI", () => {
    expect(formatStorageUsage(250_000, 1_000_000, { si: true })).toBe("250.0 kB of 1.0 MB (25%)");
  });

  it("los bytes fraccionarios se redondean hacia abajo también en el porcentaje", () => {
    expect(formatStorageUsage(1.9, 4.9)).toBe("1 B of 4 B (25%)");
  });
});
