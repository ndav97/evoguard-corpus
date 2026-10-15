// Tests ocultos del estudio.
import { sort, SortDirection, type SortKeyFn } from 'routes/utils/sort';

type Row = { id: string; cost?: { total?: { value?: number } } };
const ids = (rows: Row[]) => rows.map(r => r.id);
const total: SortKeyFn<Row> = row => row.cost?.total?.value;

// T002 — Clave como función.
describe('T002 · key como función', () => {
  const rows: Row[] = [
    { id: 'a', cost: { total: { value: 10 } } },
    { id: 'b', cost: {} },
    { id: 'c', cost: { total: { value: 30 } } },
    { id: 'd', cost: { total: { value: 20 } } },
  ];

  it('ordena por el valor que devuelve la función, con el sentido de siempre', () => {
    expect(ids(sort(rows, { key: total, direction: SortDirection.asc }))).toEqual(['c', 'd', 'a', 'b']);
    expect(ids(sort(rows, { key: total, direction: SortDirection.desc }))).toEqual(['a', 'd', 'c', 'b']);
  });

  it('la función recibe cada elemento', () => {
    const seen: string[] = [];
    sort(rows, {
      key: row => {
        seen.push(row.id);
        return row.id;
      },
    });
    expect([...new Set(seen)].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('funciona con arrays de textos', () => {
    const words = ['b', 'aaa', 'cc'];
    expect(sort(words, { key: (w: string) => w.length, direction: SortDirection.desc })).toEqual(['b', 'cc', 'aaa']);
  });

  it('la clave como nombre de propiedad sigue funcionando', () => {
    const plain = [
      { id: 'x', n: 1 },
      { id: 'y', n: 3 },
      { id: 'z' as string, n: undefined as number | undefined },
    ];
    expect(sort(plain, { key: 'n' }).map(p => p.id)).toEqual(['y', 'x', 'z']);
  });
});
