import { screen, fireEvent } from '@testing-library/react';
import { renderWithAllProviders, initializeMocks } from '@src/testUtils';
import { HistoryTable } from '@src/components/BulkManagementHistoryView/HistoryTable';

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
const clearButton = () => screen.queryByRole('button', { name: 'Clear filters' });

// T005 — Botón para quitar la búsqueda y el filtro de usuario.
describe('T005 · «Clear filters»', () => {
  it('no aparece sin filtros activos', () => {
    renderTable();
    expect(clearButton()).not.toBeInTheDocument();
  });

  it('aparece con texto en la búsqueda o con un usuario elegido', () => {
    renderTable();
    typeSearch('quiz');
    expect(clearButton()).toBeInTheDocument();
    typeSearch('');
    expect(clearButton()).not.toBeInTheDocument();
    fireEvent.change(uploaderSelect(), { target: { value: 'bob' } });
    expect(clearButton()).toBeInTheDocument();
  });

  it('el orden elegido no cuenta como filtro', () => {
    renderTable();
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'oldest' } });
    expect(clearButton()).not.toBeInTheDocument();
  });

  it('al pulsarlo vacía la búsqueda, vuelve a «All users» y muestra todas las cargas', () => {
    renderTable();
    typeSearch('grades');
    fireEvent.change(uploaderSelect(), { target: { value: 'alice' } });
    expect(rows()).toEqual(['midterm-grades.csvalice']);
    fireEvent.click(clearButton());
    expect(screen.getByLabelText('Search uploads')).toHaveValue('');
    expect(uploaderSelect()).toHaveValue('');
    expect(rows()).toHaveLength(4);
    expect(screen.getByText('Showing 4 of 4 uploads')).toBeInTheDocument();
    expect(clearButton()).not.toBeInTheDocument();
  });

  it('sirve también cuando ninguna carga coincide y conserva el orden', () => {
    renderTable();
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'newest' } });
    typeSearch('zzz');
    expect(screen.getByText('No uploads match your search.')).toBeInTheDocument();
    fireEvent.click(clearButton());
    expect(screen.queryByText('No uploads match your search.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Sort by')).toHaveValue('newest');
    expect(rows()[0]).toBe('quiz1.csvalice');
  });

  it('el filtro desde la columna de usuario hace aparecer el botón', () => {
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: 'Show uploads by bob' }));
    fireEvent.click(clearButton());
    expect(uploaderSelect()).toHaveValue('');
    expect(rows()).toHaveLength(4);
  });
});
