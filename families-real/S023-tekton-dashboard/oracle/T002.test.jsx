// Tests ocultos del estudio.
import { fireEvent, screen } from '@testing-library/react';

import LabelFilter from '../../packages/components/src/components/LabelFilter';
import { render } from '../../packages/components/src/utils/test';

const DUPLICATE = /no duplicate filters allowed/i;

function submitFilter(value) {
  fireEvent.change(screen.getByPlaceholderText(/input a label filter/i), {
    target: { value }
  });
  fireEvent.submit(screen.getByText(/Input a label filter/i));
}

// T002 — Filtros repetidos en una lista.
describe('T002 · filtros ya aplicados en una lista', () => {
  it('añade solo los filtros nuevos cuando el repetido va al final', () => {
    const handleAddFilter = vi.fn();
    render(
      <LabelFilter filters={['app=test']} handleAddFilter={handleAddFilter} />
    );
    submitFilter('env:dev,app:test');
    expect(handleAddFilter).toHaveBeenCalledTimes(1);
    expect(handleAddFilter).toHaveBeenCalledWith(['app=test', 'env=dev']);
  });

  it('añade los filtros nuevos aunque el primero ya esté aplicado', () => {
    const handleAddFilter = vi.fn();
    render(
      <LabelFilter filters={['app=test']} handleAddFilter={handleAddFilter} />
    );
    submitFilter('app:test,env:dev,tier:web');
    expect(handleAddFilter).toHaveBeenCalledWith([
      'app=test',
      'env=dev',
      'tier=web'
    ]);
    expect(screen.queryByText(DUPLICATE)).toBeNull();
    expect(screen.getByPlaceholderText(/input a label filter/i).value).toBe('');
  });

  it('muestra el aviso de duplicado si todos los filtros ya están aplicados', () => {
    const handleAddFilter = vi.fn();
    render(
      <LabelFilter
        filters={['app=test', 'env=dev']}
        handleAddFilter={handleAddFilter}
      />
    );
    submitFilter('env:dev,app:test');
    expect(handleAddFilter).not.toHaveBeenCalled();
    expect(screen.getByText(DUPLICATE)).toBeTruthy();
  });

  it('no repite un filtro escrito dos veces', () => {
    const handleAddFilter = vi.fn();
    render(
      <LabelFilter filters={['app=test']} handleAddFilter={handleAddFilter} />
    );
    submitFilter('env:dev,env:dev,app:test');
    expect(handleAddFilter).toHaveBeenCalledWith(['app=test', 'env=dev']);
  });
});
