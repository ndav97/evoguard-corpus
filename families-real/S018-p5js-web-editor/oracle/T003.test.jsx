// Tests ocultos del estudio.
import React from 'react';
import { act, fireEvent, reduxRender, screen } from '../test-utils';
import { hideToast, showToast } from '../modules/IDE/actions/toast';
import Toast from '../modules/IDE/components/Toast';

const toast = () => screen.queryByRole('status') || screen.queryByRole('alert');

afterEach(() => {
  jest.useRealTimers();
});

// T003 — Avisos de error.
describe('T003 · avisos de error', () => {
  it('un aviso de error se anuncia como alerta', () => {
    const { store } = reduxRender(<Toast />);
    act(() => {
      store.dispatch(showToast('Toast.SketchFailedSave', 1500, 'error'));
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Failed to save sketch.');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveClass('toast', 'toast--error');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('sin variante el aviso sigue siendo informativo', () => {
    const { store } = reduxRender(<Toast />);
    act(() => {
      store.dispatch(showToast('Toast.SketchSaved'));
    });
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).not.toHaveClass('toast--error');
  });

  it('un aviso informativo después de uno de error vuelve a ser informativo', () => {
    const { store } = reduxRender(<Toast />);
    act(() => {
      store.dispatch(showToast('Toast.SketchFailedSave', 1500, 'error'));
    });
    act(() => {
      store.dispatch(showToast('Toast.SketchSaved'));
    });
    expect(screen.getByRole('status')).toHaveTextContent('Sketch saved.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('el aviso de error se cierra con Escape y a su tiempo', () => {
    jest.useFakeTimers();
    const { store } = reduxRender(<Toast />);
    act(() => {
      store.dispatch(showToast('Toast.NetworkError', 1000, 'error'));
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(toast()).not.toBeInTheDocument();
    act(() => {
      store.dispatch(showToast('Toast.NetworkError', 1000, 'error'));
    });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(toast()).not.toBeInTheDocument();
  });
});
