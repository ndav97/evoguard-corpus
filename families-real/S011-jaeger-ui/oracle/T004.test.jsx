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

// T004 — Escape vacía la búsqueda.
describe('T004 · Escape en la búsqueda', () => {
  it('con texto, Escape llama a clearSearch', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TracePageSearchBar {...props} />);
    await user.click(screen.getByTestId('find-input'));
    await user.keyboard('{Escape}');
    expect(props.clearSearch).toHaveBeenCalledTimes(1);
    expect(props.nextResult).not.toHaveBeenCalled();
    expect(props.prevResult).not.toHaveBeenCalled();
  });

  it('sin texto, Escape no hace nada', async () => {
    const user = userEvent.setup();
    const props = makeProps({ textFilter: '' });
    render(<TracePageSearchBar {...props} />);
    await user.click(screen.getByTestId('find-input'));
    await user.keyboard('{Escape}');
    expect(props.clearSearch).not.toHaveBeenCalled();
  });

  it('también funciona cuando la barra no es navegable', async () => {
    const user = userEvent.setup();
    const props = makeProps({ navigable: false });
    render(<TracePageSearchBar {...props} />);
    await user.click(screen.getByTestId('find-input'));
    await user.keyboard('{Escape}');
    expect(props.clearSearch).toHaveBeenCalledTimes(1);
  });

  it('otras teclas no vacían la búsqueda y Enter sigue navegando', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TracePageSearchBar {...props} />);
    await user.click(screen.getByTestId('find-input'));
    await user.keyboard('a{Backspace}{Enter}');
    expect(props.clearSearch).not.toHaveBeenCalled();
    expect(props.nextResult).toHaveBeenCalledTimes(1);
  });

  it('los botones no llaman a clearSearch', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TracePageSearchBar {...props} />);
    await user.click(screen.getByRole('button', { name: 'Next match' }));
    await user.click(screen.getByRole('button', { name: 'Locate matches in the trace' }));
    expect(props.clearSearch).not.toHaveBeenCalled();
  });
});
