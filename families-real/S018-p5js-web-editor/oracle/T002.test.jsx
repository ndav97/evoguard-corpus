// Tests ocultos del estudio.
import React from 'react';
import { act, fireEvent, reduxRender, screen } from '../test-utils';
import { hideToast, showToast } from '../modules/IDE/actions/toast';
import Toast from '../modules/IDE/components/Toast';

const toast = () => screen.queryByRole('status') || screen.queryByRole('alert');

afterEach(() => {
  jest.useRealTimers();
});

const advance = (ms) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });

// T002 — Cada aviso dura su tiempo completo.
describe('T002 · un aviso nuevo no se cierra antes de tiempo', () => {
  it('un aviso mostrado durante otro dura su propio tiempo', () => {
    jest.useFakeTimers();
    const { store } = reduxRender(<Toast />);
    act(() => {
      store.dispatch(showToast('Toast.SketchSaved', 1000));
    });
    advance(600);
    act(() => {
      store.dispatch(showToast('Toast.SettingsSaved', 1000));
    });
    advance(500);
    expect(toast()).toHaveTextContent('Settings saved.');
    advance(499);
    expect(toast()).toBeInTheDocument();
    advance(1);
    expect(toast()).not.toBeInTheDocument();
  });

  it('cerrar a mano cancela el cierre automático pendiente', () => {
    jest.useFakeTimers();
    const { store } = reduxRender(<Toast />);
    act(() => {
      store.dispatch(showToast('Toast.SketchSaved', 1000));
    });
    advance(300);
    act(() => {
      store.dispatch(hideToast());
    });
    advance(100);
    act(() => {
      store.dispatch(showToast('Toast.AutosaveEnabled', 1000));
    });
    advance(700);
    expect(toast()).toHaveTextContent('Autosave enabled.');
    advance(300);
    expect(toast()).not.toBeInTheDocument();
  });

  it('al cerrar el aviso no queda ningún cierre automático pendiente', () => {
    jest.useFakeTimers();
    const { store } = reduxRender(<Toast />);
    const before = jest.getTimerCount();
    act(() => {
      store.dispatch(showToast('Toast.SketchSaved', 1000));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close Alert' }));
    expect(toast()).not.toBeInTheDocument();
    expect(jest.getTimerCount()).toBe(before);
  });

  it('un solo aviso se sigue cerrando a su tiempo', () => {
    jest.useFakeTimers();
    const { store } = reduxRender(<Toast />);
    act(() => {
      store.dispatch(showToast('Toast.SketchSaved'));
    });
    advance(1499);
    expect(toast()).toBeInTheDocument();
    advance(1);
    expect(toast()).not.toBeInTheDocument();
  });

  it('la sintaxis antigua de dos acciones sigue funcionando', () => {
    jest.useFakeTimers();
    const { store } = reduxRender(<Toast />);
    act(() => {
      store.dispatch({ type: 'SET_TOAST_TEXT', text: 'Toast.SketchSaved' });
      store.dispatch(showToast(800));
    });
    expect(toast()).toHaveTextContent('Sketch saved.');
    advance(800);
    expect(toast()).not.toBeInTheDocument();
  });
});
