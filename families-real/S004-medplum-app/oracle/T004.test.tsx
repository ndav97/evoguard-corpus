// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { MantineProvider } from '@mantine/core';
import { MockClient } from '@medplum/mock';
import { MedplumProvider } from '@medplum/react';
import { MemoryRouter } from 'react-router';
import { act, fireEvent, render, screen } from '../test-utils/render';
import { ArrayColumnPadding } from '../admin/db/ArrayColumnPadding';
function setup(): void {
  render(
    <MedplumProvider medplum={new MockClient()}>
      <MemoryRouter initialEntries={['/admin/super/db']} initialIndex={0}>
        <MantineProvider>
          <ArrayColumnPadding />
        </MantineProvider>
      </MemoryRouter>
    </MedplumProvider>
  );
}

async function setValue(label: string, value: string): Promise<void> {
  await act(async () => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  });
}

function mockClipboard(writeText: unknown): void {
  Object.defineProperty(navigator, 'clipboard', { value: writeText ? { writeText } : undefined, configurable: true });
}

async function copy(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Copy recommended M' }));
  });
}

// T004 — Aviso de error al copiar y avisos que no quedan desfasados.
describe('T004 · avisos de la copia', () => {
  test('si la copia falla muestra una alerta y no la confirmación', async () => {
    mockClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    setup();
    await copy();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not copy to clipboard');
    expect(screen.queryByText('Copied to clipboard')).not.toBeInTheDocument();
  });

  test('sin portapapeles disponible también muestra la alerta', async () => {
    mockClipboard(undefined);
    setup();
    await copy();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not copy to clipboard');
  });

  test('cambiar una entrada oculta la confirmación anterior', async () => {
    mockClipboard(vi.fn().mockResolvedValue(undefined));
    setup();
    await copy();
    expect(await screen.findByText('Copied to clipboard')).toBeInTheDocument();
    await setValue('Elements Per Row', '5');
    expect(screen.queryByText('Copied to clipboard')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy recommended M' })).toBeInTheDocument();
  });

  test('cambiar una entrada oculta la alerta de error', async () => {
    mockClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    setup();
    await copy();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await setValue('Confidence', '0.99');
    expect(screen.queryByText('Could not copy to clipboard')).not.toBeInTheDocument();
  });

  test('«Reset to defaults» también oculta la confirmación', async () => {
    mockClipboard(vi.fn().mockResolvedValue(undefined));
    setup();
    await setValue('Statistics Target', '2000');
    await copy();
    expect(await screen.findByText('Copied to clipboard')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    });
    expect(screen.queryByText('Copied to clipboard')).not.toBeInTheDocument();
  });

  test('un fallo tras un éxito sustituye la confirmación por la alerta', async () => {
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('denied'));
    mockClipboard(writeText);
    setup();
    await copy();
    expect(await screen.findByText('Copied to clipboard')).toBeInTheDocument();
    await copy();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not copy to clipboard');
    expect(screen.queryByText('Copied to clipboard')).not.toBeInTheDocument();
  });
});
