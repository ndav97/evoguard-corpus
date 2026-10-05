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

// T005 — Varios valores separados por comas.
describe('T005 · lista de valores separados por comas', () => {
  it('Enter añade cada valor de la lista y vacía el campo', async () => {
    render(<HealthTypeaheadFilter {...props} />);
    await focus();
    await type('my-app, openshift-*');
    await press('Enter');

    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(props.onChange).toHaveBeenCalledWith(['my-app', 'openshift-*']);
    expect(input().value).toBe('');
  });

  it('omite los valores ya seleccionados, los repetidos y los huecos vacíos', async () => {
    render(<HealthTypeaheadFilter {...props} selected={['my-app']} />);
    await focus();
    await type('my-app,openshift-dns, ,openshift-dns,"kube-system"');
    await press('Enter');

    expect(props.onChange).toHaveBeenCalledWith(['my-app', 'openshift-dns', '"kube-system"']);
  });

  it('si no hay ningún valor nuevo no se añade nada y el texto se conserva', async () => {
    render(<HealthTypeaheadFilter {...props} selected={['my-app']} />);
    await focus();
    await type('my-app, my-app');
    await press('Enter');

    expect(props.onChange).not.toHaveBeenCalled();
    expect(input().value).toBe('my-app, my-app');
  });

  it('si algún valor no es válido se marca y no se añade ninguno', async () => {
    render(<HealthTypeaheadFilter {...props} />);
    await focus();
    await type('my-app, bad name!');

    await waitFor(() => {
      expect(screen.getByText('Not a valid Kubernetes name')).toBeInTheDocument();
    });
    await press('Enter');
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('con comas no se sugieren namespaces', async () => {
    render(<HealthTypeaheadFilter {...props} />);
    await focus();
    await type('my-app, openshift');

    await waitFor(() => {
      expect(screen.getByText(/press Enter to filter/i)).toBeInTheDocument();
    });
    expect(screen.queryByText('Not a valid Kubernetes name')).not.toBeInTheDocument();
    expect(option('openshift-dns')).toBeFalsy();
    expect(option('openshift-monitoring')).toBeFalsy();
  });

  it('un único valor sigue funcionando igual', async () => {
    render(<HealthTypeaheadFilter {...props} selected={['openshift-dns']} />);
    await focus();
    await type('my-app');
    await press('Enter');

    expect(props.onChange).toHaveBeenCalledWith(['openshift-dns', 'my-app']);
  });
});
