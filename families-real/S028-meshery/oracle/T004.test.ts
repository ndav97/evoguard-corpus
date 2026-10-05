// Tests ocultos del estudio.
import { describe, expect, it } from 'vitest';
import { sortByVersionInDecreasingOrder, sortAndGroupVersionsInModel } from '../versionSort';
import { WILDCARD_V } from '../hooks/useMeshModelComponents';

// T004 — Sin repetidas ni vacías en la lista ordenada.
describe('T004 · versiones repetidas y vacías', () => {
  it('quita las versiones repetidas', () => {
    expect(sortByVersionInDecreasingOrder(['2.0.0', '1.0.0', '2.0.0'])).toEqual([WILDCARD_V, '2.0.0', '1.0.0']);
  });

  it('una sola versión distinta no lleva comodín', () => {
    expect(sortByVersionInDecreasingOrder(['1.0.0', '1.0.0'])).toEqual(['1.0.0']);
  });

  it('descarta las entradas vacías', () => {
    expect(sortByVersionInDecreasingOrder(['1.0.0', '', null, undefined])).toEqual(['1.0.0']);
    expect(sortByVersionInDecreasingOrder(['', ''])).toEqual([]);
    expect(sortByVersionInDecreasingOrder([])).toEqual([]);
  });

  it('no modifica la lista recibida', () => {
    const input = ['1.0.0', '1.0.0', ''];
    sortByVersionInDecreasingOrder(input);
    expect(input).toEqual(['1.0.0', '1.0.0', '']);
  });

  it('los modelos agrupados no muestran versiones vacías', () => {
    const grouped = sortAndGroupVersionsInModel([
      { name: 'foo', version: '1.0.0' },
      { name: 'foo', version: '' },
      { name: 'bar', version: '0.5.0' },
      { name: 'bar', version: '0.6.0-rc.1' },
    ]);
    expect(grouped.find((m) => m.name === 'foo').version).toEqual(['1.0.0']);
    expect(grouped.find((m) => m.name === 'bar').version).toEqual([WILDCARD_V, '0.6.0-rc.1', '0.5.0']);
  });
});
