// Tests ocultos del estudio.
import * as React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

const data = [item('bravo', 'ns-a'), item('alpha', 'ns-c'), item('charlie', 'ns-b')];

// T003 — Orden inicial configurable.
describe('T003 · defaultSort', () => {
  it('sin defaultSort se ordena por la primera columna ordenable, como antes', () => {
    render(<KuadrantDataView ariaLabel="Items" columns={columns} data={data} loaded getRow={getRow} />);
    expect(names()).toEqual(['alpha', 'bravo', 'charlie']);
  });

  it('usa la columna y la dirección indicadas', () => {
    render(
      <KuadrantDataView
        ariaLabel="Items"
        columns={columns}
        data={data}
        loaded
        getRow={getRow}
        defaultSort={{ columnId: 'namespace', direction: 'desc' }}
      />,
    );
    expect(names()).toEqual(['alpha', 'charlie', 'bravo']);
  });

  it('sin dirección es ascendente', () => {
    render(
      <KuadrantDataView ariaLabel="Items" columns={columns} data={data} loaded getRow={getRow} defaultSort={{ columnId: 'namespace' }} />,
    );
    expect(names()).toEqual(['bravo', 'charlie', 'alpha']);
  });

  it('el orden de la URL tiene prioridad', () => {
    window.history.replaceState({}, '', '/?KuadrantDataViewTable.sortBy=name&KuadrantDataViewTable.orderBy=desc');
    render(
      <KuadrantDataView
        ariaLabel="Items"
        columns={columns}
        data={data}
        loaded
        getRow={getRow}
        defaultSort={{ columnId: 'namespace' }}
      />,
    );
    expect(names()).toEqual(['charlie', 'bravo', 'alpha']);
  });

  it('con una columna desconocida en la URL se usa defaultSort', () => {
    window.history.replaceState({}, '', '/?KuadrantDataViewTable.sortBy=missing');
    render(
      <KuadrantDataView ariaLabel="Items" columns={columns} data={data} loaded getRow={getRow} defaultSort={{ columnId: 'namespace' }} />,
    );
    expect(names()).toEqual(['bravo', 'charlie', 'alpha']);
  });

  it('una columna por defecto no ordenable o inexistente se ignora', () => {
    const withActions: KuadrantDataViewColumn<Item>[] = [...columns, { id: 'actions', title: 'Actions' }];
    render(
      <KuadrantDataView
        ariaLabel="Items"
        columns={withActions}
        data={data}
        loaded
        getRow={(it) => [...getRow(it), 'x']}
        defaultSort={{ columnId: 'actions', direction: 'desc' }}
      />,
    );
    expect(names()).toEqual(['alpha', 'bravo', 'charlie']);
  });

  it('el usuario puede seguir cambiando el orden', () => {
    render(
      <KuadrantDataView ariaLabel="Items" columns={columns} data={data} loaded getRow={getRow} defaultSort={{ columnId: 'namespace' }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Namespace' }));
    expect(names()).toEqual(['alpha', 'charlie', 'bravo']);
  });
});
