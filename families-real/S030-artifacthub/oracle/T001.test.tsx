// Tests ocultos del estudio.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Pagination from '../layout/common/Pagination';

const mockOnChange = jest.fn();

describe('T001 · página activa fuera de rango', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('si active supera el número de páginas, la última queda activa', () => {
    render(<Pagination limit={15} total={45} offset={0} active={9} onChange={mockOnChange} />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3').closest('li')).toHaveClass('page-item active');
    expect(screen.queryByText('...')).toBeNull();
    expect(screen.getByText('Next').closest('button')).toBeDisabled();
    expect(screen.getByText('Previous').closest('button')).toBeEnabled();
  });

  it('con active fuera de rango, Previous lleva a la penúltima y la última no dispara onChange', async () => {
    render(<Pagination limit={15} total={45} offset={0} active={9} onChange={mockOnChange} />);

    await userEvent.click(screen.getByText('3'));
    expect(mockOnChange).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText('Previous'));
    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(2);
  });

  it('si active es menor que 1, la primera queda activa', async () => {
    render(<Pagination limit={15} total={45} offset={0} active={0} onChange={mockOnChange} />);

    expect(screen.getByText('1').closest('li')).toHaveClass('page-item active');
    expect(screen.queryByText('...')).toBeNull();
    expect(screen.getByText('Previous').closest('button')).toBeDisabled();

    await userEvent.click(screen.getByText('Next'));
    expect(mockOnChange).toHaveBeenCalledWith(2);
  });

  it('con active dentro del rango se comporta como siempre', async () => {
    render(<Pagination limit={15} total={45} offset={0} active={2} onChange={mockOnChange} />);

    expect(screen.getByText('2').closest('li')).toHaveClass('page-item active');
    await userEvent.click(screen.getByText('Next'));
    expect(mockOnChange).toHaveBeenLastCalledWith(3);
    await userEvent.click(screen.getByText('Previous'));
    expect(mockOnChange).toHaveBeenLastCalledWith(1);
  });
});
