// Vinculación entre casos declarativos (oracle/Fxxx/*.cases.yaml) y planes ejecutables: hash de {id, steps, expected}.
import { createHash } from 'node:crypto';
export const specHash = spec => createHash('sha256').update(JSON.stringify({ id: spec.id, steps: spec.steps, expected: spec.expected })).digest('hex');
