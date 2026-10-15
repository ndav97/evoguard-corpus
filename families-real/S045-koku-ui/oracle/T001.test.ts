// Tests ocultos del estudio.
import { sort, SortDirection } from 'routes/utils/sort';

type Row = { id: string; cost?: number | null };
const ids = (rows: Row[]) => rows.map(r => r.id);

// T001 — Valores ausentes al final.
describe('T001 · valores ausentes', () => {
  const rows: Row[] = [
    { id: 'a', cost: 2 },
    { id: 'b' },
    { id: 'c', cost: 5 },
    { id: 'd', cost: null },
    { id: 'e', cost: 1 },
    { id: 'f', cost: NaN },
  ];

  it('mantiene el orden actual de asc y deja los ausentes al final', () => {
    expect(ids(sort(rows, { key: 'cost', direction: SortDirection.asc }))).toEqual(['c', 'a', 'e', 'b', 'd', 'f']);
  });

  it('mantiene el orden actual de desc y deja los ausentes al final', () => {
    expect(ids(sort(rows, { key: 'cost', direction: SortDirection.desc }))).toEqual(['e', 'a', 'c', 'b', 'd', 'f']);
  });

  it('sin dirección se comporta como asc', () => {
    expect(ids(sort(rows, { key: 'cost' }))).toEqual(['c', 'a', 'e', 'b', 'd', 'f']);
  });

  it('no modifica el array de entrada', () => {
    const copy = [...rows];
    sort(rows, { key: 'cost' });
    expect(rows).toEqual(copy);
  });

  it('el cero no cuenta como ausente', () => {
    const zero: Row[] = [{ id: 'x' }, { id: 'y', cost: 0 }, { id: 'z', cost: -1 }];
    expect(ids(sort(zero, { key: 'cost', direction: SortDirection.desc }))).toEqual(['z', 'y', 'x']);
  });

  it('los textos siguen ordenándose como antes', () => {
    expect(sort(['b', 'c', 'a'], { direction: SortDirection.desc })).toEqual(['a', 'b', 'c']);
    expect(sort(['b', 'c', 'a'], {})).toEqual(['c', 'b', 'a']);
  });
});
