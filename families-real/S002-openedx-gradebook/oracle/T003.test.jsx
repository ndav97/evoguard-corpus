import { screen, fireEvent, within } from '@testing-library/react';
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

// T003 — Clic en el usuario de una fila para filtrar por él.
describe('T003 · filtrar desde la columna de usuario', () => {
  it('el usuario de cada fila es un botón con nombre accesible y el mismo texto visible', () => {
    renderTable();
    const buttons = screen.getAllByRole('button', { name: 'Show uploads by alice' });
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveTextContent(/^alice$/);
    expect(buttons[0]).toHaveClass('wrap-text-in-cell');
  });

  it('al pulsarlo filtra por ese usuario y actualiza el selector', () => {
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: 'Show uploads by carol' }));
    expect(uploaderSelect()).toHaveValue('carol');
    expect(rows()).toEqual(['Midterm-retake.csvcarol']);
    expect(screen.getByText('Showing 1 of 4 uploads')).toBeInTheDocument();
  });

  it('conserva la búsqueda activa', () => {
    renderTable();
    typeSearch('grades');
    fireEvent.click(screen.getByRole('button', { name: 'Show uploads by alice' }));
    expect(screen.getByLabelText('Search uploads')).toHaveValue('grades');
    expect(rows()).toEqual(['midterm-grades.csvalice']);
  });

  it('elegir «All users» después deshace el filtro', () => {
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: 'Show uploads by bob' }));
    fireEvent.change(uploaderSelect(), { target: { value: '' } });
    expect(rows()).toHaveLength(4);
  });
});
