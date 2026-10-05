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


// T002 — Aviso de valor ya añadido.
describe('T002 · valor que ya es un filtro', () => {
  it('avisa cuando lo escrito ya está entre los valores seleccionados', async () => {
    render(<HealthTypeaheadFilter {...props} selected={['my-app']} />);
    await focus();
    await type('  my-app ');

    await waitFor(() => {
      expect(screen.getByText('Already added as a filter')).toBeInTheDocument();
    });
    expect(screen.queryByText(/press Enter to filter/i)).not.toBeInTheDocument();
  });

  it('Enter con un valor repetido no lo añade y conserva el texto', async () => {
    render(<HealthTypeaheadFilter {...props} selected={['my-app']} />);
    await focus();
    await type('my-app');
    await press('Enter');

    expect(props.onChange).not.toHaveBeenCalled();
    expect(input().value).toBe('my-app');
  });

  it('un valor nuevo no muestra el aviso, se añade y vacía el campo', async () => {
    render(<HealthTypeaheadFilter {...props} selected={['my-app']} />);
    await focus();
    await type('openshift-dns');

    await waitFor(() => {
      expect(screen.getByText(/press Enter to filter/i)).toBeInTheDocument();
    });
    expect(screen.queryByText('Already added as a filter')).not.toBeInTheDocument();

    await press('Enter');
    expect(props.onChange).toHaveBeenCalledWith(['my-app', 'openshift-dns']);
    expect(input().value).toBe('');
  });

  it('Backspace con el campo vacío sigue quitando el último valor', async () => {
    render(<HealthTypeaheadFilter {...props} selected={['my-app', 'openshift-dns']} />);
    await focus();
    await press('Backspace');

    expect(props.onChange).toHaveBeenCalledWith(['my-app']);
  });
});
