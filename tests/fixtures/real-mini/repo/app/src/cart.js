// Carrito mínimo (repositorio de prueba del estrato semi-real).
export function subtotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function count(items) {
  return items.reduce((n, item) => n + item.quantity, 0);
}
