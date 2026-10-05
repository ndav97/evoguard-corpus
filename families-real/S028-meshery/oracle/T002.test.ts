// Tests ocultos del estudio.
import { describe, expect, it } from 'vitest';
import { versionSortComparatorFn, sortByVersionInDecreasingOrder } from '../versionSort';
import { WILDCARD_V } from '../hooks/useMeshModelComponents';

// T002 — Versiones preliminares («-rc.1», «-beta»…).
describe('T002 · versiones preliminares', () => {
  it('una versión preliminar es menor que la misma versión final', () => {
    expect(versionSortComparatorFn('1.2.0-rc.1', '1.2.0')).toBeLessThan(0);
    expect(versionSortComparatorFn('1.2.0', '1.2.0-rc.1')).toBeGreaterThan(0);
  });

  it('primero se compara la parte numérica', () => {
    expect(versionSortComparatorFn('1.3.0-alpha', '1.2.0')).toBeGreaterThan(0);
    expect(versionSortComparatorFn('v2.0.0-beta.1', '1.9.9')).toBeGreaterThan(0);
    expect(versionSortComparatorFn('1.2.0', '1.3.0-alpha')).toBeLessThan(0);
  });

  it('entre preliminares se comparan sus identificadores', () => {
    expect(versionSortComparatorFn('1.0.0-alpha', '1.0.0-beta')).toBeLessThan(0);
    expect(versionSortComparatorFn('1.0.0-rc.2', '1.0.0-rc.10')).toBeLessThan(0);
    expect(versionSortComparatorFn('1.0.0-rc', '1.0.0-rc.1')).toBeLessThan(0);
    expect(versionSortComparatorFn('1.0.0-rc.1', '1.0.0-rc.1')).toBe(0);
  });

  it('los segmentos que faltan siguen contando como 0', () => {
    expect(versionSortComparatorFn('1.2-rc.1', '1.2.0')).toBeLessThan(0);
    expect(versionSortComparatorFn('1.2-rc.1', '1.2.0-rc.1')).toBe(0);
  });

  it('la ordenación decreciente coloca las preliminares bajo su versión final', () => {
    expect(sortByVersionInDecreasingOrder(['1.0.0-rc.1', '1.0.0', '0.9.0', '1.0.0-beta'])).toEqual([
      WILDCARD_V,
      '1.0.0',
      '1.0.0-rc.1',
      '1.0.0-beta',
      '0.9.0',
    ]);
  });
});
