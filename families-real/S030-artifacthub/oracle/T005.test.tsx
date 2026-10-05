// Tests ocultos del estudio.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Pagination from '../layout/common/Pagination';

const mockOnChange = jest.fn();

// 75 elementos de 15 en 15: 5 páginas; la activa es la 2.
const renderPagination = () =>
  render(<Pagination limit={15} total={75} offset={0} active={2} showGoTo onChange={mockOnChange} />);

describe('T005 · aviso de página no válida', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('una página fuera de rango muestra el aviso y marca el campo como no válido', async () => {
    renderPagination();

    const input = screen.getByLabelText('Go to page');
    await userEvent.type(input, '9{enter}');

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a page between 1 and 5');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveDisplayValue('9');
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('el 0 también es una página no válida', async () => {
    renderPagination();

    await userEvent.type(screen.getByLabelText('Go to page'), '0');
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a page between 1 and 5');
  });

  it('el aviso desaparece al volver a escribir', async () => {
    renderPagination();

    const input = screen.getByLabelText('Go to page');
    await userEvent.type(input, '9{enter}');
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await userEvent.type(input, '{backspace}');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(input).not.toHaveAttribute('aria-invalid', 'true');

    await userEvent.type(input, '3{enter}');
    expect(mockOnChange).toHaveBeenCalledWith(3);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('una página válida o el campo vacío no muestran aviso', async () => {
    renderPagination();

    const input = screen.getByLabelText('Go to page');
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(screen.queryByRole('alert')).toBeNull();

    await userEvent.type(input, '4{enter}');
    expect(mockOnChange).toHaveBeenCalledWith(4);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(input).not.toHaveAttribute('aria-invalid', 'true');
  });
});
