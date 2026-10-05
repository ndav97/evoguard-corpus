// Tests ocultos del estudio.
import { fireEvent, screen } from '@testing-library/react';

import LabelFilter from '../../packages/components/src/components/LabelFilter';
import { render } from '../../packages/components/src/utils/test';

const input = () => screen.getByPlaceholderText(/input a label filter/i);
const status = () => screen.getByRole('status');

function submitFilter(value) {
  fireEvent.change(input(), { target: { value } });
  fireEvent.submit(screen.getByText(/Input a label filter/i));
}

// T004 — Anunciar los filtros añadidos.
describe('T004 · anuncio de filtros añadidos', () => {
  it('la región de estado existe vacía desde el principio', () => {
    render(<LabelFilter handleAddFilter={vi.fn()} />);
    expect(status().textContent).toBe('');
  });

  it('anuncia un filtro añadido en singular', () => {
    render(<LabelFilter handleAddFilter={vi.fn()} />);
    submitFilter('app:test');
    expect(status().textContent).toBe('Added 1 label filter');
  });

  it('anuncia varios filtros añadidos en plural', () => {
    render(<LabelFilter handleAddFilter={vi.fn()} />);
    submitFilter('app:test,env:dev,env:dev,tier:web');
    expect(status().textContent).toBe('Added 3 label filters');
  });

  it('indica cuántos filtros ya estaban aplicados', () => {
    render(
      <LabelFilter
        filters={['app=test', 'env=dev']}
        handleAddFilter={vi.fn()}
      />
    );
    submitFilter('app:test,tier:web,env:dev');
    expect(status().textContent).toBe('Added 1 label filter, 2 already applied');
  });

  it('vacía el anuncio cuando se muestra un error', () => {
    render(<LabelFilter filters={['app=test']} handleAddFilter={vi.fn()} />);
    submitFilter('env:dev');
    expect(status().textContent).toBe('Added 1 label filter');
    submitFilter('app:test');
    expect(screen.getByText(/no duplicate filters allowed/i)).toBeTruthy();
    expect(status().textContent).toBe('');
  });
});
