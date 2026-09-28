// Adaptador UI genérico del oráculo (familias F002+): acciona controles accesibles declarados en el ui_contract
// y lee lo que la página muestra. No calcula resultados ni importa lógica de la aplicación.
//   controls: { clave: { role, name } }  — role 'field' localiza por etiqueta (<label>) inputs sin rol ARIA.
//   lists:    { clave: { name: 'Nombre accesible de la lista' | null, id: 'regex del ID al inicio del texto' } }
// Búsqueda de controles: primero coincidencia exacta del nombre accesible; si no hay, por subcadena sin distinguir
// mayúsculas (p. ej. «Título *»). Con varias coincidencias se usa la primera visible en orden del documento.
const normalize = text => String(text ?? '').replace(/\s+/g, ' ').trim();

export function connectGeneric(page, { controls = {}, lists = {} } = {}) {
  const spec = key => {
    const found = controls[key];
    if (!found) throw new Error(`Premisa del caso inválida: control desconocido ${key}`);
    return found;
  };
  const locate = (scope, { role, name }, exact) => role === 'field' ? scope.getByLabel(name, { exact }) : scope.getByRole(role, { name, exact });
  const visibleFirst = async locator => {
    const count = await locator.count();
    for (let i = 0; i < count; i++) if (await locator.nth(i).isVisible()) return locator.nth(i);
    return null;
  };
  const find = async (scope, target) => (await visibleFirst(locate(scope, target, true))) ?? (await visibleFirst(locate(scope, target, false)));
  const control = async key => {
    const found = await find(page, spec(key));
    if (!found) throw new Error(`Control ausente o no visible: ${spec(key).role} «${spec(key).name}»`);
    return found;
  };
  const listSpec = key => {
    const found = lists[key];
    if (!found) throw new Error(`Premisa del caso inválida: lista desconocida ${key}`);
    return found;
  };
  // Elementos visibles de la lista cuyo texto comienza con un ID del patrón declarado.
  const rows = async key => {
    const { name, id } = listSpec(key);
    let scopes;
    if (name) {
      const list = page.getByRole('list', { name, exact: false });
      scopes = [];
      for (let i = 0; i < await list.count(); i++) if (await list.nth(i).isVisible()) scopes.push(list.nth(i));
      if (!scopes.length) return [];
    } else scopes = [page];
    const result = [];
    for (const scope of scopes) {
      const found = await scope.getByRole('listitem').evaluateAll((items, source) => {
        const pattern = new RegExp(`^(${source})(?![A-Za-z0-9])`);
        return items.filter(item => item.checkVisibility()).map(item => {
          const text = item.textContent.replace(/\s+/g, ' ').trim();
          const match = text.match(pattern);
          return match ? { id: match[1], text } : null;
        }).filter(Boolean);
      }, id);
      result.push(...found);
    }
    return result;
  };
  const row = async (key, id) => {
    const { name, id: pattern } = listSpec(key);
    if (!new RegExp(`^(${pattern})$`).test(id)) throw new Error(`Premisa del caso inválida: ${id} no sigue el patrón de ${key}`);
    const scope = name ? page.getByRole('list', { name, exact: false }) : page;
    const items = scope.getByRole('listitem').filter({ hasText: new RegExp(`^\\s*${id}(?![A-Za-z0-9])`) });
    const found = await visibleFirst(items);
    if (!found) throw new Error(`Elemento ${id} ausente en ${key}`);
    return found;
  };
  const inRow = async (key, id, target) => {
    const found = await find(await row(key, id), target);
    if (!found) throw new Error(`Control ${target.role} «${target.name}» ausente en ${id}`);
    return found;
  };
  const usable = async locator => Boolean(locator) && (await locator.isVisible()) && (await locator.isEnabled());

  return {
    page,
    async reload() { await page.reload({ waitUntil: 'load' }); },
    async reset() { await page.reload({ waitUntil: 'load' }); },
    async fill(key, value) { await (await control(key)).fill(String(value)); },
    async select(key, value) { await (await control(key)).selectOption(String(value)); },
    async click(key) { await (await control(key)).click(); },
    // Intenta pulsar: si el control falta o está deshabilitado no hay acción (devuelve false).
    async tryClick(key) {
      const found = await find(page, spec(key));
      if (!(await usable(found))) return false;
      await found.click();
      return true;
    },
    async check(key, value = true) { await (await control(key)).setChecked(Boolean(value)); },
    async exists(key) { return Boolean(await find(page, spec(key))); },
    async enabled(key) { return usable(await find(page, spec(key))); },
    async value(key) { return (await control(key)).inputValue(); },
    async checked(key) { return (await control(key)).isChecked(); },
    async text(key) { return normalize(await (await control(key)).textContent()); },
    // Texto del control si existe y es visible; null en otro caso (no falla).
    async textOrNull(key) { const found = await find(page, spec(key)); return found ? normalize(await found.textContent()) : null; },
    async options(key) { return (await control(key)).evaluate(select => [...select.options].map(option => ({ value: option.value, label: option.textContent.trim(), disabled: option.disabled }))); },
    async rows(key) { return rows(key); },
    async ids(key) { return (await rows(key)).map(item => item.id); },
    async rowText(key, id) { return normalize(await (await row(key, id)).textContent()); },
    async rowClick(key, id, target) { await (await inRow(key, id, target)).click(); },
    async rowTryClick(key, id, target) {
      const found = await find(await row(key, id), target);
      if (!(await usable(found))) return false;
      await found.click();
      return true;
    },
    async rowEnabled(key, id, target) {
      try { return usable(await find(await row(key, id), target)); } catch { return false; }
    },
    async rowFill(key, id, target, value) { await (await inRow(key, id, target)).fill(String(value)); },
    async rowValue(key, id, target) { return (await inRow(key, id, target)).inputValue(); },
    async rowCheck(key, id, target, value = true) { await (await inRow(key, id, target)).setChecked(Boolean(value)); },
    async rowChecked(key, id, target) { return (await inRow(key, id, target)).isChecked(); },
    // Atributo ARIA de estado (aria-pressed, aria-checked...) de un control dentro de la fila.
    async rowAttribute(key, id, target, attribute) { return (await inRow(key, id, target)).getAttribute(attribute); },
    // Textos visibles con role="alert" (mensajes de validación).
    async alerts() { return page.getByRole('alert').evaluateAll(nodes => nodes.filter(node => node.checkVisibility()).map(node => node.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean)); },
    async bodyText() { return normalize(await page.locator('body').innerText()); }
  };
}

// Utilidades para planes: números con dos decimales y punto decimal en textos visibles.
export const amounts = text => [...String(text ?? '').matchAll(/-?\d+\.\d{2}(?!\d)/g)].map(m => Number(m[0]));
export const amount = text => {
  const found = amounts(text);
  if (found.length !== 1) throw new Error(`Se esperaba exactamente un importe con dos decimales en «${text}»`);
  return found[0];
};
export const integers = text => [...String(text ?? '').matchAll(/(?<![\d.])\d+(?![\d.])/g)].map(m => Number(m[0]));
// Valor tras una etiqueta: «Pendientes: 4» → 4 (número entero o con dos decimales).
export const labeled = (text, label) => {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(text ?? '').match(new RegExp(`${escaped}\\s*:?\\s*(-?\\d+(?:\\.\\d{2})?)(?![\\d.])`, 'i'));
  return match ? Number(match[1]) : null;
};
