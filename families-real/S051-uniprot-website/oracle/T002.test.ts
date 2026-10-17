// Tests ocultos del estudio.
import { NOT_A_NUMBER_LABEL, roundNumber } from '../shared/utils/roundNumber';

describe('T002 · negativos y no finitos', () => {
  it('exporta la raya', () => {
    expect(NOT_A_NUMBER_LABEL).toBe('—');
  });

  it.each([NaN, Infinity, -Infinity])('%s devuelve la raya', (value) => {
    expect(roundNumber(value)).toBe('—');
  });

  it('abrevia los negativos como su valor absoluto', () => {
    expect(roundNumber(-1500)).toBe('-2k');
    expect(roundNumber(-999)).toBe('-999');
    expect(roundNumber(-1_499_500)).toBe('-1M');
    expect(roundNumber(-9_999, 10)).toBe('-9,999');
  });

  it('sin signo cuando el redondeo da cero', () => {
    expect(roundNumber(-0.4)).toBe('0');
    expect(roundNumber(-0)).toBe('0');
  });

  it('lo positivo no cambia', () => {
    expect(roundNumber(999_600)).toBe('1M');
  });
});
