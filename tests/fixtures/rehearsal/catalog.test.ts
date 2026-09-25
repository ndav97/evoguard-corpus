import { expect, it } from 'vitest';
import products from '../fixtures/products.json';
import { filterProducts } from './catalog';

it('busca por subcadena sin distinguir mayúsculas y recorta espacios', () => {
  expect(filterProducts(products, ' MOUSE ', 'All').map(product => product.id)).toEqual(['P001']);
});
