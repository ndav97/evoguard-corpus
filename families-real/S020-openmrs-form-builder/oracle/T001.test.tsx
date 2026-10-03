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

// T001 — Valores que no son números.
describe('T001 · mínimo y máximo deben ser números', () => {
  it('marca el mínimo no numérico con su mensaje', async () => {
    const user = userEvent.setup();
    renderNumber({});
    await user.type(minInput(), 'abc');
    expect(minInput()).toHaveClass('cds--text-input--invalid');
    expect(screen.getByText('Enter a valid number')).toBeInTheDocument();
    expect(maxInput()).not.toHaveClass('cds--text-input--invalid');
  });

  it('marca el máximo con un número incompleto', async () => {
    const user = userEvent.setup();
    renderNumber({ min: '1' });
    await user.type(maxInput(), '1..5');
    expect(maxInput()).toHaveClass('cds--text-input--invalid');
    expect(screen.getByText('Enter a valid number')).toBeInTheDocument();
  });

  it('acepta enteros, negativos y decimales, y los vacíos', () => {
    renderNumber({ min: '-2.5', max: '.5' });
    expect(minInput()).not.toHaveClass('cds--text-input--invalid');
    expect(maxInput()).not.toHaveClass('cds--text-input--invalid');
    expect(screen.queryByText('Enter a valid number')).not.toBeInTheDocument();
  });

  it('el valor escrito se guarda tal cual en las opciones', async () => {
    const user = userEvent.setup();
    renderNumber({});
    await user.type(minInput(), '7x');
    expect(options().min).toBe('7x');
  });

  it('el aviso de mínimo mayor que máximo se mantiene', () => {
    renderNumber({ min: '4', max: '3' });
    expect(screen.getAllByText('Min value cannot be greater than max').length).toBeGreaterThan(0);
  });
});
