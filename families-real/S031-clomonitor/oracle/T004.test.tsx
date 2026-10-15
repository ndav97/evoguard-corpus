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
const many = { rating: ['a', 'b'], maturity: ['sandbox', 'incubating'], foundation: ['cncf'] };

// T004 — Mostrar solo los primeros filtros.
describe('T004 · maxVisible', () => {
  it('sin maxVisible se ven todos y no hay botones de expandir', () => {
    render(<SelectedFilters {...baseProps({ filters: many, acceptedFrom: '2020-01-01' })} />);
    expect(badges()).toHaveLength(6);
    expect(screen.queryByRole('button', { name: /more$/ })).not.toBeInTheDocument();
  });

  it('con maxVisible muestra los primeros y cuántos quedan ocultos', () => {
    render(<SelectedFilters {...baseProps({ filters: many, acceptedFrom: '2020-01-01', maxVisible: 3 })} />);
    expect(badges()).toEqual(['Accepted:≥ Jan 1, 2020', 'Rating:A [75-100]', 'Rating:B [50-74]']);
    expect(screen.getByRole('button', { name: '+3 more' })).toBeInTheDocument();
  });

  it('«+N more» muestra todos y «Show less» vuelve a recortar', async () => {
    render(<SelectedFilters {...baseProps({ filters: many, maxVisible: 2 })} />);
    await userEvent.click(screen.getByRole('button', { name: '+3 more' }));
    expect(badges()).toHaveLength(5);
    expect(screen.queryByRole('button', { name: /more$/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show less' }));
    expect(badges()).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Show less' })).not.toBeInTheDocument();
  });

  it('si caben todos no hay botones', () => {
    render(<SelectedFilters {...baseProps({ filters: { rating: ['a'] }, maxVisible: 3 })} />);
    expect(badges()).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /more$|Show less/ })).not.toBeInTheDocument();
  });

  it('valores no válidos se ignoran', () => {
    for (const maxVisible of [0, -2, 1.5]) {
      const { unmount } = render(<SelectedFilters {...baseProps({ filters: many, maxVisible })} />);
      expect(badges()).toHaveLength(5);
      unmount();
    }
  });

  it('«Clear all» sigue contando todos los filtros', () => {
    render(<SelectedFilters {...baseProps({ filters: { rating: ['a', 'b'] }, maxVisible: 1, onResetFilters: vi.fn() })} />);
    expect(screen.getByRole('button', { name: 'Clear all filters' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+1 more' })).toBeInTheDocument();
  });
});
