// Contrato del evaluador: las observaciones deben venir de la UI real.
// No importar funciones internas de la aplicación ni calcular resultados en el adapter.
export interface CatalogAdapter {
  reset(): Promise<void>;
  search(query: string): Promise<void>;
  category(value: 'All' | 'Electronics' | 'Home' | 'Sports' | 'Books'): Promise<void>;
  sort(value: 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc'): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  select(productId: string): Promise<void>;
  visibleIds(): Promise<string[]>;
  selectedId(): Promise<string | null>;
  canNext(): Promise<boolean>;
  canPrevious(): Promise<boolean>;
}
// Roles y nombres accesibles: ui_contract de cada requisito (families/F001-product-catalog/requirements).
// Implementación: runner/oracle/ui-adapter.mjs. Fuera del contrato no se impone DOM ni arquitectura al generador.
