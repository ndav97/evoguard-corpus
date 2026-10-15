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

// T003 — Valores y categorías desconocidos.
describe('T003 · filtros desconocidos', () => {
  it('un control desconocido se muestra tal cual en lugar de fallar', () => {
    render(<SelectedFilters {...baseProps({ filters: { passing_check: ['adopters', 'legacy_check'] } })} />);
    expect(badges()).toEqual(['Passed:Adopters', 'Passed:Legacy_check']);
    expect(screen.getByRole('button', { name: 'Remove Legacy_check filter' })).toBeInTheDocument();
  });

  it('también en los controles no superados', () => {
    render(<SelectedFilters {...baseProps({ filters: { not_passing_check: ['something'] } })} />);
    expect(badges()).toEqual(['Not passed:Something']);
  });

  it('una calificación desconocida se muestra con su valor', () => {
    render(<SelectedFilters {...baseProps({ filters: { rating: ['a', 'z'] } })} />);
    expect(badges()).toEqual(['Rating:A [75-100]', 'Rating:Z']);
  });

  it('una categoría desconocida usa su nombre con mayúscula inicial', () => {
    render(<SelectedFilters {...baseProps({ filters: { language: ['go'] } })} />);
    expect(badges()).toEqual(['Language:Go']);
  });

  it('quitar un valor desconocido avisa con su valor original', async () => {
    const props = baseProps({ filters: { passing_check: ['legacy_check'] } });
    render(<SelectedFilters {...props} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Legacy_check filter' }));
    expect(props.onChange).toHaveBeenCalledWith('passing_check', 'legacy_check', false);
  });

  it('los valores conocidos no cambian', () => {
    render(<SelectedFilters {...baseProps({ filters: { foundation: ['cncf'], passing_check: ['sbom'] } })} />);
    expect(badges()).toEqual(['Foundation:CNCF', 'Passed:SBOM']);
  });
});
