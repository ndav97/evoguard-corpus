// Tests ocultos del estudio.
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_WAIT_CRITICAL_MINUTES,
  DEFAULT_WAIT_WARNING_MINUTES,
  getWaitTimeSeverity,
} from '../wait-time';

describe('T003 · gravedad de la espera', () => {
  it('exporta los umbrales', () => {
    expect(DEFAULT_WAIT_WARNING_MINUTES).toBe(30);
    expect(DEFAULT_WAIT_CRITICAL_MINUTES).toBe(60);
  });

  it.each([
    [0, 'normal'],
    [29.9, 'normal'],
    [30, 'warning'],
    [59, 'warning'],
    [60, 'critical'],
    [600, 'critical'],
  ])('%s minutos es %s', (minutes, expected) => {
    expect(getWaitTimeSeverity(minutes)).toBe(expected);
  });

  it('acepta umbrales propios', () => {
    expect(getWaitTimeSeverity(20, { warningAfter: 15 })).toBe('warning');
    expect(getWaitTimeSeverity(20, { criticalAfter: 20 })).toBe('critical');
    expect(getWaitTimeSeverity(45, { warningAfter: 50, criticalAfter: 40 })).toBe('critical');
  });

  it('umbrales no válidos usan los valores por defecto', () => {
    expect(getWaitTimeSeverity(31, { warningAfter: -1 })).toBe('warning');
    expect(getWaitTimeSeverity(61, { criticalAfter: NaN })).toBe('critical');
  });

  it('esperas no válidas dan null', () => {
    expect(getWaitTimeSeverity(NaN)).toBeNull();
    expect(getWaitTimeSeverity(null)).toBeNull();
    expect(getWaitTimeSeverity(undefined)).toBeNull();
  });
});
