// Tests ocultos del estudio.
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Timer } from 'components/UI/Timer/Timer';

const NOW = new Date('2026-03-10T12:00:00.000Z');
// Momento del último mensaje: hace h horas, m minutos y s segundos.
const ago = (h: number, m = 0, s = 0) => new Date(NOW.getTime() - ((h * 60 + m) * 60 + s) * 1000);
const timer = () => screen.getByTestId('timerCount');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

// T005 — Ventanas de sesión de otra duración.
describe('T005 · windowHours', () => {
  it('por defecto la ventana dura 24 horas', () => {
    render(<Timer time={ago(20)} />);
    expect(timer()).toHaveTextContent(/^04 hrs$/);
  });

  it('con windowHours=72 cuenta sobre 72 horas', () => {
    render(<Timer time={ago(20)} windowHours={72} />);
    expect(timer()).toHaveTextContent(/^52 hrs$/);
    expect(timer()).toHaveAttribute('aria-label', '52 hours left in the session window');
  });

  it('la última hora de una ventana de 72 horas muestra minutos', () => {
    render(<Timer time={ago(71, 35, 0)} windowHours={72} />);
    expect(timer()).toHaveTextContent(/^25 min$/);
    expect(timer()).toHaveAttribute('aria-label', '25 minutes left in the session window');
  });

  it('expira al cumplirse windowHours, no antes', () => {
    const { unmount } = render(<Timer time={ago(30)} windowHours={48} />);
    expect(timer()).toHaveTextContent(/^18 hrs$/);
    unmount();
    render(<Timer time={ago(48)} windowHours={48} />);
    expect(timer()).toHaveTextContent(/^0 hrs$/);
    expect(timer()).toHaveAttribute('aria-label', 'Session window expired');
  });

  it('con pocas horas restantes se rellena con cero', () => {
    render(<Timer time={ago(9)} windowHours={12} />);
    expect(timer()).toHaveTextContent(/^03 hrs$/);
    expect(timer()).toHaveAttribute('aria-label', '3 hours left in the session window');
  });

  it('onExpire respeta la duración elegida', () => {
    const onExpire = vi.fn();
    render(<Timer time={ago(11, 59, 50)} windowHours={12} onExpire={onExpire} />);
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('valores no válidos se tratan como 24', () => {
    for (const windowHours of [0, -5, 1.5]) {
      const { unmount } = render(<Timer time={ago(20)} windowHours={windowHours} />);
      expect(timer()).toHaveTextContent(/^04 hrs$/);
      unmount();
    }
  });
});
