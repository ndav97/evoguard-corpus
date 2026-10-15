// Tests ocultos del estudio.
import { maskResponseData } from "utils/other/mask";

// T005 — Decimales fijos en maskResponseData.
describe("T005 · maskResponseData con decimales fijos", () => {
  test("redondea y muestra exactamente esos decimales", () => {
    expect(maskResponseData("1234.5", "currency", 2)).toBe("$1,234.50");
    expect(maskResponseData("1234.567", "currency", 2)).toBe("$1,234.57");
    expect(maskResponseData("12.345", "percentage", 1)).toBe("12.3%");
    expect(maskResponseData("7", undefined, 2)).toBe("7.00");
    expect(maskResponseData("1999.6", "comma-separated", 0)).toBe("2,000");
  });

  test("ratio aplica los decimales a los dos lados", () => {
    expect(maskResponseData("1:3.14159", "ratio", 2)).toBe("1.00:3.14");
  });

  test("negativos y cero", () => {
    expect(maskResponseData("-1.5", "currency", 2)).toBe("-$1.50");
    expect(maskResponseData("-0.001", "currency", 2)).toBe("$0.00");
    expect(maskResponseData("-0.4", undefined, 0)).toBe("0");
  });

  test("sin decimales fijos válidos todo sigue igual", () => {
    expect(maskResponseData("1.5", "currency")).toBe("$1.50");
    expect(maskResponseData("1.234", "currency", 1.5)).toBe("$1.234");
    expect(maskResponseData("12.345", "percentage", -1)).toBe("12.345%");
  });

  test("N/A y supresión no cambian", () => {
    expect(maskResponseData("N/A", "currency", 2)).toBe("N/A");
    expect(maskResponseData("suppressed", "currency", 2)).toBe("Suppressed");
    expect(maskResponseData(undefined, "currency", 2)).toBeUndefined();
  });
});
