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

const pickUser = (value) => fireEvent.change(screen.getByLabelText('Uploaded by'), { target: { value } });

// T002 — Filtro «Uploaded by».
describe('T002 · filtro por usuario', () => {
  it('ofrece «All users» y cada usuario una vez, en orden alfabético', () => {
    renderTable();
    const select = screen.getByLabelText('Uploaded by');
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['All users', 'alice', 'bob', 'carol']);
    expect(select).toHaveValue('');
  });

  it('muestra solo las cargas del usuario elegido', () => {
    renderTable();
    pickUser('alice');
    expect(rows()).toEqual(['midterm-grades.csvalice', 'quiz1.csvalice']);
    expect(screen.getByText('Showing 2 of 4 uploads')).toBeInTheDocument();
  });

  it('se combina con la búsqueda', () => {
    renderTable();
    typeSearch('grades');
    pickUser('alice');
    expect(rows()).toEqual(['midterm-grades.csvalice']);
    expect(screen.getByText('Showing 1 of 4 uploads')).toBeInTheDocument();
  });

  it('sin coincidencias muestra el aviso', () => {
    renderTable();
    pickUser('bob');
    typeSearch('quiz');
    expect(screen.getByText('No uploads match your search.')).toBeInTheDocument();
    expect(screen.getByText('Showing 0 of 4 uploads')).toBeInTheDocument();
  });

  it('volver a «All users» conserva solo el filtro de búsqueda', () => {
    renderTable();
    typeSearch('grades');
    pickUser('bob');
    pickUser('');
    expect(rows()).toEqual(['midterm-grades.csvalice', 'final-grades.csvbob']);
  });
});
