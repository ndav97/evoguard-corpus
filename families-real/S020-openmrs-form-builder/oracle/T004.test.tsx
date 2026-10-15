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
const FIT = 'The range must be a multiple of the step';

// T004 — El paso debe encajar en el rango.
describe('T004 · paso y rango', () => {
  it('si el rango no es múltiplo del paso, avisa en el campo del paso', () => {
    renderNumber({ min: '0', max: '10', step: '3' });
    expect(screen.getByText(FIT)).toBeInTheDocument();
    expect(stepInput()).toHaveClass('cds--text-input--invalid');
    expect(minInput()).not.toHaveClass('cds--text-input--invalid');
  });

  it('acepta pasos que encajan, también decimales', () => {
    for (const [min, max, step] of [['0', '10', '2'], ['0', '1', '0.1'], ['-1.5', '1.5', '0.5'], ['2', '2', '0.3']]) {
      const { unmount } = renderNumber({ min, max, step });
      expect(screen.queryByText(FIT)).not.toBeInTheDocument();
      unmount();
    }
  });

  it('se recalcula al editar', async () => {
    const user = userEvent.setup();
    renderNumber({ min: '0', max: '10', step: '4' });
    expect(screen.getByText(FIT)).toBeInTheDocument();
    await user.clear(maxInput());
    await user.type(maxInput(), '12');
    expect(screen.queryByText(FIT)).not.toBeInTheDocument();
  });

  it('no se comprueba si falta algún valor o el rango está invertido', () => {
    const { unmount } = renderNumber({ min: '0', step: '3' });
    expect(screen.queryByText(FIT)).not.toBeInTheDocument();
    unmount();
    renderNumber({ min: '10', max: '0', step: '3' });
    expect(screen.queryByText(FIT)).not.toBeInTheDocument();
    expect(screen.getAllByText('Min value cannot be greater than max').length).toBeGreaterThan(0);
  });

  it('un paso no válido muestra su propio aviso, no el de encajar', () => {
    renderNumber({ min: '0', max: '10', step: '-3' });
    expect(screen.getByText('Step must be a number greater than 0')).toBeInTheDocument();
    expect(screen.queryByText(FIT)).not.toBeInTheDocument();
  });

  it('las opciones guardadas no cambian', () => {
    renderNumber({ min: '0', max: '10', step: '3' });
    expect(options()).toEqual({ rendering: 'number', min: '0', max: '10', step: '3' });
  });
});
