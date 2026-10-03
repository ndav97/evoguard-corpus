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

// T001 — Nombres accesibles de los botones de navegación.
describe('T001 · botones de navegación con nombre accesible', () => {
  it('cada botón tiene su nombre accesible', () => {
    render(<TracePageSearchBar {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Locate matches in the trace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous match' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next match' })).toBeInTheDocument();
  });

  it('los nombres corresponden a la acción de cada botón', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TracePageSearchBar {...props} />);
    await user.click(screen.getByRole('button', { name: 'Locate matches in the trace' }));
    await user.click(screen.getByRole('button', { name: 'Previous match' }));
    await user.click(screen.getByRole('button', { name: 'Next match' }));
    expect(props.focusUiFindMatches).toHaveBeenCalledTimes(1);
    expect(props.prevResult).toHaveBeenCalledTimes(1);
    expect(props.nextResult).toHaveBeenCalledTimes(1);
  });

  it('sin texto de búsqueda los botones siguen deshabilitados', () => {
    render(<TracePageSearchBar {...makeProps({ textFilter: '' })} />);
    expect(screen.getByRole('button', { name: 'Previous match' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next match' })).toBeDisabled();
  });
});
