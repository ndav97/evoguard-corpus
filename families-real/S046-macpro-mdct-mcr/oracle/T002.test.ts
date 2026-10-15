// Tests ocultos del estudio.
import { applyMask, expandAbbreviatedNumber } from "utils/other/mask";

// T002 — Abreviaturas.
describe("T002 · k, M y B", () => {
  test("expande las abreviaturas sin errores de coma flotante", () => {
    const cases = [
      ["1.5k", "1500"],
      ["2M", "2000000"],
      ["3.2b", "3200000000"],
      ["1.1k", "1100"],
      ["1.23456k", "1234.56"],
      [".5k", "500"],
      ["-0.5k", "-500"],
      ["$1,250.5k", "$1250500"],
      [" 7 K ", "7000"],
      ["0.000001M", "1"],
    ];
    for (const [input, expected] of cases) {
      expect(expandAbbreviatedNumber(input)).toBe(expected);
    }
  });

  test("sin abreviatura devuelve el texto sin cambios", () => {
    for (const input of ["1500", "abc", "k", "1.5kk", "1.5x", "$$1k"]) {
      expect(expandAbbreviatedNumber(input)).toBe(input);
    }
  });

  test("las máscaras numéricas aceptan abreviaturas", () => {
    expect(applyMask("1.5k", "comma-separated")).toEqual({
      isValid: true,
      maskedValue: "1,500",
    });
    expect(applyMask("$2M", "currency").maskedValue).toBe("2,000,000.00");
    expect(applyMask("12k", "percentage").maskedValue).toBe("12,000");
    expect(applyMask("2.5k", "integer").maskedValue).toBe("2,500");
    expect(applyMask("2.0005k", "integer").isValid).toBe(false);
  });

  test("abreviaturas no válidas y ratio no cambian", () => {
    expect(applyMask("1.5kk", "comma-separated")).toEqual({
      isValid: false,
      maskedValue: "1.5kk",
    });
    expect(applyMask("1k:2", "ratio")).toEqual({
      isValid: false,
      maskedValue: "1k:2",
    });
  });
});
