// Tests ocultos del estudio.
import React from 'react';
import { act, fireEvent, reduxRender, screen } from '../test-utils';
import { hideToast, showToast } from '../modules/IDE/actions/toast';
import Toast from '../modules/IDE/components/Toast';

const toast = () => screen.queryByRole('status') || screen.queryByRole('alert');

afterEach(() => {
  jest.useRealTimers();
});

// T001 — Cerrar el aviso con Escape.
describe('T001 · cerrar con Escape', () => {
  it('Escape oculta el aviso visible', () => {
    reduxRender(<Toast />, { initialState: { toast: { isVisible: true, text: 'Hello World' } } });
    expect(toast()).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(toast()).not.toBeInTheDocument();
  });

  it('funciona aunque el foco esté en otro elemento de la página', () => {
    reduxRender(
      <div>
        <input aria-label="other" />
        <Toast />
      </div>,
      { initialState: { toast: { isVisible: true, text: 'Hello World' } } }
    );
    const other = screen.getByLabelText('other');
    other.focus();
    fireEvent.keyDown(other, { key: 'Escape' });
    expect(toast()).not.toBeInTheDocument();
  });

  it('otras teclas no lo cierran', () => {
    reduxRender(<Toast />, { initialState: { toast: { isVisible: true, text: 'Hello World' } } });
    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'a' });
    expect(toast()).toBeInTheDocument();
  });

  it('el botón X sigue cerrándolo', () => {
    reduxRender(<Toast />, { initialState: { toast: { isVisible: true, text: 'Hello World' } } });
    fireEvent.click(screen.getByRole('button', { name: 'Close Alert' }));
    expect(toast()).not.toBeInTheDocument();
  });
});
