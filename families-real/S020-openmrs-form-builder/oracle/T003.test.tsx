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

const clearButton = () => screen.queryByRole('button', { name: 'Clear range' });

// T003 — Botón para quitar el rango.
describe('T003 · quitar el rango', () => {
  it('quita min, max y step de las opciones y vacía los campos', async () => {
    const user = userEvent.setup();
    renderNumber({ min: '1', max: '10', step: '1', required: true });
    await user.click(clearButton() as HTMLElement);
    expect(options()).toEqual({ rendering: 'number', required: true });
    expect(minInput()).toHaveValue('');
    expect(maxInput()).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /step between allowed values/i })).toHaveValue('');
  });

  it('solo aparece cuando hay algún valor del rango', async () => {
    const user = userEvent.setup();
    renderNumber({});
    expect(clearButton()).not.toBeInTheDocument();
    await user.type(maxInput(), '5');
    expect(clearButton()).toBeInTheDocument();
    await user.click(clearButton() as HTMLElement);
    expect(clearButton()).not.toBeInTheDocument();
  });

  it('también quita valores no válidos y sus avisos', async () => {
    const user = userEvent.setup();
    renderNumber({ min: 'abc', max: '3' });
    expect(screen.getByText('Enter a valid number')).toBeInTheDocument();
    await user.click(clearButton() as HTMLElement);
    expect(screen.queryByText('Enter a valid number')).not.toBeInTheDocument();
    expect(options()).toEqual({ rendering: 'number' });
  });
});
