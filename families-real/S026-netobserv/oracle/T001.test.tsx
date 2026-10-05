// Tests ocultos del estudio.
import { act, fireEvent, render, screen } from '@testing-library/react';
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


// T001 — Retroceso con el campo vacío.
describe('T001 · Backspace quita el último filtro', () => {
  it('con el campo vacío, Backspace quita el último valor seleccionado', async () => {
    render(<HealthTypeaheadFilter {...props} selected={['openshift-dns', 'my-app']} />);
    await focus();
    await press('Backspace');

    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(props.onChange).toHaveBeenCalledWith(['openshift-dns']);
  });

  it('cada pulsación quita solo un valor', async () => {
    render(<HealthTypeaheadFilter {...props} selected={['a-ns', 'b-ns', 'c-ns']} />);
    await focus();
    await press('Backspace');

    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(props.onChange).toHaveBeenCalledWith(['a-ns', 'b-ns']);
  });

  it('con texto escrito, Backspace no quita filtros', async () => {
    render(<HealthTypeaheadFilter {...props} selected={['openshift-dns']} />);
    await focus();
    await type('my');
    await press('Backspace');

    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('sin valores seleccionados no hace nada', async () => {
    render(<HealthTypeaheadFilter {...props} />);
    await focus();
    await press('Backspace');

    expect(props.onChange).not.toHaveBeenCalled();
  });
});
