// Tests ocultos del estudio.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Pagination from '../layout/common/Pagination';

const mockOnChange = jest.fn();

describe('T002 · botones First y Last', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('sin showFirstLast no se muestran', () => {
    render(<Pagination limit={15} total={75} offset={0} active={3} onChange={mockOnChange} />);

    expect(screen.queryByRole('button', { name: 'Open first page' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open last page' })).toBeNull();
  });

  it('llevan a la primera y a la última página', async () => {
    render(<Pagination limit={15} total={75} offset={0} active={3} showFirstLast onChange={mockOnChange} />);

    const firstBtn = screen.getByRole('button', { name: 'Open first page' });
    const lastBtn = screen.getByRole('button', { name: 'Open last page' });
    expect(firstBtn).toHaveTextContent('First');
    expect(lastBtn).toHaveTextContent('Last');

    await userEvent.click(firstBtn);
    expect(mockOnChange).toHaveBeenLastCalledWith(1);
    await userEvent.click(lastBtn);
    expect(mockOnChange).toHaveBeenLastCalledWith(5);
    expect(mockOnChange).toHaveBeenCalledTimes(2);
  });

  it('First va antes de Previous y Last después de Next', () => {
    render(<Pagination limit={15} total={75} offset={0} active={3} showFirstLast onChange={mockOnChange} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveAccessibleName('Open first page');
    expect(buttons[1]).toHaveTextContent('Previous');
    expect(buttons[buttons.length - 2]).toHaveTextContent('Next');
    expect(buttons[buttons.length - 1]).toHaveAccessibleName('Open last page');
  });

  it('First se deshabilita en la primera página', () => {
    render(<Pagination limit={15} total={75} offset={0} active={1} showFirstLast onChange={mockOnChange} />);

    expect(screen.getByRole('button', { name: 'Open first page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Open last page' })).toBeEnabled();
  });

  it('Last se deshabilita en la última página', () => {
    render(<Pagination limit={15} total={75} offset={0} active={5} showFirstLast onChange={mockOnChange} />);

    expect(screen.getByRole('button', { name: 'Open last page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Open first page' })).toBeEnabled();
  });
});
