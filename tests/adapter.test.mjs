import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { chromium } from '../templates/react-vite/node_modules/playwright/index.mjs';
import { connectCatalog } from '../runner/oracle/ui-adapter.mjs';

const pageHtml = readFileSync(new URL('./fixtures/controls-page.html', import.meta.url), 'utf8');

async function withPage(run) {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(pageHtml);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await run(page);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

test('el adapter lee los productos que la UI muestra, sin calcularlos', async () => {
  await withPage(async page => {
    const adapter = await connectCatalog(page);
    assert.deepEqual(await adapter.visibleIds(), ['P010', 'P011']);
    await adapter.search('no-existe');
    assert.deepEqual(await adapter.visibleIds(), ['P010', 'P011']);
  });
});

test('las acciones escriben solo en los controles accesibles', async () => {
  await withPage(async page => {
    const adapter = await connectCatalog(page);
    await adapter.search('mouse');
    await adapter.category('Home');
    await adapter.sort('price-asc');
    await adapter.select('P010');
    assert.equal(await page.getByRole('searchbox', { name: 'Buscar' }).inputValue(), 'mouse');
    assert.equal(await page.getByRole('combobox', { name: 'Categoría' }).inputValue(), 'Home');
    assert.equal(await page.getByRole('combobox', { name: 'Orden' }).inputValue(), 'price-asc');
    assert.equal(await adapter.selectedId(), 'P010');
    assert.equal(await adapter.canPrevious(), false);
    assert.equal(await adapter.canNext(), true);
    await adapter.next();
    assert.equal(await adapter.canPrevious(), true);
    await adapter.previous();
    assert.equal(await adapter.canPrevious(), false);
    await adapter.reset();
    assert.equal(await page.getByRole('searchbox', { name: 'Buscar' }).inputValue(), '');
    assert.equal(await page.getByRole('combobox', { name: 'Categoría' }).inputValue(), 'All');
  });
});
