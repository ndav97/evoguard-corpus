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

// T003 — Enter y Mayús+Enter en el campo de búsqueda.
describe('T003 · navegar con el teclado desde la búsqueda', () => {
  it('Enter va a la siguiente coincidencia', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TracePageSearchBar {...props} />);
    await user.click(screen.getByTestId('find-input'));
    await user.keyboard('{Enter}');
    expect(props.nextResult).toHaveBeenCalledTimes(1);
    expect(props.prevResult).not.toHaveBeenCalled();
  });

  it('Mayús+Enter va a la coincidencia anterior', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TracePageSearchBar {...props} />);
    await user.click(screen.getByTestId('find-input'));
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(props.prevResult).toHaveBeenCalledTimes(1);
    expect(props.nextResult).not.toHaveBeenCalled();
  });

  it('no navega sin texto de búsqueda', async () => {
    const user = userEvent.setup();
    const props = makeProps({ textFilter: '' });
    render(<TracePageSearchBar {...props} />);
    await user.click(screen.getByTestId('find-input'));
    await user.keyboard('{Enter}{Shift>}{Enter}{/Shift}');
    expect(props.nextResult).not.toHaveBeenCalled();
    expect(props.prevResult).not.toHaveBeenCalled();
  });

  it('no navega cuando la barra no es navegable', async () => {
    const user = userEvent.setup();
    const props = makeProps({ navigable: false });
    render(<TracePageSearchBar {...props} />);
    await user.click(screen.getByTestId('find-input'));
    await user.keyboard('{Enter}');
    expect(props.nextResult).not.toHaveBeenCalled();
  });

  it('las otras teclas no navegan y el recuento accesible se mantiene', async () => {
    const user = userEvent.setup();
    const props = makeProps({ resultCount: 2 });
    render(<TracePageSearchBar {...props} />);
    await user.click(screen.getByTestId('find-input'));
    await user.keyboard('a{ArrowDown}');
    expect(props.nextResult).not.toHaveBeenCalled();
    expect(screen.getByText('2', { selector: '.TracePageSearchBar--count' })).toHaveAttribute('aria-label', '2 matching spans');
  });
});
