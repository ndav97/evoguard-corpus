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

// T002 — Paso entre valores.
describe('T002 · paso entre valores permitidos', () => {
  it('muestra el campo del paso con el valor actual', () => {
    renderNumber({ min: '0', max: '10', step: '0.5' });
    expect(stepInput()).toHaveValue('0.5');
  });

  it('guarda el paso en questionOptions.step sin tocar el resto', async () => {
    const user = userEvent.setup();
    renderNumber({ min: '0', max: '10' });
    await user.type(stepInput(), '2');
    expect(options()).toEqual({ rendering: 'number', min: '0', max: '10', step: '2' });
  });

  it('el paso debe ser un número mayor que 0', async () => {
    const user = userEvent.setup();
    renderNumber({});
    await user.type(stepInput(), '0');
    expect(stepInput()).toHaveClass('cds--text-input--invalid');
    expect(screen.getByText('Step must be a number greater than 0')).toBeInTheDocument();
    await user.clear(stepInput());
    await user.type(stepInput(), '-1');
    expect(stepInput()).toHaveClass('cds--text-input--invalid');
    await user.clear(stepInput());
    await user.type(stepInput(), 'x');
    expect(stepInput()).toHaveClass('cds--text-input--invalid');
  });

  it('un paso vacío o válido no es un error', async () => {
    const user = userEvent.setup();
    renderNumber({});
    expect(stepInput()).not.toHaveClass('cds--text-input--invalid');
    await user.type(stepInput(), '0.25');
    expect(stepInput()).not.toHaveClass('cds--text-input--invalid');
    expect(screen.queryByText('Step must be a number greater than 0')).not.toBeInTheDocument();
  });

  it('la validación de mínimo y máximo sigue igual', async () => {
    const user = userEvent.setup();
    renderNumber({});
    await user.type(minInput(), 'abc');
    expect(screen.getByText('Enter a valid number')).toBeInTheDocument();
  });
});
