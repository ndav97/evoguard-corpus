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

  // Escuchadores de teclado añadidos y retirados en document o window.
  const spyKeydown = (method) => {
    const spies = [jest.spyOn(document, method), jest.spyOn(window, method)];
    return {
      handlers: () => spies.flatMap((spy) => spy.mock.calls.filter(([type]) => type === 'keydown').map(([, fn]) => fn)),
      restore: () => spies.forEach((spy) => spy.mockRestore())
    };
  };

  it('sin aviso visible no queda ningún escuchador de teclado', () => {
    const added = spyKeydown('addEventListener');
    const removed = spyKeydown('removeEventListener');
    try {
      reduxRender(<Toast />, { initialState: { toast: { isVisible: false, text: '' } } });
      const pending = added.handlers().filter((fn) => !removed.handlers().includes(fn));
      expect(pending).toHaveLength(0);
    } finally {
      added.restore();
      removed.restore();
    }
  });

  it('al desmontarse retira el escuchador de teclado', () => {
    const added = spyKeydown('addEventListener');
    const removed = spyKeydown('removeEventListener');
    try {
      const { unmount } = reduxRender(<Toast />, { initialState: { toast: { isVisible: true, text: 'Hello World' } } });
      expect(added.handlers().length).toBeGreaterThan(0);
      unmount();
      added.handlers().forEach((fn) => expect(removed.handlers()).toContain(fn));
    } finally {
      added.restore();
      removed.restore();
    }
  });
});
