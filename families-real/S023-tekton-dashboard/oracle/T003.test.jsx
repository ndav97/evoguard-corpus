// Tests ocultos del estudio.
import { fireEvent, screen } from '@testing-library/react';

import LabelFilter from '../../packages/components/src/components/LabelFilter';
import { render } from '../../packages/components/src/utils/test';

const INVALID = /contain accepted label characters/i;
const TOO_LONG = /contain less than 64 characters/i;
const DUPLICATE = /no duplicate filters allowed/i;
const DOCS = 'See the Kubernetes Label documentation for valid syntax';

const input = () => screen.getByPlaceholderText(/input a label filter/i);

function submitFilter(value) {
  fireEvent.change(input(), { target: { value } });
  fireEvent.submit(screen.getByText(/Input a label filter/i));
}

// T003 — Avisos de error coherentes.
describe('T003 · avisos de error coherentes', () => {
  it('el aviso de formato desaparece al editar el texto', () => {
    render(<LabelFilter handleAddFilter={vi.fn()} />);
    submitFilter('app');
    expect(screen.getByText(INVALID)).toBeTruthy();
    fireEvent.change(input(), { target: { value: 'app:' } });
    expect(screen.queryByText(INVALID)).toBeNull();
    expect(input().value).toBe('app:');
  });

  it('el aviso de duplicado desaparece al editar el texto', () => {
    render(<LabelFilter filters={['app=test']} handleAddFilter={vi.fn()} />);
    submitFilter('app:test');
    expect(screen.getByText(DUPLICATE)).toBeTruthy();
    fireEvent.change(input(), { target: { value: 'app:test2' } });
    expect(screen.queryByText(DUPLICATE)).toBeNull();
  });

  it('el aviso de longitud enlaza la documentación de etiquetas', () => {
    render(<LabelFilter handleAddFilter={vi.fn()} />);
    submitFilter(`app:${'x'.repeat(64)}`);
    expect(screen.getByText(TOO_LONG)).toBeTruthy();
    const link = screen.getByRole('link', { name: DOCS });
    expect(link.getAttribute('href')).toContain('kubernetes.io');
  });

  it('el aviso de formato sigue enlazando la documentación', () => {
    render(<LabelFilter handleAddFilter={vi.fn()} />);
    submitFilter('app:test!');
    const link = screen.getByRole('link', { name: DOCS });
    expect(link.getAttribute('href')).toContain('kubernetes.io');
  });

  it('el aviso de duplicado no muestra ningún enlace', () => {
    render(<LabelFilter filters={['app=test']} handleAddFilter={vi.fn()} />);
    submitFilter('app:test');
    expect(screen.getByText(DUPLICATE)).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
