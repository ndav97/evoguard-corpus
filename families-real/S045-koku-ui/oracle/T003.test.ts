// Tests ocultos del estudio.
import { sort, SortDirection } from 'routes/utils/sort';

// T003 — Orden natural.
describe('T003 · natural', () => {
  const names = ['cluster-10', 'Cluster-2', 'cluster-1', 'cluster-21'];

  it('compara los números del texto por su valor', () => {
    expect(sort(names, { natural: true, direction: SortDirection.desc })).toEqual([
      'cluster-1',
      'Cluster-2',
      'cluster-10',
      'cluster-21',
    ]);
    expect(sort(names, { natural: true, direction: SortDirection.asc })).toEqual([
      'cluster-21',
      'cluster-10',
      'Cluster-2',
      'cluster-1',
    ]);
  });

  it('sin natural la comparación es la de siempre', () => {
    expect(sort(names, { direction: SortDirection.desc })).toEqual(['Cluster-2', 'cluster-1', 'cluster-10', 'cluster-21']);
  });

  it('mayúsculas y acentos empatan y conservan el orden de entrada', () => {
    const words = ['beta', 'Éste', 'Alpha', 'este', 'alpha'];
    expect(sort(words, { natural: true, direction: SortDirection.desc })).toEqual(['Alpha', 'alpha', 'beta', 'Éste', 'este']);
  });

  it('funciona con key y deja los ausentes al final', () => {
    const rows = [
      { id: 1, name: 'node-12' },
      { id: 2, name: undefined as string | undefined },
      { id: 3, name: 'Node-3' },
    ];
    expect(sort(rows, { key: 'name', natural: true, direction: SortDirection.desc }).map(r => r.id)).toEqual([3, 1, 2]);
    expect(sort(rows, { key: r => r.name, natural: true }).map(r => r.id)).toEqual([1, 3, 2]);
  });

  it('si un valor no es texto se compara como siempre', () => {
    const mixed = [{ v: 10 }, { v: 9 }, { v: 100 }];
    expect(sort(mixed, { key: 'v', natural: true, direction: SortDirection.desc }).map(m => m.v)).toEqual([9, 10, 100]);
  });
});
