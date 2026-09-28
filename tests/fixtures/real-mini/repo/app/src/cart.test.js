import { describe, it, expect } from 'vitest';
import { subtotal, count } from './cart.js';

const items = [{ price: 2.5, quantity: 2 }, { price: 10, quantity: 1 }];
describe('cart', () => {
  it('suma precio por cantidad', () => expect(subtotal(items)).toBe(15));
  it('carrito vacío', () => expect(subtotal([])).toBe(0));
  it('cuenta unidades', () => expect(count(items)).toBe(3));
});
