// Tests ocultos del estudio.
import { render, screen } from '@testing-library/react';

import Pagination from '../layout/common/Pagination';

const mockOnChange = jest.fn();

// 300 elementos de 15 en 15: 20 páginas.
const renderPagination = (siblingCount?: number) =>
  render(
    <Pagination limit={15} total={300} offset={0} active={10} siblingCount={siblingCount} onChange={mockOnChange} />
  );

describe('T003 · páginas vecinas configurables', () => {
  it('con siblingCount 2 muestra dos páginas a cada lado de la activa', () => {
    renderPagination(2);

    ['1', '8', '9', '10', '11', '12', '20'].forEach((page) => {
      expect(screen.getByText(page)).toBeInTheDocument();
    });
    expect(screen.queryByText('7')).toBeNull();
    expect(screen.queryByText('13')).toBeNull();
    expect(screen.getAllByText('...')).toHaveLength(2);
  });

  it('con siblingCount 0 solo muestra la activa entre la primera y la última', () => {
    renderPagination(0);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('10').closest('li')).toHaveClass('page-item active');
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.queryByText('9')).toBeNull();
    expect(screen.queryByText('11')).toBeNull();
    expect(screen.getAllByText('...')).toHaveLength(2);
  });

  it('sin siblingCount muestra una página a cada lado', () => {
    renderPagination();

    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.queryByText('8')).toBeNull();
    expect(screen.queryByText('12')).toBeNull();
  });

  it('un siblingCount negativo se trata como 1', () => {
    renderPagination(-1);

    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.queryByText('8')).toBeNull();
  });
});
