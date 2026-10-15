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

// T001 — Botón para quitar todos los filtros.
describe('T001 · «Clear all»', () => {
  it('aparece con onResetFilters y dos o más filtros activos, y lo llama', async () => {
    const props = baseProps({ filters: { rating: ['a', 'b'] }, onResetFilters: vi.fn() });
    render(<SelectedFilters {...props} />);
    const button = screen.getByRole('button', { name: 'Clear all filters' });
    expect(button).toHaveTextContent('Clear all');
    await userEvent.click(button);
    expect(props.onResetFilters).toHaveBeenCalledTimes(1);
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it('el filtro de fecha de aceptación cuenta', () => {
    render(<SelectedFilters {...baseProps({ filters: { maturity: ['sandbox'] }, acceptedTo: '2020-05-01', onResetFilters: vi.fn() })} />);
    expect(screen.getByRole('button', { name: 'Clear all filters' })).toBeInTheDocument();
  });

  it('no aparece con un solo filtro', () => {
    render(<SelectedFilters {...baseProps({ filters: { rating: ['a'] }, onResetFilters: vi.fn() })} />);
    expect(screen.queryByRole('button', { name: 'Clear all filters' })).not.toBeInTheDocument();
  });

  it('no aparece sin onResetFilters', () => {
    render(<SelectedFilters {...baseProps({ filters: { rating: ['a', 'b'], maturity: ['sandbox'] } })} />);
    expect(screen.queryByRole('button', { name: 'Clear all filters' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('no forma parte de la lista de filtros', () => {
    render(<SelectedFilters {...baseProps({ filters: { rating: ['a', 'b'] }, onResetFilters: vi.fn() })} />);
    expect(within(screen.getByRole('list')).queryByRole('button', { name: 'Clear all filters' })).not.toBeInTheDocument();
  });
});
