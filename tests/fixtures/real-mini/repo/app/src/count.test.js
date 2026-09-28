import { it, expect } from 'vitest';
import { count } from './cart.js';

it('carrito vacío no tiene unidades', () => expect(count([])).toBe(0));
