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

// T001 — Búsqueda en el historial de cargas y resumen de resultados.
describe('T001 · búsqueda y resumen del historial', () => {
  it('muestra el total sin búsqueda', () => {
    renderTable();
    expect(screen.getByText('Showing 4 of 4 uploads')).toBeInTheDocument();
    expect(rows()).toHaveLength(4);
  });

  it('usa singular con una sola carga', () => {
    renderTable([entry('one.csv', 'dave', 1)]);
    expect(screen.getByText('Showing 1 of 1 upload')).toBeInTheDocument();
  });

  it('sin cargas no muestra resumen y mantiene la tabla vacía', () => {
    renderTable([]);
    expect(screen.queryByText(/^Showing \d+ of \d+ uploads?$/)).not.toBeInTheDocument();
    expect(screen.getByTestId('data-table')).toHaveAttribute('data-item-count', '0');
  });

  it('filtra por nombre de archivo sin distinguir mayúsculas', () => {
    renderTable();
    typeSearch('MIDTERM');
    expect(rows()).toEqual(['midterm-grades.csvalice', 'Midterm-retake.csvcarol']);
    expect(screen.getByTestId('data-table')).toHaveAttribute('data-item-count', '2');
    expect(screen.getByText('Showing 2 of 4 uploads')).toBeInTheDocument();
  });

  it('filtra también por usuario', () => {
    renderTable();
    typeSearch('bob');
    expect(rows()).toEqual(['final-grades.csvbob']);
  });

  it('ignora los espacios al principio y al final', () => {
    renderTable();
    typeSearch('   quiz1  ');
    expect(rows()).toEqual(['quiz1.csvalice']);
    expect(screen.getByText('Showing 1 of 4 uploads')).toBeInTheDocument();
  });

  it('sin coincidencias muestra un aviso en lugar de la tabla', () => {
    renderTable();
    typeSearch('zzz');
    expect(screen.getByText('No uploads match your search.')).toBeInTheDocument();
    expect(screen.queryByTestId('data-table')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 0 of 4 uploads')).toBeInTheDocument();
  });

  it('al vaciar la búsqueda vuelven todas las cargas', () => {
    renderTable();
    typeSearch('zzz');
    typeSearch('');
    expect(rows()).toHaveLength(4);
    expect(screen.queryByText('No uploads match your search.')).not.toBeInTheDocument();
  });
});
