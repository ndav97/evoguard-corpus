// Tests ocultos del estudio.
import { roundNumber } from '../shared/utils/roundNumber';

describe('T001 · un solo redondeo', () => {
  it('no redondea dos veces', () => {
    expect(roundNumber(1_499_500)).toBe('1M');
    expect(roundNumber(1_500_000)).toBe('2M');
    expect(roundNumber(2_449_999_999)).toBe('2B');
    expect(roundNumber(1_449_600)).toBe('1M');
  });

  it('pasa a la unidad siguiente si el redondeo la alcanza', () => {
    expect(roundNumber(999_600)).toBe('1M');
    expect(roundNumber(999_499)).toBe('999k');
    expect(roundNumber(999.5)).toBe('1k');
  });

  it('no inventa unidades más allá de B', () => {
    expect(roundNumber(1e12)).toBe('1,000B');
    expect(roundNumber(2.5e15)).toBe('2,500,000B');
  });

  it('respeta scaleMargin', () => {
    expect(roundNumber(9_999, 10)).toBe('9,999');
    expect(roundNumber(10_000, 10)).toBe('10k');
    expect(roundNumber(9_999_600, 10)).toBe('10M');
  });

  it('los valores de siempre no cambian', () => {
    expect(roundNumber(999)).toBe('999');
    expect(roundNumber(1500)).toBe('2k');
    expect(roundNumber(9999)).toBe('10k');
    expect(roundNumber(2e6)).toBe('2M');
  });
});
