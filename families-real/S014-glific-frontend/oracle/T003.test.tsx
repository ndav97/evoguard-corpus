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

// T003 — Actualización cada 30 segundos.
describe('T003 · actualización cada 30 segundos', () => {
  it('se actualiza a los 30 segundos', () => {
    render(<Timer time={ago(23, 35, 40)} />);
    expect(timer()).toHaveTextContent(/^25 min$/);
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(timer()).toHaveTextContent(/^24 min$/);
    expect(timer()).toHaveAttribute('aria-label', '24 minutes left in the session window');
  });

  it('no se actualiza antes de los 30 segundos', () => {
    render(<Timer time={ago(23, 35, 40)} />);
    act(() => {
      vi.advanceTimersByTime(29000);
    });
    expect(timer()).toHaveTextContent(/^25 min$/);
  });

  it('pasa a expirada en la siguiente actualización', () => {
    render(<Timer time={ago(23, 59, 50)} />);
    expect(timer()).toHaveTextContent(/^1 min$/);
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(timer()).toHaveTextContent(/^0 hrs$/);
    expect(timer()).toHaveAttribute('aria-label', 'Session window expired');
  });

  it('las horas también se actualizan', () => {
    render(<Timer time={ago(21, 59, 45)} />);
    expect(timer()).toHaveTextContent(/^03 hrs$/);
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(timer()).toHaveTextContent(/^02 hrs$/);
  });
});
