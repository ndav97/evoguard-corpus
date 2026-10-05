// Tests ocultos del estudio.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Pagination from '../layout/common/Pagination';

const mockOnChange = jest.fn();

// 75 elementos de 15 en 15: 5 páginas; la activa es la 2.
const renderPagination = (showGoTo = true) =>
  render(<Pagination limit={15} total={75} offset={0} active={2} showGoTo={showGoTo} onChange={mockOnChange} />);

describe('T004 · ir a una página', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('sin showGoTo no hay campo ni botón Go', () => {
    renderPagination(false);

    expect(screen.queryByLabelText('Go to page')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Go' })).toBeNull();
  });

  it('con el botón Go se abre la página escrita y el campo se vacía', async () => {
    renderPagination();

    const input = screen.getByLabelText('Go to page');
    await userEvent.type(input, '4');
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(4);
    expect(input).toHaveDisplayValue('');
  });

  it('Enter en el campo también abre la página', async () => {
    renderPagination();

    await userEvent.type(screen.getByLabelText('Go to page'), '5{enter}');

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(5);
  });

  it('no llama a onChange con páginas fuera de rango ni con el campo vacío', async () => {
    renderPagination();

    const input = screen.getByLabelText('Go to page');
    const goBtn = screen.getByRole('button', { name: 'Go' });
    await userEvent.click(goBtn);
    await userEvent.type(input, '9');
    await userEvent.click(goBtn);
    await userEvent.clear(input);
    await userEvent.type(input, '0');
    await userEvent.click(goBtn);

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('la página activa no llama a onChange pero vacía el campo', async () => {
    renderPagination();

    const input = screen.getByLabelText('Go to page');
    await userEvent.type(input, '2{enter}');

    expect(mockOnChange).not.toHaveBeenCalled();
    expect(input).toHaveDisplayValue('');
  });
});
