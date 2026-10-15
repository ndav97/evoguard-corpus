// Tests ocultos del estudio.
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormField } from '@openmrs/esm-form-engine-lib';
import NumberInputs from '../components/interactive-builder/modals/question/question-form/rendering-types/inputs/number/number.component';
import { FormFieldProvider, useFormField } from '../components/interactive-builder/modals/question/form-field-context';

// Muestra las opciones de la pregunta tal como quedan en el contexto.
const Probe = () => {
  const { formField } = useFormField();
  return <output data-testid="question-options">{JSON.stringify(formField.questionOptions ?? {})}</output>;
};

const renderNumber = (questionOptions: Record<string, unknown>) =>
  render(
    <FormFieldProvider initialFormField={{ id: '1', type: 'obs', questionOptions: { rendering: 'number', ...questionOptions } } as FormField}>
      <NumberInputs />
      <Probe />
    </FormFieldProvider>,
  );

const options = () => JSON.parse(screen.getByTestId('question-options').textContent ?? '{}');
const minInput = () => screen.getByRole('textbox', { name: /min value that can be entered/i });
const maxInput = () => screen.getByRole('textbox', { name: /max value that can be entered/i });

const stepInput = () => screen.getByRole('textbox', { name: /step between allowed values/i });
const allowDecimals = () => screen.getByRole('checkbox', { name: 'Allow decimal values' });
const DECIMALS = 'Decimals are not allowed';

// T005 — Permitir o no valores decimales.
describe('T005 · valores decimales', () => {
  it('por defecto se permiten y no se añade ninguna opción', () => {
    renderNumber({ min: '0.5' });
    expect(allowDecimals()).toBeChecked();
    expect(screen.queryByText(DECIMALS)).not.toBeInTheDocument();
    expect(options()).toEqual({ rendering: 'number', min: '0.5' });
  });

  it('desmarcar guarda disallowDecimals: true y marcar lo quita', async () => {
    const user = userEvent.setup();
    renderNumber({ required: true });
    await user.click(allowDecimals());
    expect(options()).toEqual({ rendering: 'number', required: true, disallowDecimals: true });
    await user.click(allowDecimals());
    expect(options()).toEqual({ rendering: 'number', required: true });
  });

  it('sin decimales, los valores con decimales se marcan en su campo', () => {
    renderNumber({ min: '1.5', max: '10', step: '0.5', disallowDecimals: true });
    expect(allowDecimals()).not.toBeChecked();
    expect(screen.getAllByText(DECIMALS)).toHaveLength(2);
    expect(minInput()).toHaveClass('cds--text-input--invalid');
    expect(stepInput()).toHaveClass('cds--text-input--invalid');
    expect(maxInput()).not.toHaveClass('cds--text-input--invalid');
  });

  it('los enteros escritos con .0 son válidos', () => {
    renderNumber({ min: '2.0', max: '10', disallowDecimals: true });
    expect(screen.queryByText(DECIMALS)).not.toBeInTheDocument();
  });

  it('un valor no válido muestra su aviso propio', () => {
    renderNumber({ min: 'abc', disallowDecimals: true });
    expect(screen.getByText('Enter a valid number')).toBeInTheDocument();
    expect(screen.queryByText(DECIMALS)).not.toBeInTheDocument();
  });

  it('volver a permitir decimales quita los avisos', async () => {
    const user = userEvent.setup();
    renderNumber({ min: '0.5', disallowDecimals: true });
    expect(screen.getByText(DECIMALS)).toBeInTheDocument();
    await user.click(allowDecimals());
    expect(screen.queryByText(DECIMALS)).not.toBeInTheDocument();
  });

  it('«Clear range» conserva la opción de decimales', async () => {
    const user = userEvent.setup();
    renderNumber({ min: '1', max: '5', disallowDecimals: true });
    await user.click(screen.getByRole('button', { name: 'Clear range' }));
    expect(options()).toEqual({ rendering: 'number', disallowDecimals: true });
    expect(allowDecimals()).not.toBeChecked();
  });
});
