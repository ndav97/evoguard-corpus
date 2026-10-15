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

// T005 — Ctrl+Enter (o Cmd+Enter) localiza las coincidencias.
describe('T005 · localizar con el teclado', () => {
  it('Ctrl+Enter llama a focusUiFindMatches y no navega', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TracePageSearchBar {...props} />);
    await user.click(screen.getByTestId('find-input'));
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(props.focusUiFindMatches).toHaveBeenCalledTimes(1);
    expect(props.nextResult).not.toHaveBeenCalled();
    expect(props.prevResult).not.toHaveBeenCalled();
  });

  it('Cmd+Enter hace lo mismo', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TracePageSearchBar {...props} />);
    await user.click(screen.getByTestId('find-input'));
    await user.keyboard('{Meta>}{Enter}{/Meta}');
    expect(props.focusUiFindMatches).toHaveBeenCalledTimes(1);
    expect(props.nextResult).not.toHaveBeenCalled();
  });

  it('Ctrl+Mayús+Enter también localiza, no va a la anterior', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TracePageSearchBar {...props} />);
    await user.click(screen.getByTestId('find-input'));
    await user.keyboard('{Control>}{Shift>}{Enter}{/Shift}{/Control}');
    expect(props.focusUiFindMatches).toHaveBeenCalledTimes(1);
    expect(props.prevResult).not.toHaveBeenCalled();
  });

  it('no localiza sin texto de búsqueda ni si la barra no es navegable', async () => {
    const user = userEvent.setup();
    const props = makeProps({ textFilter: '' });
    const { rerender } = render(<TracePageSearchBar {...props} />);
    await user.click(screen.getByTestId('find-input'));
    await user.keyboard('{Control>}{Enter}{/Control}');
    rerender(<TracePageSearchBar {...props} textFilter="http" navigable={false} />);
    await user.click(screen.getByTestId('find-input'));
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(props.focusUiFindMatches).not.toHaveBeenCalled();
  });

  it('Enter y Mayús+Enter siguen navegando', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TracePageSearchBar {...props} />);
    await user.click(screen.getByTestId('find-input'));
    await user.keyboard('{Enter}{Shift>}{Enter}{/Shift}');
    expect(props.nextResult).toHaveBeenCalledTimes(1);
    expect(props.prevResult).toHaveBeenCalledTimes(1);
    expect(props.focusUiFindMatches).not.toHaveBeenCalled();
  });
});
