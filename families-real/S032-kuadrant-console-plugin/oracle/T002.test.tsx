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

const data = [item('gateway-a', 'prod', 'api.example.com'), item('gateway-b', 'dev', 'test.example.com'), item('route-c', 'prod')];
const filtered = (filterText: string, filterFields: string[] = ['metadata.name', 'spec.host']) =>
  render(
    <KuadrantDataView
      ariaLabel="Items"
      columns={columns}
      data={data}
      loaded
      getRow={getRow}
      filterText={filterText}
      filterFields={filterFields}
      emptyMessage="Nothing yet"
    />,
  );

// T002 — Filtrar por texto.
describe('T002 · filterText', () => {
  it('muestra solo los elementos cuyo campo contiene el texto, sin distinguir mayúsculas', () => {
    filtered('GATEWAY');
    expect(names()).toEqual(['gateway-a', 'gateway-b']);
  });

  it('busca en todos los campos indicados, incluidos los anidados', () => {
    filtered('test.example');
    expect(names()).toEqual(['gateway-b']);
  });

  it('ignora los espacios y un texto vacío no filtra', () => {
    const { unmount } = filtered('   ');
    expect(names()).toHaveLength(3);
    unmount();
    filtered('  route  ');
    expect(names()).toEqual(['route-c']);
  });

  it('sin filterFields no filtra', () => {
    render(<KuadrantDataView ariaLabel="Items" columns={columns} data={data} loaded getRow={getRow} filterText="gateway-a" />);
    expect(names()).toHaveLength(3);
  });

  it('sin coincidencias muestra un aviso propio, no emptyMessage', () => {
    filtered('nothing-matches');
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByRole('cell', { name: 'No resources match the filter' })).toBeInTheDocument();
    expect(screen.queryByText('Nothing yet')).not.toBeInTheDocument();
  });

  it('se filtra antes de ordenar y paginar', () => {
    render(
      <KuadrantDataView
        ariaLabel="Items"
        columns={columns}
        data={[item('zeta-gw'), item('alpha'), item('beta-gw'), item('gamma-gw')]}
        loaded
        getRow={getRow}
        filterText="gw"
        filterFields={['metadata.name']}
        page={1}
        perPage={2}
      />,
    );
    expect(names()).toEqual(['beta-gw', 'gamma-gw']);
  });
});
