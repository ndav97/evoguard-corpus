// Tests ocultos del estudio.
import { describe, expect, it } from 'vitest';

import { formatWaitTimeInMinutes, getAverageWaitTimeInMinutes } from '../wait-time';

const NOW = new Date('2030-01-15T10:00:00Z');

describe('T004 · espera media', () => {
  it('promedia las esperas válidas', () => {
    expect(
      getAverageWaitTimeInMinutes(['2030-01-15T09:50:00Z', '2030-01-15T09:00:00Z', '2030-01-15T09:45:30Z'], NOW),
    ).toBeCloseTo((10 + 60 + 14) / 3, 10);
  });

  it('ignora las entradas sin hora válida', () => {
    expect(getAverageWaitTimeInMinutes([null, '2030-01-15T09:40:00Z', 'x', undefined, ''], NOW)).toBe(20);
  });

  it('las llegadas futuras cuentan como espera cero', () => {
    expect(getAverageWaitTimeInMinutes(['2030-01-15T10:30:00Z', '2030-01-15T09:30:00Z'], NOW)).toBe(15);
  });

  it('sin entradas válidas devuelve null', () => {
    expect(getAverageWaitTimeInMinutes([], NOW)).toBeNull();
    expect(getAverageWaitTimeInMinutes([null, 'x'], NOW)).toBeNull();
    expect(getAverageWaitTimeInMinutes(null, NOW)).toBeNull();
    expect(getAverageWaitTimeInMinutes(undefined, NOW)).toBeNull();
    expect(formatWaitTimeInMinutes(getAverageWaitTimeInMinutes([], NOW))).toBe('--');
  });

  it('no modifica el array', () => {
    const times = ['2030-01-15T09:00:00Z', null];
    getAverageWaitTimeInMinutes(times, NOW);
    expect(times).toEqual(['2030-01-15T09:00:00Z', null]);
  });
});
