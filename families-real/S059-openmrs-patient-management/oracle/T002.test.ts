// Tests ocultos del estudio.
import { describe, expect, it } from 'vitest';

import { formatWaitTimeInMinutes, getWaitTimeInMinutes } from '../wait-time';

const NOW = new Date('2030-01-15T10:00:00Z');

describe('T002 · minutos desde la llegada', () => {
  it('cuenta minutos completos', () => {
    expect(getWaitTimeInMinutes('2030-01-15T09:30:00Z', NOW)).toBe(30);
    expect(getWaitTimeInMinutes('2030-01-15T09:58:01Z', NOW)).toBe(1);
    expect(getWaitTimeInMinutes('2030-01-15T09:59:59Z', NOW)).toBe(0);
    expect(getWaitTimeInMinutes('2030-01-14T10:00:00Z', NOW)).toBe(1440);
  });

  it('acepta Date, ISO y números', () => {
    const start = Date.UTC(2030, 0, 15, 8, 0);
    expect(getWaitTimeInMinutes(start, NOW.getTime())).toBe(120);
    expect(getWaitTimeInMinutes(new Date(start), NOW.toISOString())).toBe(120);
  });

  it('una llegada futura es espera cero', () => {
    expect(getWaitTimeInMinutes('2030-01-15T10:05:00Z', NOW)).toBe(0);
  });

  it('fechas ausentes o no válidas dan null', () => {
    expect(getWaitTimeInMinutes(null, NOW)).toBeNull();
    expect(getWaitTimeInMinutes(undefined, NOW)).toBeNull();
    expect(getWaitTimeInMinutes('', NOW)).toBeNull();
    expect(getWaitTimeInMinutes('ayer', NOW)).toBeNull();
    expect(getWaitTimeInMinutes('2030-01-15T09:00:00Z', 'ahora')).toBeNull();
  });

  it('se puede combinar con el formato', () => {
    expect(formatWaitTimeInMinutes(getWaitTimeInMinutes('2030-01-15T08:15:00Z', NOW))).toBe(
      '1 hour, 45 minutes',
    );
    expect(formatWaitTimeInMinutes(getWaitTimeInMinutes(null, NOW))).toBe('--');
  });
});
