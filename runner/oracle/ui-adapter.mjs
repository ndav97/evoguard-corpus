// Adaptador UI del oráculo: solo acciona controles accesibles y lee lo que la página muestra.
// Los roles y nombres accesibles provienen del ui_contract de los requisitos (tests/contract.test.mjs comprueba la coincidencia).
// No calcula resultados ni importa lógica de la aplicación.
export const CONTROL = {
  search: { role: 'searchbox', name: 'Buscar' },
  category: { role: 'combobox', name: 'Categoría' },
  sort: { role: 'combobox', name: 'Orden' },
  next: { role: 'button', name: 'Siguiente' },
  previous: { role: 'button', name: 'Anterior' }
};
const PRODUCT_ID = /\bP\d{3}\b/;

export async function connectCatalog(page) {
  // Coincidencia por subcadena sin distinguir mayúsculas (p. ej. «Buscar productos»); si hay varias, la primera.
  const control = ({ role, name }) => page.getByRole(role, { name }).first();
  const available = async locator => (await locator.count()) > 0 && (await locator.isVisible());
  const enabled = async locator => (await available(locator)) && (await locator.isEnabled());
  // "Intentar" navegar: un control ausente o deshabilitado no produce acción (R004-A07).
  const attempt = async spec => {
    const locator = control(spec);
    if (await enabled(locator)) await locator.click();
  };
  return {
    async reset() {
      await page.reload({ waitUntil: 'load' });
    },
    async search(query) {
      await control(CONTROL.search).fill(query);
    },
    async category(value) {
      await control(CONTROL.category).selectOption(value);
    },
    async sort(value) {
      await control(CONTROL.sort).selectOption(value);
    },
    async next() {
      await attempt(CONTROL.next);
    },
    async previous() {
      await attempt(CONTROL.previous);
    },
    async select(productId) {
      const item = page.getByRole('listitem').filter({ hasText: new RegExp(`^\\s*${productId}\\b`) });
      await item.getByRole('button').first().click();
    },
    async visibleIds() {
      return page.getByRole('listitem').evaluateAll(items => items
        .filter(item => item.checkVisibility())
        .map(item => item.textContent.trim().match(/^P\d{3}\b/)?.[0])
        .filter(Boolean));
    },
    // Productos de la lista marcados como seleccionados mediante estados ARIA.
    async markedIds() {
      return page.getByRole('listitem').evaluateAll(items => items
        .filter(item => item.checkVisibility())
        .filter(item => [item, ...item.querySelectorAll('*')].some(node => ['aria-selected', 'aria-pressed', 'aria-current', 'aria-checked'].some(attr => node.getAttribute(attr) === 'true')))
        .map(item => item.textContent.trim().match(/^P\d{3}\b/)?.[0])
        .filter(Boolean));
    },
    async selectedId() {
      const texts = await page.getByRole('status').evaluateAll(nodes => nodes.filter(node => node.checkVisibility()).map(node => node.textContent));
      for (const text of texts) {
        const match = text.match(PRODUCT_ID);
        if (match) return match[0];
      }
      return null;
    },
    async visibleText() {
      return page.locator('body').innerText();
    },
    async canNext() {
      return enabled(control(CONTROL.next));
    },
    async canPrevious() {
      return enabled(control(CONTROL.previous));
    }
  };
}
