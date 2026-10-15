// Tests ocultos del estudio.
import React from 'react';
import { act, fireEvent, reduxRender, screen } from '../test-utils';
import { hideToast, showToast } from '../modules/IDE/actions/toast';
import Toast from '../modules/IDE/components/Toast';

const toast = () => screen.queryByRole('status') || screen.queryByRole('alert');

afterEach(() => {
  jest.useRealTimers();
});

// T004 — El aviso no se cierra solo mientras el usuario lo mira.
describe('T004 · pausar el cierre automático', () => {
  it('con el ratón encima no se cierra al vencer su tiempo', () => {
    jest.useFakeTimers();
    const { store } = reduxRender(<Toast />);
    act(() => {
      store.dispatch(showToast('Toast.SketchSaved', 1000));
    });
    fireEvent.mouseEnter(toast());
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(toast()).toBeInTheDocument();
  });

  it('al salir el ratón vuelve a contar su tiempo completo', () => {
    jest.useFakeTimers();
    const { store } = reduxRender(<Toast />);
    act(() => {
      store.dispatch(showToast('Toast.SketchSaved', 1000));
    });
    act(() => {
      jest.advanceTimersByTime(900);
    });
    fireEvent.mouseEnter(toast());
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    fireEvent.mouseLeave(toast());
    act(() => {
      jest.advanceTimersByTime(900);
    });
    expect(toast()).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(toast()).not.toBeInTheDocument();
  });

  it('con el foco dentro tampoco se cierra, y al salir el foco vuelve a contar', () => {
    jest.useFakeTimers();
    const { store } = reduxRender(<Toast />);
    act(() => {
      store.dispatch(showToast('Toast.SketchSaved', 1000));
    });
    const close = screen.getByRole('button');
    act(() => {
      close.focus();
    });
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(toast()).toBeInTheDocument();
    act(() => {
      close.blur();
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(toast()).not.toBeInTheDocument();
  });

  it('con el ratón encima, «X» y Escape siguen cerrando', () => {
    jest.useFakeTimers();
    const { store } = reduxRender(<Toast />);
    act(() => {
      store.dispatch(showToast('Toast.SketchSaved', 1000));
    });
    fireEvent.mouseEnter(toast());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(toast()).not.toBeInTheDocument();
    act(() => {
      store.dispatch(showToast('Toast.SketchSaved', 1000));
    });
    fireEvent.mouseEnter(toast());
    fireEvent.click(screen.getByRole('button'));
    expect(toast()).not.toBeInTheDocument();
  });

  it('salir el ratón de un aviso ya cerrado no vuelve a mostrar nada ni falla', () => {
    jest.useFakeTimers();
    const { store } = reduxRender(<Toast />);
    act(() => {
      store.dispatch(showToast('Toast.SketchSaved', 1000));
    });
    const element = toast();
    fireEvent.mouseEnter(element);
    act(() => {
      store.dispatch(hideToast());
    });
    fireEvent.mouseLeave(element);
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(toast()).not.toBeInTheDocument();
  });
});
