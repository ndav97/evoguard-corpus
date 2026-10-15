// Tests ocultos del estudio.
import { getExpirationSummary } from '../components/dashboard/sidebar/utils';

const NOW = new Date('2030-06-01T08:00:00Z');

describe('T005 · resumen de caducidad', () => {
  it('combina la primera subvención, los días y el estado', () => {
    const offers = [{ id: 'o1', isCurrent: true, endDatetime: '2030-06-11T00:00:00Z' }];
    const unexpiredPolicies = [{ id: 'p1', subsidyExpirationDate: '2030-07-20T00:00:00Z' }];
    expect(getExpirationSummary({ offers, unexpiredPolicies }, NOW)).toEqual({
      type: 'offer',
      subsidy: offers[0],
      expirationDate: '2030-06-11T00:00:00Z',
      daysUntilExpiration: 10,
      status: 'urgent',
    });
  });

  it('usa los umbrales recibidos', () => {
    const unexpiredPolicies = [{ id: 'p1', subsidyExpirationDate: '2030-07-20T00:00:00Z' }];
    const summary = getExpirationSummary({ unexpiredPolicies }, NOW, { warningDays: 30 });
    expect(summary.daysUntilExpiration).toBe(49);
    expect(summary.status).toBe('active');
    expect(getExpirationSummary({ unexpiredPolicies }, NOW).status).toBe('warning');
  });

  it('sin subvenciones devuelve null', () => {
    expect(getExpirationSummary({ offers: [], unexpiredPolicies: [] }, NOW)).toBeNull();
    expect(getExpirationSummary(undefined, NOW)).toBeNull();
  });
});
