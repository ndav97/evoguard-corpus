// Tests ocultos del estudio.
import { getSubsidyExpiringFirst } from '../components/dashboard/sidebar/utils';

const offer = (id, endDatetime, isCurrent = true) => ({ id, endDatetime, isCurrent });
const policy = (id, subsidyExpirationDate) => ({ id, subsidyExpirationDate });

describe('T004 · primera subvención que caduca', () => {
  it('elige la oferta si caduca antes', () => {
    const offers = [offer('o1', '2030-02-01T00:00:00Z'), offer('o2', '2030-01-01T00:00:00Z')];
    const unexpiredPolicies = [policy('p1', '2030-03-01T00:00:00Z')];
    expect(getSubsidyExpiringFirst({ offers, unexpiredPolicies })).toEqual({
      type: 'offer',
      subsidy: offers[1],
      expirationDate: '2030-01-01T00:00:00Z',
    });
  });

  it('elige la política si caduca antes', () => {
    const result = getSubsidyExpiringFirst({
      offers: [offer('o1', '2030-05-01T00:00:00Z')],
      unexpiredPolicies: [policy('p1', '2030-04-01T00:00:00Z'), policy('p2', '2030-03-01T00:00:00Z')],
    });
    expect(result.type).toBe('policy');
    expect(result.subsidy.id).toBe('p2');
    expect(result.expirationDate).toBe('2030-03-01T00:00:00Z');
  });

  it('con la misma fecha gana la política', () => {
    const result = getSubsidyExpiringFirst({
      offers: [offer('o1', '2030-01-01T00:00:00.000Z')],
      unexpiredPolicies: [policy('p1', '2030-01-01T00:00:00Z')],
    });
    expect(result.type).toBe('policy');
  });

  it('solo cuentan las candidatas con fecha válida', () => {
    const result = getSubsidyExpiringFirst({
      offers: [offer('o1', 'bad date')],
      unexpiredPolicies: [policy('p1', '2031-01-01T00:00:00Z')],
    });
    expect(result.subsidy.id).toBe('p1');
    expect(
      getSubsidyExpiringFirst({ offers: [offer('o1', 'x')], unexpiredPolicies: [policy('p1')] }),
    ).toBeNull();
  });

  it('sin candidatas devuelve null', () => {
    expect(getSubsidyExpiringFirst()).toBeNull();
    expect(getSubsidyExpiringFirst({ offers: [], unexpiredPolicies: [] })).toBeNull();
    expect(getSubsidyExpiringFirst({ offers: [offer('o1', '2030-01-01T00:00:00Z', false)] })).toBeNull();
  });
});
