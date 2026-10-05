// Tests ocultos del estudio.
import { describe, expect, it } from 'vitest';
import { versionSortComparatorFn, sortByVersionInDecreasingOrder, getGreaterVersion } from '../versionSort';
import { WILDCARD_V } from '../hooks/useMeshModelComponents';

// T001 — Versiones con distinto número de segmentos.
describe('T001 · segmentos que faltan cuentan como 0', () => {
  it('una versión con menos segmentos se compara con la más larga', () => {
    expect(versionSortComparatorFn('1.2', '1.2.1')).toBeLessThan(0);
    expect(versionSortComparatorFn('1.2.1', '1.2')).toBeGreaterThan(0);
    expect(versionSortComparatorFn('2', '1.9.9')).toBeGreaterThan(0);
  });

  it('las versiones iguales devuelven 0', () => {
    expect(versionSortComparatorFn('1.2', '1.2.0')).toBe(0);
    expect(versionSortComparatorFn('1.2.3', '1.2.3')).toBe(0);
    expect(versionSortComparatorFn('v1.2', '1.2.0')).toBe(0);
  });

  it('getGreaterVersion elige bien aunque falten segmentos', () => {
    expect(getGreaterVersion('1.2.1', '1.2')).toBe('1.2.1');
    expect(getGreaterVersion('1.2', '1.2.1')).toBe('1.2.1');
  });

  it('la ordenación decreciente tiene en cuenta los segmentos que faltan', () => {
    expect(sortByVersionInDecreasingOrder(['1.2', '1.10', '1.2.5'])).toEqual([
      WILDCARD_V,
      '1.10',
      '1.2.5',
      '1.2',
    ]);
  });

  it('se mantienen el comodín y los argumentos que faltan', () => {
    expect(versionSortComparatorFn(WILDCARD_V, '1.0.0')).toBe(-1);
    expect(versionSortComparatorFn(undefined, '1.0.0')).toBeUndefined();
  });
});
