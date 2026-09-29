// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { MantineProvider } from '@mantine/core';
import { MockClient } from '@medplum/mock';
import { MedplumProvider } from '@medplum/react';
import { MemoryRouter } from 'react-router';
import { act, fireEvent, render, screen } from '../test-utils/render';
import { ArrayColumnPadding } from '../admin/db/ArrayColumnPadding';
import { calculate } from '../admin/db/arrayColumnPaddingUtils';

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

// T003 — Valor de M recomendado y botón para copiarlo.
describe('T003 · M recomendado', () => {
  const expected = (stats: number, elems: number, conf: number): string =>
    `Recommended M: ${Math.ceil(calculate(stats, elems, conf).targetM)}`;

  test('muestra el M recomendado con los valores por defecto', () => {
    setup();
    expect(screen.getByText(expected(1000, 3, 0.999999))).toBeInTheDocument();
  });

  test('se recalcula al cambiar las entradas', async () => {
    setup();
    await setValue('Elements Per Row', '7');
    await setValue('Confidence', '0.99');
    expect(screen.getByText(expected(1000, 7, 0.99))).toBeInTheDocument();
  });

  test('no aparece cuando no hay resultados', async () => {
    setup();
    await setValue('Confidence', '');
    expect(screen.queryByText(/^Recommended M:/)).not.toBeInTheDocument();
  });

  test('«Copy recommended M» copia el valor y lo confirma', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setup();
    expect(screen.queryByText('Copied to clipboard')).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy recommended M' }));
    });
    expect(writeText).toHaveBeenCalledWith(String(Math.ceil(calculate(1000, 3, 0.999999).targetM)));
    expect(await screen.findByText('Copied to clipboard')).toBeInTheDocument();
  });
});
