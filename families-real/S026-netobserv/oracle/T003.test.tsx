// Tests ocultos del estudio.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { HealthTypeaheadFilter } from '../components/health/health-typeahead-filter';

const options = [
  { value: 'openshift-monitoring', label: 'openshift-monitoring' },
  { value: 'openshift-dns', label: 'openshift-dns' },
  { value: 'my-app', label: 'my-app' }
];

const props = {
  id: 'health-namespace-filter',
  toggleLabel: 'Namespace',
  options,
  selected: [] as string[],
  onChange: jest.fn()
};

beforeEach(() => {
  props.onChange.mockClear();
});

const input = () => screen.getByRole('combobox') as HTMLInputElement;

const focus = async () => {
  await act(async () => {
    fireEvent.focus(input());
  });
};

const type = async (value: string) => {
  await act(async () => {
    fireEvent.change(input(), { target: { value } });
  });
};

const press = async (key: string) => {
  await act(async () => {
    fireEvent.keyDown(input(), { key });
  });
};

const option = (value: string) => document.querySelector(`#health-namespace-filter-option-${value}`);

const dnsOptions = ['kube-dns', 'dns-operator', 'openshift-dns', 'dns-default'].map(value => ({ value, label: value }));

// Valores sugeridos (entre los candidatos), en el orden en que aparecen en el documento.
const shownOptions = (candidates: { value: string }[]) =>
  candidates
    .map(c => c.value)
    .filter(value => option(value) !== null)
    .sort((a, b) =>
      option(a)!.compareDocumentPosition(option(b)!) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );

// T003 — Orden de las sugerencias y límite configurable.
describe('T003 · orden de sugerencias y maxSuggestions', () => {
  it('con texto simple, primero los namespaces que empiezan por lo escrito', async () => {
    render(<HealthTypeaheadFilter {...props} options={dnsOptions} />);
    await focus();
    await type('dns');

    await waitFor(() => {
      expect(option('dns-operator')).toBeTruthy();
    });
    expect(shownOptions(dnsOptions)).toEqual(['dns-operator', 'dns-default', 'kube-dns', 'openshift-dns']);
  });

  it('con un patrón con * se mantiene el orden original', async () => {
    render(<HealthTypeaheadFilter {...props} options={dnsOptions} />);
    await focus();
    await type('*dns*');

    await waitFor(() => {
      expect(option('kube-dns')).toBeTruthy();
    });
    expect(shownOptions(dnsOptions)).toEqual(['kube-dns', 'dns-operator', 'openshift-dns', 'dns-default']);
  });

  it('maxSuggestions limita las sugerencias y el resto se cuenta', async () => {
    render(<HealthTypeaheadFilter {...props} options={dnsOptions} maxSuggestions={2} />);
    await focus();
    await type('dns');

    await waitFor(() => {
      expect(option('dns-operator')).toBeTruthy();
    });
    expect(shownOptions(dnsOptions)).toEqual(['dns-operator', 'dns-default']);
    expect(screen.getByText('2 more matching namespaces…')).toBeInTheDocument();
  });

  it('sin maxSuggestions se muestran como máximo 10', async () => {
    const many = Array.from({ length: 12 }, (_, i) => `ns-${String(i + 1).padStart(2, '0')}`).map(value => ({
      value,
      label: value
    }));
    render(<HealthTypeaheadFilter {...props} options={many} />);
    await focus();
    await type('ns');

    await waitFor(() => {
      expect(option('ns-01')).toBeTruthy();
    });
    expect(shownOptions(many)).toHaveLength(10);
    expect(screen.getByText('2 more matching namespaces…')).toBeInTheDocument();
  });

  it('el aviso de valor ya añadido se mantiene', async () => {
    render(<HealthTypeaheadFilter {...props} options={dnsOptions} selected={['kube-dns']} />);
    await focus();
    await type('kube-dns');

    await waitFor(() => {
      expect(screen.getByText('Already added as a filter')).toBeInTheDocument();
    });
  });
});
