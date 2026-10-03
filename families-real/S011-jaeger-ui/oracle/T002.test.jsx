// Tests ocultos del estudio.
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { TracePageSearchBarFn as TracePageSearchBar } from '../components/TracePage/TracePageHeader/TracePageSearchBar';

vi.mock('../components/TracePage/index.track', async () => ({
  trackFilter: vi.fn(),
}));

// Sustituye el campo real (que necesita el router) por un <input> que recibe todas las inputProps.
vi.mock('../components/common/UiFindInput', () =>
  mockDefault(
    React.forwardRef(function MockUiFindInput({ inputProps = {} }, ref) {
      const { suffix, ...rest } = inputProps;
      return (
        <div data-testid="find-wrapper">
          <input ref={ref} data-testid="find-input" {...rest} />
          {suffix}
        </div>
      );
    })
  )
);

const makeProps = overrides => ({
  forwardedRef: React.createRef(),
  navigable: true,
  nextResult: vi.fn(),
  prevResult: vi.fn(),
  clearSearch: vi.fn(),
  focusUiFindMatches: vi.fn(),
  resultCount: 3,
  textFilter: 'http',
  useOtelTerms: false,
  ...overrides,
});

afterEach(() => cleanup());

const countEl = n => screen.getByText(String(n), { selector: '.TracePageSearchBar--count' });

// T002 — Recuento de coincidencias anunciado a lectores de pantalla.
describe('T002 · recuento accesible', () => {
  it('el recuento tiene etiqueta en plural y se anuncia', () => {
    render(<TracePageSearchBar {...makeProps({ resultCount: 3 })} />);
    const el = countEl(3);
    expect(el).toHaveAttribute('aria-label', '3 matching spans');
    expect(el).toHaveAttribute('aria-live', 'polite');
  });

  it('usa el singular con una coincidencia y el plural con cero', () => {
    const { rerender } = render(<TracePageSearchBar {...makeProps({ resultCount: 1 })} />);
    expect(countEl(1)).toHaveAttribute('aria-label', '1 matching span');
    rerender(<TracePageSearchBar {...makeProps({ resultCount: 0 })} />);
    expect(countEl(0)).toHaveAttribute('aria-label', '0 matching spans');
  });

  it('el número visible no cambia y no hay recuento sin texto de búsqueda', () => {
    const { rerender } = render(<TracePageSearchBar {...makeProps({ resultCount: 7 })} />);
    expect(countEl(7)).toHaveTextContent(/^7$/);
    rerender(<TracePageSearchBar {...makeProps({ textFilter: '', resultCount: 7 })} />);
    expect(document.querySelector('.TracePageSearchBar--count')).toBeNull();
  });

  it('se mantienen los nombres de los botones', () => {
    render(<TracePageSearchBar {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Next match' })).toBeInTheDocument();
  });
});
