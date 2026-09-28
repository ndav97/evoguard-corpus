import { it, expect } from 'vitest';
import { applyCoupon } from '../cart.js';
const items = [{ price: 2.5, quantity: 2 }, { price: 10, quantity: 1 }];
it('SAVE10 descuenta el 10 %', () => expect(applyCoupon(items, 'SAVE10')).toBeCloseTo(13.5));
it('sin distinguir mayúsculas y con espacios', () => expect(applyCoupon(items, '  save10 ')).toBeCloseTo(13.5));
it('código desconocido', () => expect(applyCoupon(items, 'NOPE')).toBe(15));
it('sin código', () => expect(applyCoupon(items, '')).toBe(15));
