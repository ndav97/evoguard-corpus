// Tests ocultos del estudio.
import React from 'react';
import { act, fireEvent, reduxRender, screen } from '../test-utils';
import { hideToast, setToastText, showToast } from '../modules/IDE/actions/toast';
import Toast from '../modules/IDE/components/Toast';

const toast = () => screen.queryByRole('status') || screen.queryByRole('alert');

afterEach(() => {
  jest.useRealTimers();
});

// T005 — Avisos repetidos con contador.
describe('T005 · avisos repetidos', () => {
  it('el mismo aviso repetido mientras se ve muestra un contador', () => {
    const { store } = reduxRender(<Toast />);
    act(() => {
      store.dispatch(showToast('Toast.SketchSaved'));
    });
    expect(toast()).not.toHaveTextContent('×');
    act(() => {
      store.dispatch(showToast('Toast.SketchSaved'));
    });
    expect(toast()).toHaveTextContent('Sketch saved. ×2');
    act(() => {
      store.dispatch(showToast('Toast.SketchSaved'));
    });
    expect(toast()).toHaveTextContent('Sketch saved. ×3');
  });

  it('un aviso distinto reinicia el contador', () => {
    const { store } = reduxRender(<Toast />);
    act(() => {
      store.dispatch(showToast('Toast.SketchSaved'));
      store.dispatch(showToast('Toast.SketchSaved'));
      store.dispatch(showToast('Toast.SketchFailedSave', 1500, 'error'));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to save sketch.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('×');
  });

  it('tras cerrarse, el mismo aviso vuelve a empezar sin contador', () => {
    const { store } = reduxRender(<Toast />);
    act(() => {
      store.dispatch(showToast('Toast.SketchSaved'));
      store.dispatch(showToast('Toast.SketchSaved'));
      store.dispatch(hideToast());
      store.dispatch(showToast('Toast.SketchSaved'));
    });
    expect(toast()).toHaveTextContent('Sketch saved.');
    expect(toast()).not.toHaveTextContent('×');
  });

  it('también cuenta con la forma antigua setToastText + showToast(tiempo)', () => {
    const { store } = reduxRender(<Toast />);
    act(() => {
      store.dispatch(setToastText('Toast.SketchSaved'));
      store.dispatch(showToast(1500));
      store.dispatch(setToastText('Toast.SketchSaved'));
      store.dispatch(showToast(1500));
    });
    expect(toast()).toHaveTextContent('Sketch saved. ×2');
  });

  it('cada repetición dura su tiempo completo', () => {
    jest.useFakeTimers();
    const { store } = reduxRender(<Toast />);
    act(() => {
      store.dispatch(showToast('Toast.SketchSaved', 1000));
    });
    act(() => {
      jest.advanceTimersByTime(800);
    });
    act(() => {
      store.dispatch(showToast('Toast.SketchSaved', 1000));
    });
    act(() => {
      jest.advanceTimersByTime(800);
    });
    expect(toast()).toHaveTextContent('×2');
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(toast()).not.toBeInTheDocument();
  });
});
