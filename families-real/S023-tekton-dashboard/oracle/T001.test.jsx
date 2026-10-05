// Tests ocultos del estudio.
import { fireEvent, screen } from '@testing-library/react';

import LabelFilter from '../../packages/components/src/components/LabelFilter';
import { render } from '../../packages/components/src/utils/test';

const INVALID = /contain accepted label characters/i;
const TOO_LONG = /contain less than 64 characters/i;

function submitFilter(value) {
  fireEvent.change(screen.getByPlaceholderText(/input a label filter/i), {
    target: { value }
  });
  fireEvent.submit(screen.getByText(/Input a label filter/i));
}

// T001 — Validación completa de cada filtro de la lista.
describe('T001 · validación de cada filtro', () => {
  it('rechaza un filtro con caracteres no permitidos aunque empiece bien', () => {
    const handleAddFilter = vi.fn();
    render(<LabelFilter handleAddFilter={handleAddFilter} />);
    submitFilter('app:test!');
    expect(handleAddFilter).not.toHaveBeenCalled();
    expect(screen.getByText(INVALID)).toBeTruthy();
  });

  it('rechaza la lista si alguna entrada no es labelKey:labelValue', () => {
    const handleAddFilter = vi.fn();
    render(<LabelFilter handleAddFilter={handleAddFilter} />);
    submitFilter('app:test,env');
    expect(handleAddFilter).not.toHaveBeenCalled();
    expect(screen.getByText(INVALID)).toBeTruthy();
  });

  it('comprueba la longitud del valor en todas las entradas', () => {
    const handleAddFilter = vi.fn();
    render(<LabelFilter handleAddFilter={handleAddFilter} />);
    submitFilter(`app:test,env:${'x'.repeat(64)}`);
    expect(handleAddFilter).not.toHaveBeenCalled();
    expect(screen.getByText(TOO_LONG)).toBeTruthy();
  });

  it('acepta un valor de exactamente 63 caracteres en cualquier entrada', () => {
    const handleAddFilter = vi.fn();
    render(<LabelFilter handleAddFilter={handleAddFilter} />);
    submitFilter(`app:test,env:${'x'.repeat(63)}`);
    expect(handleAddFilter).toHaveBeenCalledWith([
      'app=test',
      `env=${'x'.repeat(63)}`
    ]);
  });

  it('ignora las entradas vacías de comas sobrantes', () => {
    const handleAddFilter = vi.fn();
    render(<LabelFilter handleAddFilter={handleAddFilter} />);
    submitFilter('app:test, env:dev,');
    expect(handleAddFilter).toHaveBeenCalledWith(['app=test', 'env=dev']);
    expect(screen.queryByText(INVALID)).toBeNull();
  });

  it('sigue aceptando claves con prefijo y valores con punto, guion y guion bajo', () => {
    const handleAddFilter = vi.fn();
    render(<LabelFilter handleAddFilter={handleAddFilter} />);
    submitFilter('tekton.dev/pipeline:my_pipe-1.0');
    expect(handleAddFilter).toHaveBeenCalledWith([
      'tekton.dev/pipeline=my_pipe-1.0'
    ]);
  });
});
