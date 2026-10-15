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

// T005 — Avisar de los cambios de orden.
describe('T005 · onSortChange', () => {
  it('se llama con la columna y la nueva dirección al ordenar', () => {
    const onSortChange = jest.fn();
    render(<KuadrantDataView ariaLabel="Items" columns={columns} data={data} loaded getRow={getRow} onSortChange={onSortChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(onSortChange).toHaveBeenLastCalledWith('name', 'desc');
    fireEvent.click(screen.getByRole('button', { name: 'Namespace' }));
    expect(onSortChange).toHaveBeenLastCalledWith('namespace', 'asc');
    expect(onSortChange).toHaveBeenCalledTimes(2);
  });

  it('no se llama al montar, tampoco con un orden en la URL o por defecto', () => {
    window.history.replaceState({}, '', '/?KuadrantDataViewTable.sortBy=name&KuadrantDataViewTable.orderBy=desc');
    const onSortChange = jest.fn();
    render(
      <KuadrantDataView
        ariaLabel="Items"
        columns={columns}
        data={data}
        loaded
        getRow={getRow}
        defaultSort={{ columnId: 'namespace' }}
        onSortChange={onSortChange}
      />,
    );
    expect(onSortChange).not.toHaveBeenCalled();
  });

  it('el orden y la URL se actualizan igual que antes', () => {
    const onSortChange = jest.fn();
    render(<KuadrantDataView ariaLabel="Items" columns={columns} data={data} loaded getRow={getRow} onSortChange={onSortChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(names()).toEqual(['charlie', 'bravo', 'alpha']);
    const params = new URLSearchParams(window.location.search);
    expect(params.get('KuadrantDataViewTable.sortBy')).toBe('name');
    expect(params.get('KuadrantDataViewTable.orderBy')).toBe('desc');
  });

  it('sin onSortChange ordenar sigue funcionando', () => {
    render(<KuadrantDataView ariaLabel="Items" columns={columns} data={data} loaded getRow={getRow} />);
    fireEvent.click(screen.getByRole('button', { name: 'Namespace' }));
    expect(names()).toEqual(['bravo', 'charlie', 'alpha']);
  });
});
