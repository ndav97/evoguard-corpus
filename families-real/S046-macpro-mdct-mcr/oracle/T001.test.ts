// Tests ocultos del estudio.
import {
  applyMask,
  convertToThousandsSeparatedIntegerString,
  maskMap,
} from "utils/other/mask";

// T001 — Máscara integer.
describe("T001 · máscara integer", () => {
  test("está en maskMap", () => {
    expect(maskMap.integer).toBe(convertToThousandsSeparatedIntegerString);
  });

  test("enteros con separador de miles", () => {
    const cases = [
      ["1234", "1,234"],
      ["12.00", "12"],
      ["-5000", "-5,000"],
      ["000123", "123"],
      ["1,234,567", "1,234,567"],
      ["$1234", "1,234"],
      ["0", "0"],
    ];
    for (const [input, expected] of cases) {
      expect(convertToThousandsSeparatedIntegerString(input)).toEqual({
        isValid: true,
        maskedValue: expected,
      });
    }
  });

  test("decimales, texto o vacío no son válidos y se devuelven tal cual", () => {
    for (const input of ["12.5", "0.01", "abc", "1..2", "", "--3"]) {
      expect(convertToThousandsSeparatedIntegerString(input)).toEqual({
        isValid: false,
        maskedValue: input,
      });
    }
  });

  test("applyMask con integer ignora los decimales fijos", () => {
    expect(applyMask("1234", "integer", 2)).toEqual({
      isValid: true,
      maskedValue: "1,234",
    });
    expect(applyMask("7.25", "integer").isValid).toBe(false);
  });

  test("las demás máscaras no cambian", () => {
    expect(applyMask("12.5", "comma-separated").maskedValue).toBe("12.5");
    expect(applyMask("123", "currency").maskedValue).toBe("123.00");
  });
});
