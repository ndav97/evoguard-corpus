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

// T002 — Minutos en la última hora de la ventana.
describe('T002 · minutos en la última hora', () => {
  it('muestra los minutos restantes', () => {
    render(<Timer time={ago(23, 35)} />);
    expect(timer()).toHaveTextContent(/^25 min$/);
    expect(timer()).toHaveAttribute('aria-label', '25 minutes left in the session window');
  });

  it('usa el singular con un minuto', () => {
    render(<Timer time={ago(23, 59)} />);
    expect(timer()).toHaveTextContent(/^1 min$/);
    expect(timer()).toHaveAttribute('aria-label', '1 minute left in the session window');
  });

  it('a las 23 horas justas quedan 60 minutos', () => {
    render(<Timer time={ago(23)} />);
    expect(timer()).toHaveTextContent(/^60 min$/);
  });

  it('los minutos transcurridos incompletos no cuentan', () => {
    render(<Timer time={ago(23, 35, 50)} />);
    expect(timer()).toHaveTextContent(/^25 min$/);
  });

  it('antes de la última hora sigue mostrando horas', () => {
    render(<Timer time={ago(22, 59)} />);
    expect(timer()).toHaveTextContent(/^02 hrs$/);
    expect(timer()).toHaveAttribute('aria-label', '2 hours left in the session window');
  });

  it('a las 24 horas la ventana está expirada', () => {
    render(<Timer time={ago(24)} />);
    expect(timer()).toHaveTextContent(/^0 hrs$/);
    expect(timer()).toHaveAttribute('aria-label', 'Session window expired');
  });
});
