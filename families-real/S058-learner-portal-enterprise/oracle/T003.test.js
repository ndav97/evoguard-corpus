// Tests ocultos del estudio.
import {
  EXPIRATION_URGENT_DAYS,
  EXPIRATION_WARNING_DAYS,
  getExpirationStatus,
} from '../components/dashboard/sidebar/utils';

const NOW = new Date('2030-06-01T10:00:00Z');
const inDays = (days) => new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);

describe('T003 · estado de caducidad', () => {
  it('exporta los umbrales', () => {
    expect(EXPIRATION_WARNING_DAYS).toBe(60);
    expect(EXPIRATION_URGENT_DAYS).toBe(14);
  });

  it.each([
    [-1, 'expired'],
    [-400, 'expired'],
    [0, 'urgent'],
    [14, 'urgent'],
    [15, 'warning'],
    [60, 'warning'],
    [61, 'active'],
  ])('a %s días es %s', (days, expected) => {
    expect(getExpirationStatus(inDays(days), NOW)).toBe(expected);
  });

  it('acepta umbrales propios', () => {
    expect(getExpirationStatus(inDays(20), NOW, { urgentDays: 30 })).toBe('urgent');
    expect(getExpirationStatus(inDays(20), NOW, { warningDays: 10, urgentDays: 5 })).toBe('active');
    expect(getExpirationStatus(inDays(0), NOW, { urgentDays: 0 })).toBe('urgent');
  });

  it('umbrales no válidos usan los valores por defecto', () => {
    expect(getExpirationStatus(inDays(10), NOW, { urgentDays: -1 })).toBe('urgent');
    expect(getExpirationStatus(inDays(50), NOW, { warningDays: 1.5 })).toBe('warning');
  });

  it('fecha no válida da null', () => {
    expect(getExpirationStatus('nunca', NOW)).toBeNull();
    expect(getExpirationStatus(undefined, NOW)).toBeNull();
  });
});
