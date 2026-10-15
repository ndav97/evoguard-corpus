import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithAllProviders, initializeMocks } from '@src/testUtils';
import { HistoryTable, mapHistoryRows } from '@src/components/BulkManagementHistoryView/HistoryTable';

jest.mock('@openedx/paragon', () => ({
  ...jest.requireActual('@openedx/paragon'),
  DataTable: ({ data, itemCount }) => (
    <div data-testid="data-table" data-item-count={itemCount}>
      {data.map((row, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={i} data-testid="row">{row.filename}{row.user}</div>
      ))}
    </div>
  ),
}));
jest.mock('@src/components/BulkManagementHistoryView/ResultsSummary', () => () => <div>summary</div>);

initializeMocks();

const entry = (file, user, day) => ({
  originalFilename: file,
  user,
  timeUploaded: `2025-01-0${day}T10:00:00Z`,
  resultsSummary: { rowId: day, text: `results ${day}` },
});
const history = [
  entry('midterm-grades.csv', 'alice', 1),
  entry('final-grades.csv', 'bob', 2),
  entry('Midterm-retake.csv', 'carol', 3),
  entry('quiz1.csv', 'alice', 4),
];
const renderTable = (h = history) => renderWithAllProviders(<HistoryTable bulkManagementHistory={h} />);
const rows = () => screen.queryAllByTestId('row').map((r) => r.textContent);
const typeSearch = (value) => fireEvent.change(screen.getByLabelText('Search uploads'), { target: { value } });

const uploaderSelect = () => screen.getByLabelText('Uploaded by');
const sortSelect = () => screen.getByLabelText('Sort by');
const sortBy = (value) => fireEvent.change(sortSelect(), { target: { value } });

// T004 — Ordenar las cargas por fecha.
describe('T004 · ordenar por fecha de carga', () => {
  const unordered = [
    entry('midterm-grades.csv', 'alice', 3),
    entry('final-grades.csv', 'bob', 1),
    entry('Midterm-retake.csv', 'carol', 4),
    entry('quiz1.csv', 'alice', 2),
  ];

  it('ofrece tres opciones y por defecto mantiene el orden recibido', () => {
    renderTable(unordered);
    expect(within(sortSelect()).getAllByRole('option').map((o) => [o.textContent, o.value])).toEqual([
      ['Upload order', ''], ['Newest first', 'newest'], ['Oldest first', 'oldest'],
    ]);
    expect(sortSelect()).toHaveValue('');
    expect(rows()).toEqual(['midterm-grades.csvalice', 'final-grades.csvbob', 'Midterm-retake.csvcarol', 'quiz1.csvalice']);
  });

  it('«Newest first» ordena de la carga más reciente a la más antigua', () => {
    renderTable(unordered);
    sortBy('newest');
    expect(rows()).toEqual(['Midterm-retake.csvcarol', 'midterm-grades.csvalice', 'quiz1.csvalice', 'final-grades.csvbob']);
  });

  it('«Oldest first» ordena de la más antigua a la más reciente', () => {
    renderTable(unordered);
    sortBy('oldest');
    expect(rows()).toEqual(['final-grades.csvbob', 'quiz1.csvalice', 'midterm-grades.csvalice', 'Midterm-retake.csvcarol']);
  });

  it('con la misma fecha conserva el orden recibido', () => {
    renderTable([entry('a.csv', 'bob', 2), entry('b.csv', 'carol', 2), entry('c.csv', 'alice', 1)]);
    sortBy('newest');
    expect(rows()).toEqual(['a.csvbob', 'b.csvcarol', 'c.csvalice']);
    sortBy('oldest');
    expect(rows()).toEqual(['c.csvalice', 'a.csvbob', 'b.csvcarol']);
  });

  it('se combina con la búsqueda y el usuario sin cambiar el resumen', () => {
    renderTable(unordered);
    sortBy('newest');
    fireEvent.change(uploaderSelect(), { target: { value: 'alice' } });
    expect(rows()).toEqual(['midterm-grades.csvalice', 'quiz1.csvalice']);
    typeSearch('MIDTERM');
    fireEvent.change(uploaderSelect(), { target: { value: '' } });
    expect(rows()).toEqual(['Midterm-retake.csvcarol', 'midterm-grades.csvalice']);
    expect(screen.getByText('Showing 2 of 4 uploads')).toBeInTheDocument();
    expect(screen.getByTestId('data-table')).toHaveAttribute('data-item-count', '2');
  });

  it('volver a «Upload order» restablece el orden recibido', () => {
    renderTable(unordered);
    sortBy('oldest');
    sortBy('');
    expect(rows()).toEqual(['midterm-grades.csvalice', 'final-grades.csvbob', 'Midterm-retake.csvcarol', 'quiz1.csvalice']);
  });
});
