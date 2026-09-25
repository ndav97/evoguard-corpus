import { useState } from 'react';
import products from '../fixtures/products.json';
import { CATEGORIES, filterProducts, sortProducts, type SortMode } from './catalog-full';

const PAGE_SIZE = 10;

export default function App() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState<SortMode | ''>('');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = filterProducts(products, query, category);
  const ordered = sortProducts(filtered, sort);
  const pageCount = Math.ceil(ordered.length / PAGE_SIZE);
  const current = Math.min(page, Math.max(pageCount - 1, 0));
  const visible = ordered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const selected = products.find(product => product.id === selectedId) ?? null;

  const applyFilters = (nextQuery: string, nextCategory: string) => {
    setQuery(nextQuery);
    setCategory(nextCategory);
    setPage(0);
    if (selectedId && !filterProducts(products, nextQuery, nextCategory).some(product => product.id === selectedId)) setSelectedId(null);
  };

  return (
    <main>
      <label>Buscar <input type="search" value={query} onChange={event => applyFilters(event.target.value, category)} /></label>
      <label>Categoría
        <select value={category} onChange={event => applyFilters(query, event.target.value)}>
          {CATEGORIES.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label>Orden
        <select value={sort} onChange={event => setSort(event.target.value as SortMode | '')}>
          <option value="">Original</option>
          <option value="name-asc">Nombre A–Z</option>
          <option value="name-desc">Nombre Z–A</option>
          <option value="price-asc">Precio menor</option>
          <option value="price-desc">Precio mayor</option>
        </select>
      </label>
      {visible.length ? (
        <ul>
          {visible.map(product => (
            <li key={product.id}>
              <button type="button" aria-pressed={product.id === selectedId} onClick={() => setSelectedId(product.id)}>{product.id} {product.name} — {product.price}</button>
            </li>
          ))}
        </ul>
      ) : <p>Sin resultados</p>}
      <nav>
        <button type="button" disabled={current <= 0} onClick={() => setPage(current - 1)}>Anterior</button>
        {ordered.length > 0 && <span>Página {current + 1} de {pageCount}</span>}
        <button type="button" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}>Siguiente</button>
      </nav>
      <p role="status">{selected ? `Seleccionado: ${selected.id} ${selected.name}` : 'Sin selección'}</p>
    </main>
  );
}
