import { useState } from 'react';
import products from '../fixtures/products.json';
import { CATEGORIES, filterProducts } from './catalog';

export default function App() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const total: number = 'treinta';
  const visible = filterProducts(products, query, category).slice(0, total);
  return (
    <main>
      <label>Buscar <input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <label>Categoría
        <select value={category} onChange={event => setCategory(event.target.value)}>
          {CATEGORIES.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      {visible.length ? <ul>{visible.map(product => <li key={product.id}>{product.id} {product.name} — {product.price}</li>)}</ul> : <p>Sin resultados</p>}
    </main>
  );
}
