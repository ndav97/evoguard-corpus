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

// T001 — Nombre accesible del temporizador.
describe('T001 · temporizador accesible', () => {
  it('describe las horas que quedan (plural)', () => {
    render(<Timer time={ago(2)} />);
    expect(timer()).toHaveAttribute('aria-label', '22 hours left in the session window');
    expect(timer()).toHaveTextContent('22 hrs');
  });

  it('usa el número sin cero a la izquierda', () => {
    render(<Timer time={ago(20)} />);
    expect(timer()).toHaveAttribute('aria-label', '4 hours left in the session window');
    expect(timer()).toHaveTextContent('04 hrs');
  });

  it('indica cuando la ventana expiró', () => {
    render(<Timer time={ago(30)} />);
    expect(timer()).toHaveAttribute('aria-label', 'Session window expired');
    expect(timer()).toHaveTextContent('0 hrs');
  });

  it('con el mensaje recién recibido quedan 24 horas', () => {
    render(<Timer time={ago(0)} />);
    expect(timer()).toHaveAttribute('aria-label', '24 hours left in the session window');
  });
});
