// Tests ocultos del estudio.
import { describe, expect, it } from 'vitest';

import { formatWaitTimeInMinutes, formatWaitTimeShort } from '../wait-time';

describe('T005 · formato compacto', () => {
  it.each([
    [0, '0m'],
    [7, '7m'],
    [59.4, '59m'],
    [59.6, '1h'],
    [108, '1h 48m'],
    [120, '2h'],
    [24 * 60 - 1, '23h 59m'],
    [30 * 60, '1d 6h'],
    [3 * 24 * 60 + 59, '3d'],
    [2 * 24 * 60 + 61, '2d 1h'],
  ])('%s minutos se muestra como %s', (minutes, expected) => {
    expect(formatWaitTimeShort(minutes)).toBe(expected);
  });

  it('negativos y valores no válidos', () => {
    expect(formatWaitTimeShort(-3)).toBe('0m');
    expect(formatWaitTimeShort(NaN)).toBe('--');
    expect(formatWaitTimeShort(null)).toBe('--');
    expect(formatWaitTimeShort(undefined)).toBe('--');
  });

  it('el formato largo no cambia', () => {
    expect(formatWaitTimeInMinutes(108)).toBe('1 hour, 48 minutes');
  });
});
