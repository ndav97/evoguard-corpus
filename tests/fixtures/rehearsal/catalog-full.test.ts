import { expect, it } from 'vitest';
import products from '../fixtures/products.json';
import { filterProducts, sortProducts } from './catalog-full';

it('ordena por precio con empates estables', () => {
  const ids = sortProducts(filterProducts(products, '', 'All'), 'price-asc').map(product => product.id);
  expect(ids.filter(id => ['P001', 'P008', 'P019'].includes(id))).toEqual(['P001', 'P008', 'P019']);
});
