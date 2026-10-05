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

// T004 — Escape en dos pasos.
describe('T004 · Escape cierra y luego borra', () => {
  it('el primer Escape cierra las sugerencias y conserva el texto', async () => {
    render(<HealthTypeaheadFilter {...props} />);
    await focus();
    await type('my');
    expect(input()).toHaveAttribute('aria-expanded', 'true');

    await press('Escape');
    expect(input()).toHaveAttribute('aria-expanded', 'false');
    expect(input().value).toBe('my');
  });

  it('un segundo Escape borra el texto sin tocar los filtros', async () => {
    render(<HealthTypeaheadFilter {...props} selected={['openshift-dns']} />);
    await focus();
    await type('my');
    await press('Escape');
    await press('Escape');

    expect(input().value).toBe('');
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('Escape solo llega a los elementos padre cuando no queda nada que cerrar ni borrar', async () => {
    const onParentKeyDown = jest.fn();
    render(
      <div onKeyDown={e => e.key === 'Escape' && onParentKeyDown()}>
        <HealthTypeaheadFilter {...props} />
      </div>
    );
    await focus();
    await type('my');

    await press('Escape');
    expect(onParentKeyDown).not.toHaveBeenCalled();

    await press('Escape');
    expect(onParentKeyDown).not.toHaveBeenCalled();

    await press('Escape');
    expect(onParentKeyDown).toHaveBeenCalledTimes(1);
  });

  it('al volver a escribir se reabren las sugerencias', async () => {
    render(<HealthTypeaheadFilter {...props} />);
    await focus();
    await type('my');
    await press('Escape');
    await type('my-');

    expect(input()).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => {
      expect(option('my-app')).toBeTruthy();
    });
  });
});
