// Tests ocultos del estudio.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import SelectedFilters from '../layout/search/SelectedFilters';

const baseProps = (overrides = {}) => ({
  filters: {},
  onChange: vi.fn(),
  onAcceptedDateRangeChange: vi.fn(),
  ...overrides,
});
const badges = () => within(screen.getByRole('list')).queryAllByRole('listitem').map((item) => item.textContent);

// T005 — Quitar todos los filtros de una categoría.
describe('T005 · quitar una categoría', () => {
  it('con onRemoveCategory, cada categoría con dos o más valores tiene su botón', () => {
    render(<SelectedFilters {...baseProps({ filters: { rating: ['a', 'b'], foundation: ['cncf'] }, onRemoveCategory: vi.fn() })} />);
    expect(screen.getByRole('button', { name: 'Remove all Rating filters' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove all Foundation filters' })).not.toBeInTheDocument();
  });

  it('al pulsarlo avisa con la categoría y no quita valores sueltos', async () => {
    const props = baseProps({ filters: { maturity: ['sandbox', 'graduated'] }, onRemoveCategory: vi.fn() });
    render(<SelectedFilters {...props} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove all Maturity filters' }));
    expect(props.onRemoveCategory).toHaveBeenCalledWith('maturity');
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('usa el nombre visible de la categoría', () => {
    render(<SelectedFilters {...baseProps({ filters: { not_passing_check: ['adopters', 'sbom'] }, onRemoveCategory: vi.fn() })} />);
    expect(screen.getByRole('button', { name: 'Remove all Not passed filters' })).toBeInTheDocument();
  });

  it('sin onRemoveCategory no hay botones de categoría', () => {
    render(<SelectedFilters {...baseProps({ filters: { rating: ['a', 'b'] } })} />);
    expect(screen.queryByRole('button', { name: /^Remove all/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('con la lista recortada, solo aparece si se ven todos los valores de la categoría', async () => {
    render(
      <SelectedFilters
        {...baseProps({ filters: { rating: ['a', 'b'], maturity: ['sandbox', 'incubating'] }, maxVisible: 3, onRemoveCategory: vi.fn() })}
      />
    );
    expect(screen.getByRole('button', { name: 'Remove all Rating filters' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove all Maturity filters' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '+1 more' }));
    expect(screen.getByRole('button', { name: 'Remove all Maturity filters' })).toBeInTheDocument();
  });
});
