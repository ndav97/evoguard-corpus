// Tests ocultos del estudio.
import { parseRoundedNumber, roundNumber } from '../shared/utils/roundNumber';

describe('T005 · parseRoundedNumber', () => {
  it.each([
    ['12k', 12_000],
    ['1.5M', 1_500_000],
    ['2b', 2_000_000_000],
    ['  7 K ', 7_000],
    ['1.1k', 1_100],
    ['0.3M', 300_000],
    ['1,000B', 1e12],
    ['12,345,678', 12_345_678],
    ['999', 999],
    ['-2k', -2_000],
    ['-1.5k', -1_500],
    ['3.25', 3.25],
  ])('%s se lee como %s', (text, expected) => {
    expect(parseRoundedNumber(text)).toBe(expected);
  });

  it('cero sin signo', () => {
    expect(Object.is(parseRoundedNumber('-0'), 0)).toBe(true);
    expect(Object.is(parseRoundedNumber('-0.0k'), 0)).toBe(true);
  });

  it.each(['', '—', '1,00k', '1.5.2M', '12 k k', 'k', 'abc', '1e3', '+5'])(
    '%s no es un número abreviado',
    (text) => {
      expect(parseRoundedNumber(text)).toBeNull();
    }
  );

  it('lee de vuelta lo que produce roundNumber', () => {
    for (const value of [0, 999, 1500, 1_499_500, 1e12, -999_600]) {
      const text = roundNumber(value);
      expect(roundNumber(parseRoundedNumber(text) as number)).toBe(text);
    }
    expect(parseRoundedNumber(roundNumber(1499, 1, { decimals: 1 }))).toBe(1500);
  });
});
