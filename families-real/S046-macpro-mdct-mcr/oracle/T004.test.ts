// Tests ocultos del estudio.
import { applyMask, maskResponseData } from "utils/other/mask";

// T004 — Cero sin signo.
describe("T004 · sin cero negativo", () => {
  test("currency no muestra -0.00", () => {
    expect(applyMask("-0.004", "currency").maskedValue).toBe("0.00");
    expect(applyMask("-0.00", "currency").maskedValue).toBe("0.00");
    expect(applyMask("-0.4", "currency", 0).maskedValue).toBe("0");
  });

  test("comma-separated, percentage e integer tampoco", () => {
    expect(applyMask("-0", "comma-separated").maskedValue).toBe("0");
    expect(applyMask("-0.0%", "percentage").maskedValue).toBe("0");
    expect(applyMask("-0.4", "comma-separated", 0).maskedValue).toBe("0");
    expect(applyMask("-0", "integer").maskedValue).toBe("0");
    expect(applyMask("(0)", "integer").maskedValue).toBe("0");
  });

  test("maskResponseData tampoco", () => {
    expect(maskResponseData("-0", "currency")).toBe("$0");
    expect(maskResponseData("-0.0")).toBe("0");
    expect(maskResponseData("-0", "percentage")).toBe("0%");
  });

  test("los negativos que no son cero siguen igual", () => {
    expect(applyMask("-0.5", "comma-separated").maskedValue).toBe("-0.5");
    expect(applyMask("-0.005", "currency").maskedValue).toBe("-0.01");
    expect(applyMask("-12", "integer").maskedValue).toBe("-12");
    expect(maskResponseData("-12", "currency")).toBe("-$12");
  });
});
