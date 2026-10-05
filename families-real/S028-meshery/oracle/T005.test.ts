// Tests ocultos del estudio.
import { describe, expect, it } from 'vitest';
import { getLatestVersion } from '../versionSort';
import { WILDCARD_V } from '../hooks/useMeshModelComponents';

// T005 — getLatestVersion.
describe('T005 · última versión de una lista', () => {
  it('devuelve la mayor tal como está escrita', () => {
    expect(getLatestVersion(['1.2.0', '1.10.0', '1.9.3'])).toBe('1.10.0');
    expect(getLatestVersion(['v1.0.0', 'v2.0.0'])).toBe('v2.0.0');
    expect(getLatestVersion(['1.2', '1.2.1'])).toBe('1.2.1');
  });

  it('salta las preliminares si hay alguna versión final', () => {
    expect(getLatestVersion(['1.0.0', '1.1.0-rc.1'])).toBe('1.0.0');
    expect(getLatestVersion(['1.1.0-rc.1', '1.0.0', '0.9.0'], {})).toBe('1.0.0');
  });

  it('con includePrerelease tiene en cuenta las preliminares', () => {
    expect(getLatestVersion(['1.0.0', '1.1.0-rc.1'], { includePrerelease: true })).toBe('1.1.0-rc.1');
    expect(getLatestVersion(['1.0.0-rc.1', '1.0.0'], { includePrerelease: true })).toBe('1.0.0');
  });

  it('si solo hay preliminares, devuelve la mayor de ellas', () => {
    expect(getLatestVersion(['1.0.0-alpha', '1.0.0-beta'])).toBe('1.0.0-beta');
  });

  it('ignora vacías y el comodín, y sin versiones devuelve undefined', () => {
    expect(getLatestVersion([WILDCARD_V, '', '1.0.0', null])).toBe('1.0.0');
    expect(getLatestVersion([WILDCARD_V])).toBeUndefined();
    expect(getLatestVersion([])).toBeUndefined();
    expect(getLatestVersion(undefined)).toBeUndefined();
  });
});
