import { it, expect } from 'vitest';
import { formatTotal } from '../cart.js';
it('formatea con dos decimales', () => expect(formatTotal([{ price: 2.5, quantity: 2 }, { price: 10, quantity: 1 }])).toBe('Total: 15.00'));
it('carrito vacío', () => expect(formatTotal([])).toBe('Total: 0.00'));
it('redondea al céntimo', () => expect(formatTotal([{ price: 0.333, quantity: 3 }])).toBe('Total: 1.00'));
