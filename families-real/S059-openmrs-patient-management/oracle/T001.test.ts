// Tests ocultos del estudio.
import { describe, expect, it } from 'vitest';

import { formatWaitTimeInMinutes, WAIT_TIME_PLACEHOLDER } from '../wait-time';

describe('T001 · tiempos no válidos', () => {
  it('exporta el marcador', () => {
    expect(WAIT_TIME_PLACEHOLDER).toBe('--');
  });

  it.each([NaN, Infinity, -Infinity, null, undefined])('con %s devuelve el marcador', (value) => {
    expect(formatWaitTimeInMinutes(value)).toBe('--');
  });

  it('los negativos son cero minutos', () => {
    expect(formatWaitTimeInMinutes(-5)).toBe('0 minutes');
    expect(formatWaitTimeInMinutes(-0.4)).toBe('0 minutes');
  });

  it('los valores válidos no cambian', () => {
    expect(formatWaitTimeInMinutes(65)).toBe('1 hour, 5 minutes');
    expect(formatWaitTimeInMinutes(0.4)).toBe('0 minutes');
  });
});
