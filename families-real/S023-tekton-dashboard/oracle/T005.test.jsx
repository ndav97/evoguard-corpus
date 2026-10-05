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

// T005 — Anunciar las eliminaciones y limpiar el campo con «Clear all».
describe('T005 · eliminar filtros', () => {
  it('anuncia el filtro eliminado con su texto visible', () => {
    const handleDeleteFilter = vi.fn();
    render(
      <LabelFilter
        filters={['tekton.dev/pipeline=demo', 'app=test']}
        handleDeleteFilter={handleDeleteFilter}
      />
    );
    fireEvent.click(
      screen.getByLabelText('Remove tekton.dev/pipeline:demo label filter')
    );
    expect(handleDeleteFilter).toHaveBeenCalledWith('tekton.dev/pipeline=demo');
    expect(status().textContent).toBe(
      'Removed label filter tekton.dev/pipeline:demo'
    );
  });

  it('anuncia que se han quitado todos los filtros', () => {
    const handleClearFilters = vi.fn();
    render(
      <LabelFilter
        filters={['app=test', 'env=dev']}
        handleClearFilters={handleClearFilters}
      />
    );
    fireEvent.click(screen.getByText(/clear all/i));
    expect(handleClearFilters).toHaveBeenCalledTimes(1);
    expect(status().textContent).toBe('Removed all label filters');
  });

  it('«Clear all» vacía el campo y oculta el aviso de error', () => {
    render(
      <LabelFilter
        filters={['app=test']}
        handleAddFilter={vi.fn()}
        handleClearFilters={vi.fn()}
      />
    );
    submitFilter('app:test!');
    expect(screen.getByText(/contain accepted label characters/i)).toBeTruthy();
    fireEvent.click(screen.getByText(/clear all/i));
    expect(screen.queryByText(/contain accepted label characters/i)).toBeNull();
    expect(input().value).toBe('');
  });

  it('el anuncio de añadidos sigue funcionando tras eliminar', () => {
    render(
      <LabelFilter
        filters={['app=test']}
        handleAddFilter={vi.fn()}
        handleDeleteFilter={vi.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText('Remove app:test label filter'));
    expect(status().textContent).toBe('Removed label filter app:test');
    submitFilter('env:dev');
    expect(status().textContent).toBe('Added 1 label filter');
  });
});
