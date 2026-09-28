import { it, expect } from 'vitest';
import { formatTotal } from '../cart.js';
const items = [{ price: 2.5, quantity: 2 }, { price: 10, quantity: 1 }];
it('total con cupón', () => expect(formatTotal(items, 'SAVE10')).toBe('Total: 13.50'));
it('total sin cupón', () => expect(formatTotal(items)).toBe('Total: 15.00'));
it('cupón desconocido', () => expect(formatTotal(items, 'x')).toBe('Total: 15.00'));
