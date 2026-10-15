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

const tick = (ms = 30000) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

// T004 — Aviso al expirar la ventana.
describe('T004 · onExpire', () => {
  it('se llama una vez cuando la ventana expira con el componente montado', () => {
    const onExpire = vi.fn();
    render(<Timer time={ago(23, 59, 50)} onExpire={onExpire} />);
    expect(onExpire).not.toHaveBeenCalled();
    tick();
    expect(timer()).toHaveTextContent(/^0 hrs$/);
    expect(onExpire).toHaveBeenCalledTimes(1);
    tick();
    tick();
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('no se llama si la ventana ya estaba expirada al montar', () => {
    const onExpire = vi.fn();
    render(<Timer time={ago(30)} onExpire={onExpire} />);
    tick();
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('no se llama mientras la ventana sigue abierta', () => {
    const onExpire = vi.fn();
    render(<Timer time={ago(10)} onExpire={onExpire} />);
    tick(120000);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('un mensaje nuevo reabre la ventana y puede volver a expirar', () => {
    const onExpire = vi.fn();
    const { rerender } = render(<Timer time={ago(23, 59, 50)} onExpire={onExpire} />);
    tick();
    expect(onExpire).toHaveBeenCalledTimes(1);
    rerender(<Timer time={new Date(Date.now() - (23 * 3600 + 59 * 60 + 50) * 1000)} onExpire={onExpire} />);
    expect(timer()).toHaveTextContent(/^1 min$/);
    tick();
    expect(onExpire).toHaveBeenCalledTimes(2);
  });

  it('sin onExpire el temporizador funciona igual', () => {
    render(<Timer time={ago(23, 59, 50)} />);
    tick();
    expect(timer()).toHaveAttribute('aria-label', 'Session window expired');
  });
});
