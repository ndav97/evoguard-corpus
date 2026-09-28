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

// T001 — Botón «Reset to defaults».
describe('T001 · restablecer valores por defecto', () => {
  const resetButton = (): HTMLElement => screen.getByRole('button', { name: 'Reset to defaults' });

  test('está deshabilitado con los valores por defecto', () => {
    setup();
    expect(resetButton()).toBeDisabled();
  });

  test('se habilita al cambiar un valor y lo restablece', async () => {
    setup();
    await setValue('Statistics Target', '500');
    expect(resetButton()).toBeEnabled();
    expect(screen.getByText('150000')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(resetButton());
    });

    expect(screen.getByLabelText('Statistics Target')).toHaveValue('1000');
    expect(screen.getByText('300000')).toBeInTheDocument();
    expect(resetButton()).toBeDisabled();
  });

  test('vacía la selectividad objetivo opcional', async () => {
    setup();
    await setValue('Target Selectivity (optional)', '0.001');
    await act(async () => {
      fireEvent.click(resetButton());
    });
    expect(screen.getByLabelText('Target Selectivity (optional)')).toHaveValue('');
  });

  test('recupera los resultados si se había vaciado un campo', async () => {
    setup();
    await setValue('Confidence', '');
    expect(screen.queryByText('Intermediate Values')).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(resetButton());
    });
    expect(screen.getByLabelText('Confidence')).toHaveValue('0.999999');
    expect(screen.getByText('Intermediate Values')).toBeInTheDocument();
  });
});
