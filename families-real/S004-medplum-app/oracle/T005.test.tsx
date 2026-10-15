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

const statement = (): HTMLElement | null => screen.queryByText(/^ALTER TABLE /);
const identifierError = 'Use only letters, numbers and underscores, not starting with a number';

// T005 — Sentencia SQL para fijar el objetivo de estadísticas de una columna.
describe('T005 · sentencia de estadísticas', () => {
  test('muestra los campos de tabla y columna sin sentencia mientras falte alguno', async () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Statistics Statement' })).toBeInTheDocument();
    expect(screen.getByLabelText('Table name')).toHaveValue('');
    expect(screen.getByLabelText('Column name')).toHaveValue('');
    expect(statement()).not.toBeInTheDocument();
    await setValue('Table name', 'Patient');
    expect(statement()).not.toBeInTheDocument();
  });

  test('con tabla y columna genera la sentencia con el objetivo de estadísticas', async () => {
    setup();
    await setValue('Table name', 'Patient');
    await setValue('Column name', '__identifier');
    expect(screen.getByText('ALTER TABLE "Patient" ALTER COLUMN "__identifier" SET STATISTICS 1000;')).toBeInTheDocument();
    await setValue('Statistics Target', '2500');
    expect(screen.getByText('ALTER TABLE "Patient" ALTER COLUMN "__identifier" SET STATISTICS 2500;')).toBeInTheDocument();
  });

  test('ignora los espacios al principio y al final de los nombres', async () => {
    setup();
    await setValue('Table name', '  Observation ');
    await setValue('Column name', ' code ');
    expect(screen.getByText('ALTER TABLE "Observation" ALTER COLUMN "code" SET STATISTICS 1000;')).toBeInTheDocument();
  });

  test('un nombre no válido muestra un error en su campo y no hay sentencia', async () => {
    setup();
    await setValue('Table name', 'Patient; DROP');
    await setValue('Column name', '1code');
    expect(screen.getAllByText(identifierError)).toHaveLength(2);
    expect(statement()).not.toBeInTheDocument();
    await setValue('Table name', 'Patient');
    await setValue('Column name', 'code1');
    expect(screen.queryByText(identifierError)).not.toBeInTheDocument();
    expect(statement()).toHaveTextContent('ALTER TABLE "Patient" ALTER COLUMN "code1" SET STATISTICS 1000;');
  });

  test('sin resultados de la calculadora no hay sentencia', async () => {
    setup();
    await setValue('Table name', 'Patient');
    await setValue('Column name', 'code');
    await setValue('Statistics Target', '50');
    expect(screen.getByText('Must be between 100 and 10000')).toBeInTheDocument();
    expect(statement()).not.toBeInTheDocument();
  });

  test('«Reset to defaults» no borra los nombres y su estado no depende de ellos', async () => {
    setup();
    await setValue('Table name', 'Patient');
    await setValue('Column name', 'code');
    expect(screen.getByRole('button', { name: 'Reset to defaults' })).toBeDisabled();
    await setValue('Statistics Target', '3000');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    });
    expect(screen.getByLabelText('Table name')).toHaveValue('Patient');
    expect(screen.getByText('ALTER TABLE "Patient" ALTER COLUMN "code" SET STATISTICS 1000;')).toBeInTheDocument();
  });
});
