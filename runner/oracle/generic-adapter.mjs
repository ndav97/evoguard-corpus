// Adaptador UI genérico del oráculo (familias F002+): acciona controles accesibles declarados en el ui_contract
// y lee lo que la página muestra. No calcula resultados ni importa lógica de la aplicación.
//   controls: { clave: { role, name } }  — role 'field' localiza por etiqueta (<label>) inputs sin rol ARIA.
//   lists:    { clave: { name: 'Nombre accesible de la lista' | null, id: 'regex del ID al inicio del texto' } }
// Búsqueda de controles: primero coincidencia exacta del nombre accesible; si no hay, por subcadena sin distinguir
// mayúsculas (p. ej. «Título *»). Con varias coincidencias se usa la primera visible en orden del documento.
const normalize = text => String(text ?? '').replace(/\s+/g, ' ').trim();

// Texto de un elemento con un espacio en cada límite entre elementos (revisión de equidad, 2026-09-29).
// textContent concatena elementos contiguos: <span>K001</span><span>Revisar</span> daba «K001Revisar» aunque en
// pantalla se viera separado, y la fila no se reconocía. Aquí cada elemento se separa del vecino con un espacio;
// después se colapsan los espacios. Se ignoran <script>, <style> y <template>. Se ejecuta dentro de la página, así
// que no puede usar nada del módulo.
function boundaryText(root) {
  const walk = node => {
    if (node.nodeType === 3) return node.data;
    if (node.nodeType !== 1 || ['SCRIPT', 'STYLE', 'TEMPLATE'].includes(node.tagName)) return '';
    return ' ' + [...node.childNodes].map(walk).join('') + ' ';
  };
  return walk(root).replace(/\s+/g, ' ').trim();
}
// Funciones para evaluate con boundaryText incluido en su propio código (sin eval dentro de la página, que una CSP
// de la aplicación podría bloquear).
const withText = (params, body) => new Function(...params, `const textOf = ${boundaryText.toString()};\n${body}`);
const ROWS = withText(['items', 'source'], `
  const pattern = new RegExp('^(' + source + ')(?![A-Za-z0-9])');
  return items.filter(item => item.checkVisibility()).map(item => {
    const text = textOf(item);
    const match = text.match(pattern);
    return match ? { id: match[1], text } : null;
  }).filter(Boolean);`);
const ROW_INDEX = withText(['nodes', 'wanted'], `
  const pattern = new RegExp('^' + wanted + '(?![A-Za-z0-9])');
  return nodes.findIndex(node => node.checkVisibility() && pattern.test(textOf(node)));`);
const TEXT = withText(['node'], 'return textOf(node);');
const ALERTS = withText(['nodes'], 'return nodes.filter(node => node.checkVisibility()).map(textOf).filter(Boolean);');
// Espera a que el DOM quede quieto tras recargar (máx. 3 s): los estados restaurados en un useEffect
// (p. ej. desde localStorage) se pintan después del primer render.
async function settle(page) {
  await page.evaluate(() => new Promise(resolve => {
    let timer = setTimeout(done, 250);
    const limit = setTimeout(done, 3000);
    const observer = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(done, 250); });
    observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
    function done() { observer.disconnect(); clearTimeout(timer); clearTimeout(limit); resolve(); }
  }));
}

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
  // Listas visibles con ese nombre: primero coincidencia exacta; solo si no hay, por subcadena.
  const visibleLists = async name => {
    for (const exact of [true, false]) {
      const list = page.getByRole('list', { name, exact });
      const found = [];
      for (let i = 0; i < await list.count(); i++) if (await list.nth(i).isVisible()) found.push(list.nth(i));
      if (found.length) return found;
    }
    return [];
  };
  // Elementos visibles de la lista cuyo texto comienza con un ID del patrón declarado.
  const rows = async key => {
    const { name, id } = listSpec(key);
    let scopes;
    if (name) {
      scopes = await visibleLists(name);
      if (!scopes.length) return [];
    } else scopes = [page];
    const result = [];
    for (const scope of scopes) {
      const found = await scope.getByRole('listitem').evaluateAll(ROWS, id);
      result.push(...found);
    }
    return result;
  };
  const row = async (key, id) => {
    const { name, id: pattern } = listSpec(key);
    if (!new RegExp(`^(${pattern})$`).test(id)) throw new Error(`Premisa del caso inválida: ${id} no sigue el patrón de ${key}`);
    const scopes = name ? await visibleLists(name) : [page];
    for (const scope of scopes) {
      const items = scope.getByRole('listitem');
      const index = await items.evaluateAll(ROW_INDEX, id);
      if (index >= 0) return items.nth(index);
    }
    throw new Error(`Elemento ${id} ausente en ${key}`);
  };
  const inRow = async (key, id, target) => {
    const found = await find(await row(key, id), target);
    if (!found) throw new Error(`Control ${target.role} «${target.name}» ausente en ${id}`);
    return found;
  };
  const textOf = locator => locator.evaluate(TEXT);
  const usable = async locator => Boolean(locator) && (await locator.isVisible()) && (await locator.isEnabled());

  return {
    page,
    async reload() { await page.reload({ waitUntil: 'load' }); await settle(page); },
    async reset() { await page.reload({ waitUntil: 'load' }); await settle(page); },
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
    async text(key) { return normalize(await textOf(await control(key))); },
    // Texto del control si existe y es visible; null en otro caso (no falla).
    async textOrNull(key) { const found = await find(page, spec(key)); return found ? normalize(await textOf(found)) : null; },
    async options(key) { return (await control(key)).evaluate(select => [...select.options].map(option => ({ value: option.value, label: option.textContent.trim(), disabled: option.disabled }))); },
    async rows(key) { return rows(key); },
    async ids(key) { return (await rows(key)).map(item => item.id); },
    async rowText(key, id) { return normalize(await textOf(await row(key, id))); },
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
    async alerts() { return page.getByRole('alert').evaluateAll(ALERTS); },
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
