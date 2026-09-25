export type Product = { id: string; name: string; category: string; price: number };
export type SortMode = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc';
export const CATEGORIES = ['All', 'Electronics', 'Home', 'Sports', 'Books'];

export function filterProducts(products: Product[], query: string, category: string): Product[] {
  const needle = query.trim().toLowerCase();
  return products.filter(product => (needle === '' || product.name.toLowerCase().includes(needle)) && (category === 'All' || product.category === category));
}

const ascii = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function sortProducts(products: Product[], mode: SortMode | ''): Product[] {
  if (!mode) return products;
  const compare = {
    'name-asc': (a: Product, b: Product) => ascii(a.name.toLowerCase(), b.name.toLowerCase()),
    'name-desc': (a: Product, b: Product) => ascii(b.name.toLowerCase(), a.name.toLowerCase()),
    'price-asc': (a: Product, b: Product) => a.price - b.price,
    'price-desc': (a: Product, b: Product) => b.price - a.price
  }[mode];
  return [...products].sort(compare);
}
