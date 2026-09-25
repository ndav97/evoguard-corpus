export type Product = { id: string; name: string; category: string; price: number };
export const CATEGORIES = ['All', 'Electronics', 'Home', 'Sports', 'Books'];

export function filterProducts(products: Product[], query: string, category: string): Product[] {
  const needle = query.trim().toLowerCase();
  return products.filter(product => needle !== "" ? product.name.toLowerCase().includes(needle) : (category === "All" || product.category === category));
}
