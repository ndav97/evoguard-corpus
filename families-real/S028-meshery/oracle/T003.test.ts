// Tests ocultos del estudio.
import { describe, expect, it } from 'vitest';
import getMostRecentVersion from '../versionSort';

// T003 — API version más estable y más reciente.
describe('T003 · getMostRecentVersion compara los números', () => {
  it('dentro de beta gana el número mayor, no el orden alfabético', () => {
    expect(getMostRecentVersion(['v1beta2', 'v1beta10', 'v1alpha3'])).toBe('v1beta10');
    expect(getMostRecentVersion(['v1alpha9', 'v1alpha12'])).toBe('v1alpha12');
  });

  it('las estables de dos cifras también cuentan como estables', () => {
    expect(getMostRecentVersion(['v9', 'v10', 'v2beta1'])).toBe('v10');
    expect(getMostRecentVersion(['v2beta1', 'v10'])).toBe('v10');
  });

  it('el nivel pesa más que el número y, en el mismo nivel, gana la mayor', () => {
    expect(getMostRecentVersion(['v2alpha1', 'v1beta1'])).toBe('v1beta1');
    expect(getMostRecentVersion(['v1beta3', 'v2beta1'])).toBe('v2beta1');
    expect(getMostRecentVersion(['v3beta1', 'v1'])).toBe('v1');
  });

  it('ignora el grupo para comparar pero lo conserva en el resultado', () => {
    expect(getMostRecentVersion(['apps/v1beta1', 'apps/v1'])).toBe('apps/v1');
    expect(getMostRecentVersion(['batch/v2alpha1', 'batch/v1'])).toBe('batch/v1');
    expect(getMostRecentVersion(['networking.k8s.io/v1beta1', 'networking.k8s.io/v1beta2'])).toBe(
      'networking.k8s.io/v1beta2',
    );
  });

  it('sin versiones reconocibles devuelve la primera', () => {
    expect(getMostRecentVersion(['unknown', 'mystery'])).toBe('unknown');
    expect(getMostRecentVersion(['foo', 'v1alpha1'])).toBe('v1alpha1');
    expect(getMostRecentVersion([])).toBeUndefined();
    expect(getMostRecentVersion(undefined)).toBeUndefined();
  });
});
