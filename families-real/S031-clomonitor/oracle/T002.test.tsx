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

// T002 — Rango de aceptación de un solo día.
describe('T002 · fecha de aceptación', () => {
  it('con desde y hasta en el mismo día muestra una sola fecha', () => {
    render(<SelectedFilters {...baseProps({ acceptedFrom: '2021-03-15', acceptedTo: '2021-03-15' })} />);
    expect(badges()).toEqual(['Accepted:Mar 15, 2021']);
  });

  it('con días distintos sigue mostrando el rango', () => {
    render(<SelectedFilters {...baseProps({ acceptedFrom: '2021-03-15', acceptedTo: '2021-04-02' })} />);
    expect(badges()).toEqual(['Accepted:Mar 15, 2021 - Apr 2, 2021']);
  });

  it('con un solo extremo no cambia', () => {
    const { unmount } = render(<SelectedFilters {...baseProps({ acceptedFrom: '2021-03-15' })} />);
    expect(badges()).toEqual(['Accepted:≥ Mar 15, 2021']);
    unmount();
    render(<SelectedFilters {...baseProps({ acceptedTo: '2021-03-15' })} />);
    expect(badges()).toEqual(['Accepted:≤ Mar 15, 2021']);
  });

  it('quitar el filtro sigue avisando igual', async () => {
    const props = baseProps({ acceptedFrom: '2021-03-15', acceptedTo: '2021-03-15' });
    render(<SelectedFilters {...props} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove accepted filter' }));
    expect(props.onAcceptedDateRangeChange).toHaveBeenCalledWith({ accepted_from: undefined, accepted_to: undefined });
  });
});
