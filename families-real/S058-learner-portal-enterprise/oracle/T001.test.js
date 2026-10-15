// Tests ocultos del estudio.
import {
  getOfferExpiringFirst,
  getPolicyExpiringFirst,
} from '../components/dashboard/sidebar/utils';

describe('T001 · fechas no válidas', () => {
  it('las ofertas sin fecha válida van al final', () => {
    const offers = [
      { id: 'a', isCurrent: true },
      { id: 'b', isCurrent: true, endDatetime: 'not a date' },
      { id: 'c', isCurrent: true, endDatetime: '2031-05-01T00:00:00Z' },
      { id: 'd', isCurrent: true, endDatetime: '2030-05-01T00:00:00Z' },
      { id: 'e', isCurrent: false, endDatetime: '2020-05-01T00:00:00Z' },
    ];
    expect(getOfferExpiringFirst(offers).id).toBe('d');
  });

  it('si ninguna oferta tiene fecha, la primera actual', () => {
    const offers = [
      { id: 'x', isCurrent: false },
      { id: 'a', isCurrent: true },
      { id: 'b', isCurrent: true, endDatetime: '' },
    ];
    expect(getOfferExpiringFirst(offers).id).toBe('a');
  });

  it('las políticas sin caducar sin fecha válida van al final', () => {
    const result = getPolicyExpiringFirst({
      expiredPolicies: [],
      unexpiredPolicies: [
        { id: 'a', subsidyExpirationDate: null },
        { id: 'b', subsidyExpirationDate: '2032-01-01T00:00:00Z' },
        { id: 'c', subsidyExpirationDate: 'soon' },
        { id: 'd', subsidyExpirationDate: '2031-01-01T00:00:00Z' },
      ],
    });
    expect(result.id).toBe('d');
  });

  it('entre las caducadas ignora las que no tienen fecha válida', () => {
    const result = getPolicyExpiringFirst({
      expiredPolicies: [
        { id: 'a', subsidyExpirationDate: 'yesterday' },
        { id: 'b', subsidyExpirationDate: '2020-01-01T00:00:00Z' },
        { id: 'c' },
        { id: 'd', subsidyExpirationDate: '2021-01-01T00:00:00Z' },
      ],
      unexpiredPolicies: [],
    });
    expect(result.id).toBe('d');
    expect(
      getPolicyExpiringFirst({ expiredPolicies: [{ id: 'z' }], unexpiredPolicies: [] }),
    ).toBeUndefined();
  });

  it('no modifica los arrays recibidos', () => {
    const offers = [
      { id: 'a', isCurrent: true, endDatetime: '2031-01-01T00:00:00Z' },
      { id: 'b', isCurrent: true, endDatetime: '2030-01-01T00:00:00Z' },
    ];
    const unexpiredPolicies = [
      { id: 'a', subsidyExpirationDate: '2031-01-01T00:00:00Z' },
      { id: 'b', subsidyExpirationDate: '2030-01-01T00:00:00Z' },
    ];
    getOfferExpiringFirst(offers);
    getPolicyExpiringFirst({ expiredPolicies: [], unexpiredPolicies });
    expect(offers.map(o => o.id)).toEqual(['a', 'b']);
    expect(unexpiredPolicies.map(p => p.id)).toEqual(['a', 'b']);
  });
});
