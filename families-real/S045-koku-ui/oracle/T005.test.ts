// Tests ocultos del estudio.
import { sort, SortDirection } from 'routes/utils/sort';

// T005 — Fechas.
describe('T005 · fechas', () => {
  it('las fechas inválidas van al final', () => {
    const rows = [
      { id: 'bad', date: new Date('not a date') },
      { id: 'jan', date: new Date('2026-01-15T00:00:00Z') },
      { id: 'mar', date: new Date('2026-03-01T00:00:00Z') },
    ];
    expect(sort(rows, { key: 'date', direction: SortDirection.desc }).map(r => r.id)).toEqual(['jan', 'mar', 'bad']);
    expect(sort(rows, { key: 'date' }).map(r => r.id)).toEqual(['mar', 'jan', 'bad']);
  });

  it('con dates compara los textos como fechas', () => {
    const days = ['2026-02-03', '2025-12-31', 'mañana', '2026-01-10'];
    expect(sort(days, { dates: true, direction: SortDirection.desc })).toEqual([
      '2025-12-31',
      '2026-01-10',
      '2026-02-03',
      'mañana',
    ]);
    expect(sort(days, { dates: true })).toEqual(['2026-02-03', '2026-01-10', '2025-12-31', 'mañana']);
  });

  it('sin dates los textos se comparan como texto', () => {
    const days = ['2026-2-3', '2026-10-01'];
    expect(sort(days, { direction: SortDirection.desc })).toEqual(['2026-10-01', '2026-2-3']);
    expect(sort(days, { dates: true, direction: SortDirection.desc })).toEqual(['2026-2-3', '2026-10-01']);
  });

  it('se aplica también al desempate y tiene prioridad sobre natural', () => {
    const rows = [
      { id: 'a', cost: 1, day: '2026-1-20' },
      { id: 'b', cost: 1, day: '2026-1-3' },
      { id: 'c', cost: 1, day: 'nunca' },
    ];
    expect(
      sort(rows, {
        key: 'cost',
        dates: true,
        natural: true,
        thenBy: [{ key: 'day', direction: SortDirection.desc }],
      }).map(r => r.id)
    ).toEqual(['b', 'a', 'c']);
  });

  it('los números siguen como siempre', () => {
    expect(sort([{ v: 2 }, { v: 3 }], { key: 'v', dates: true }).map(r => r.v)).toEqual([3, 2]);
  });
});
