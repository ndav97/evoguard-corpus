// Tests ocultos del estudio.
import { applyMask, convertParenthesesToNegative } from "utils/other/mask";

// T003 — Notación contable.
describe("T003 · negativos entre paréntesis", () => {
  test("convierte la notación contable", () => {
    const cases = [
      ["(1,234)", "-1,234"],
      ["($1,234.50)", "$-1,234.50"],
      ["(12%)", "-12%"],
      [" ( 42 ) ", "-42"],
      ["(1.5k)", "-1.5k"],
    ];
    for (const [input, expected] of cases) {
      expect(convertParenthesesToNegative(input)).toBe(expected);
    }
  });

  test("otros textos no cambian", () => {
    for (const input of ["1234", "(-5)", "()", "(1", "1)", "((1))", "$(5)"]) {
      expect(convertParenthesesToNegative(input)).toBe(input);
    }
  });

  test("las máscaras aceptan la notación", () => {
    expect(applyMask("(1,234)", "comma-separated")).toEqual({
      isValid: true,
      maskedValue: "-1,234",
    });
    expect(applyMask("($1,234.5)", "currency").maskedValue).toBe("-1,234.50");
    expect(applyMask("(12%)", "percentage").maskedValue).toBe("-12");
    expect(applyMask("(3,000)", "integer").maskedValue).toBe("-3,000");
    expect(applyMask("(1.5k)", "comma-separated").maskedValue).toBe("-1,500");
  });

  test("lo que no es un número se devuelve tal cual", () => {
    expect(applyMask("(abc)", "comma-separated")).toEqual({
      isValid: false,
      maskedValue: "(abc)",
    });
    expect(applyMask("(1):2", "ratio").isValid).toBe(false);
  });
});
