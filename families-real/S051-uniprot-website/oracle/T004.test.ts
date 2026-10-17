// Tests ocultos del estudio.
import { formatCount } from '../shared/utils/roundNumber';

describe('T004 · formatCount', () => {
  it('abrevia y añade el sustantivo', () => {
    expect(formatCount(12_345, 'entry', 'entries')).toBe('12k entries');
    expect(formatCount(1_499_500, 'sequence')).toBe('1M sequences');
  });

  it('singular solo para 1 y -1', () => {
    expect(formatCount(1, 'entry', 'entries')).toBe('1 entry');
    expect(formatCount(-1, 'entry', 'entries')).toBe('-1 entry');
    expect(formatCount(0, 'entry', 'entries')).toBe('0 entries');
    expect(formatCount(1.2, 'entry', 'entries')).toBe('1 entries');
  });

  it('plural por defecto con s', () => {
    expect(formatCount(3, 'protein')).toBe('3 proteins');
  });

  it('pasa las opciones y trata los no finitos', () => {
    expect(formatCount(1499, 'entry', 'entries', { decimals: 1 })).toBe('1.5k entries');
    expect(formatCount(NaN, 'entry', 'entries')).toBe('— entries');
  });
});
