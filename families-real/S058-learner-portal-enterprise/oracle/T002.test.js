// Tests ocultos del estudio.
import { getDaysUntilExpiration } from '../components/dashboard/sidebar/utils';

const NOW = new Date('2030-03-10T15:30:00Z');

describe('T002 · días hasta la caducidad', () => {
  it('cuenta días naturales en UTC', () => {
    expect(getDaysUntilExpiration('2030-03-10T23:59:59Z', NOW)).toBe(0);
    expect(getDaysUntilExpiration('2030-03-10T00:00:00Z', NOW)).toBe(0);
    expect(getDaysUntilExpiration('2030-03-11T00:00:01Z', NOW)).toBe(1);
    expect(getDaysUntilExpiration('2030-04-09T08:00:00Z', NOW)).toBe(30);
  });

  it('negativo si ya caducó', () => {
    expect(getDaysUntilExpiration('2030-03-09T23:00:00Z', NOW)).toBe(-1);
    expect(getDaysUntilExpiration('2029-03-10T12:00:00Z', NOW)).toBe(-365);
  });

  it('acepta Date, ISO y números', () => {
    const expiration = Date.UTC(2030, 2, 12, 1);
    expect(getDaysUntilExpiration(expiration, NOW.getTime())).toBe(2);
    expect(getDaysUntilExpiration(new Date(expiration), NOW.toISOString())).toBe(2);
  });

  it('fechas ausentes o no válidas dan null', () => {
    expect(getDaysUntilExpiration(undefined, NOW)).toBeNull();
    expect(getDaysUntilExpiration(null, NOW)).toBeNull();
    expect(getDaysUntilExpiration('pronto', NOW)).toBeNull();
    expect(getDaysUntilExpiration('2030-03-11', 'ayer')).toBeNull();
  });

  it('por defecto usa la fecha actual', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(getDaysUntilExpiration(tomorrow)).toBe(1);
  });
});
