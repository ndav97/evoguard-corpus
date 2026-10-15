// Tests ocultos del estudio.
import { sort, SortDirection, type SortCriterion } from 'routes/utils/sort';

type Row = { id: string; cost?: number; project?: string; region?: string };
const ids = (rows: Row[]) => rows.map(r => r.id);

// T004 — Desempates.
describe('T004 · thenBy', () => {
  const rows: Row[] = [
    { id: 'a', cost: 5, project: 'beta', region: 'us' },
    { id: 'b', cost: 9, project: 'alpha', region: 'eu' },
    { id: 'c', cost: 5, project: 'alpha', region: 'us' },
    { id: 'd', cost: 5, project: 'alpha', region: 'eu' },
    { id: 'e', project: 'zeta' },
    { id: 'f', project: 'eta' },
  ];

  it('desempata con el primer criterio y luego con el segundo', () => {
    const thenBy: SortCriterion<Row>[] = [
      { key: 'project', direction: SortDirection.desc },
      { key: r => r.region, direction: SortDirection.desc },
    ];
    expect(ids(sort(rows, { key: 'cost', direction: SortDirection.desc, thenBy }))).toEqual(['d', 'c', 'a', 'b', 'f', 'e']);
  });

  it('la dirección del criterio es asc por defecto, con su sentido de siempre', () => {
    expect(ids(sort(rows, { key: 'cost', thenBy: [{ key: 'project' }] }))).toEqual(['b', 'a', 'c', 'd', 'e', 'f']);
  });

  it('si empatan en todo conservan el orden de entrada', () => {
    expect(ids(sort(rows, { key: 'cost', direction: SortDirection.desc, thenBy: [{ key: 'region', direction: SortDirection.desc }] }))).toEqual([
      'd',
      'a',
      'c',
      'b',
      'e',
      'f',
    ]);
  });

  it('los ausentes del criterio van al final de su grupo', () => {
    const more: Row[] = [
      { id: 'x', cost: 1 },
      { id: 'y', cost: 1, project: 'b' },
      { id: 'z', cost: 1, project: 'a' },
    ];
    expect(ids(sort(more, { key: 'cost', thenBy: [{ key: 'project', direction: SortDirection.desc }] }))).toEqual(['z', 'y', 'x']);
  });

  it('natural se aplica también al desempate', () => {
    const nodes: Row[] = [
      { id: 'n10', cost: 1, project: 'node-10' },
      { id: 'n2', cost: 1, project: 'Node-2' },
    ];
    expect(ids(sort(nodes, { key: 'cost', natural: true, thenBy: [{ key: 'project', direction: SortDirection.desc }] }))).toEqual([
      'n2',
      'n10',
    ]);
  });

  it('sin thenBy todo sigue igual', () => {
    expect(ids(sort(rows, { key: 'cost', direction: SortDirection.desc }))).toEqual(['a', 'c', 'd', 'b', 'e', 'f']);
  });
});
