// Tests ocultos del estudio.
import * as React from 'react';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import KuadrantDataView, { KuadrantDataViewColumn } from '../components/KuadrantDataView';

type Item = { metadata: { name: string; namespace?: string }; spec?: { host?: string } };

const columns: KuadrantDataViewColumn<Item>[] = [
  { id: 'name', title: 'Name', sort: 'metadata.name' },
  { id: 'namespace', title: 'Namespace', sort: 'metadata.namespace' },
];
const item = (name: string, namespace = 'default', host?: string): Item => ({
  metadata: { name, namespace },
  ...(host ? { spec: { host } } : {}),
});
const getRow = (it: Item) => [it.metadata.name, it.metadata.namespace ?? ''];
const bodyRows = () => within(screen.getByRole('grid')).getAllByRole('row').slice(1);
const names = () => bodyRows().map((row) => within(row).getAllByRole('cell')[0].textContent);

afterEach(() => window.history.replaceState({}, '', '/'));

// T001 — Mensaje cuando no hay recursos.
describe('T001 · emptyMessage', () => {
  it('sin elementos y ya cargada, muestra el mensaje en una fila', () => {
    render(<KuadrantDataView ariaLabel="Items" columns={columns} data={[]} loaded getRow={getRow} emptyMessage="No policies found" />);
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByRole('cell', { name: 'No policies found' })).toBeInTheDocument();
  });

  it('sin emptyMessage la tabla vacía no cambia', () => {
    render(<KuadrantDataView ariaLabel="Items" columns={columns} data={[]} loaded getRow={getRow} />);
    expect(screen.getAllByRole('row')).toHaveLength(1);
  });

  it('mientras carga o con error no se muestra el mensaje', () => {
    const { rerender } = render(
      <KuadrantDataView ariaLabel="Items" columns={columns} data={[]} loaded={false} getRow={getRow} emptyMessage="No policies found" />,
    );
    expect(screen.queryByText('No policies found')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Loading' })).toBeInTheDocument();
    rerender(
      <KuadrantDataView
        ariaLabel="Items"
        columns={columns}
        data={[]}
        loaded
        loadError={new Error('Forbidden')}
        getRow={getRow}
        emptyMessage="No policies found"
      />,
    );
    expect(screen.queryByText('No policies found')).not.toBeInTheDocument();
    expect(screen.getByText('Forbidden')).toBeInTheDocument();
  });

  it('con elementos se muestran las filas, no el mensaje', () => {
    render(<KuadrantDataView ariaLabel="Items" columns={columns} data={[item('alpha')]} loaded getRow={getRow} emptyMessage="No policies found" />);
    expect(names()).toEqual(['alpha']);
    expect(screen.queryByText('No policies found')).not.toBeInTheDocument();
  });
});
