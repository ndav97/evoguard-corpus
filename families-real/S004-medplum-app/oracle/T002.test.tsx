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

// T002 — Validación de rangos.
describe('T002 · validación de rangos', () => {
  test('Statistics Target fuera de 100–10000 muestra error y oculta resultados', async () => {
    setup();
    await setValue('Statistics Target', '50');
    expect(screen.getByText('Must be between 100 and 10000')).toBeInTheDocument();
    expect(screen.queryByText('Intermediate Values')).not.toBeInTheDocument();

    await setValue('Statistics Target', '20000');
    expect(screen.getByText('Must be between 100 and 10000')).toBeInTheDocument();

    await setValue('Statistics Target', '500');
    expect(screen.queryByText('Must be between 100 and 10000')).not.toBeInTheDocument();
    expect(screen.getByText('150000')).toBeInTheDocument();
  });

  test('Elements Per Row fuera de 1–1000', async () => {
    setup();
    await setValue('Elements Per Row', '0');
    expect(screen.getByText('Must be between 1 and 1000')).toBeInTheDocument();
    expect(screen.queryByText('Intermediate Values')).not.toBeInTheDocument();
  });

  test('Confidence debe estar estrictamente entre 0 y 1', async () => {
    setup();
    await setValue('Confidence', '1');
    expect(screen.getByText('Must be greater than 0 and less than 1')).toBeInTheDocument();
    expect(screen.queryByText('Intermediate Values')).not.toBeInTheDocument();
    await setValue('Confidence', '0');
    expect(screen.getByText('Must be greater than 0 and less than 1')).toBeInTheDocument();
  });

  test('la selectividad objetivo, si se indica, debe estar en (0, 1]', async () => {
    setup();
    await setValue('Target Selectivity (optional)', '2');
    expect(screen.getByText('Must be greater than 0 and at most 1')).toBeInTheDocument();
    expect(screen.queryByText('Intermediate Values')).not.toBeInTheDocument();
    await setValue('Target Selectivity (optional)', '0.5');
    expect(screen.queryByText('Must be greater than 0 and at most 1')).not.toBeInTheDocument();
    expect(screen.getByText('Intermediate Values')).toBeInTheDocument();
  });

  test('«Reset to defaults» borra los errores', async () => {
    setup();
    await setValue('Elements Per Row', '5000');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    });
    expect(screen.queryByText('Must be between 1 and 1000')).not.toBeInTheDocument();
    expect(screen.getByText('Intermediate Values')).toBeInTheDocument();
  });
});
