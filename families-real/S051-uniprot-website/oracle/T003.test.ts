// Tests ocultos del estudio.
import {
  type RoundNumberOptions,
  roundNumber,
} from '../shared/utils/roundNumber';

describe('T003 · decimales', () => {
  it('redondea a los decimales pedidos sin ceros finales', () => {
    const oneDecimal: RoundNumberOptions = { decimals: 1 };
    expect(roundNumber(1499, 1, oneDecimal)).toBe('1.5k');
    expect(roundNumber(1440, 1, oneDecimal)).toBe('1.4k');
    expect(roundNumber(1000, 1, { decimals: 2 })).toBe('1k');
    expect(roundNumber(1_234_567, 1, { decimals: 2 })).toBe('1.23M');
    expect(roundNumber(12.345, 1, { decimals: 3 })).toBe('12.345');
  });

  it('pasa a la unidad siguiente si el redondeo la alcanza', () => {
    expect(roundNumber(999_960, 1, { decimals: 1 })).toBe('1M');
    expect(roundNumber(999_940, 1, { decimals: 1 })).toBe('999.9k');
  });

  it('valores de decimals no válidos cuentan como 0', () => {
    for (const decimals of [-1, 4, 1.5, NaN]) {
      expect(roundNumber(1499, 1, { decimals })).toBe('1k');
    }
  });

  it('negativos, no finitos y scaleMargin siguen igual', () => {
    expect(roundNumber(-1499, 1, { decimals: 1 })).toBe('-1.5k');
    expect(roundNumber(-0.04, 1, { decimals: 1 })).toBe('0');
    expect(roundNumber(NaN, 1, { decimals: 1 })).toBe('—');
    expect(roundNumber(9_999, 10, { decimals: 1 })).toBe('9,999');
  });

  it('sin opciones no cambia', () => {
    expect(roundNumber(1499)).toBe('1k');
    expect(roundNumber(1_499_500)).toBe('1M');
  });
});
