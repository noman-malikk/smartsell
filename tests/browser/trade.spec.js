import { test, expect } from '@playwright/test';

async function offline(page) {
  await page.route('https://fapi.binance.com/**', route => route.abort());
  await page.routeWebSocket('wss://fstream.binance.com/**', ws => ws.close());
  await page.addInitScript(() => localStorage.setItem('sellsmart-analytics-consent', 'rejected'));
  await page.goto('/trade-calculator/');
}
async function manual(page) {
  await page.getByLabel('Current / reference price').fill('21.37');
  await page.getByLabel('Take profit price').fill('20.24');
}

test('manual offline example, accessible validation, copy, lock and reset', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await offline(page);
  await manual(page);
  await page.getByLabel('Stop loss price').fill('22.55');
  await page.getByLabel('Manual quantity', { exact: true }).check();
  await page.getByLabel('Trade quantity').fill('4.10');
  await expect(page.locator('[data-value="grossTP"]')).toHaveText('+4.63 USDT');
  await expect(page.locator('[data-value="grossSL"]')).toHaveText('-4.84 USDT');
  await expect(page.locator('[data-value="leverage"]')).toHaveText('3x Isolated');
  await page.getByRole('button', { name: 'Copy Trade Setup' }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('Gross TP: approx +4.63 USDT');
  expect(copied).not.toContain('Cancel old');
  await expect(page.getByLabel('Wallet balance')).toBeDisabled();
  await page.getByRole('button', { name: 'Unlock setup' }).click();
  await page.getByLabel('Stop loss price').fill('20');
  await expect(page.getByLabel('Stop loss price')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#error-sl')).toContainText('above entry');
  await expect(page.getByRole('button', { name: 'Copy Trade Setup' })).toBeDisabled();
  await page.getByRole('button', { name: 'Reset' , exact: true }).click();
  await expect(page.getByLabel('Wallet balance')).toHaveValue('50');
  await expect(page.getByLabel('Stop loss price')).toHaveValue('');
  await expect(page.getByLabel('Automatic quantity', { exact: true })).toBeChecked();
});

test('automatic stop, LONG and infeasible margin update instantly', async ({ page }) => {
  await offline(page);
  await manual(page);
  await expect(page.locator('[data-value="leverage"]')).toHaveText('5x Isolated');
  await expect(page.locator('[data-value="grossTP"]')).toHaveText('+10.00 USDT');
  await page.getByLabel('LONG', { exact: true }).check();
  await page.getByLabel('Current / reference price').fill('100');
  await page.getByLabel('Take profit price').fill('110');
  await expect(page.locator('[data-value="sl"]')).toHaveText('95');
  await page.getByLabel('Wallet balance').fill('0.1');
  await expect(page.locator('#trade-errors')).toContainText('HIGH LEVERAGE REQUIRED');
  await expect(page.getByRole('button', { name: 'Copy Trade Setup' })).toBeDisabled();
});

test('live futures ticker never silently changes reference snapshot; explicit refresh and copy freeze it', async ({ page }) => {
  let socket;
  let price = '21.37';
  await page.route('https://fapi.binance.com/**', route => {
    const payload = route.request().url().includes('exchangeInfo') ? { symbols: [{ symbol: 'COMPUSDT', baseAsset: 'COMP', quoteAsset: 'USDT', marginAsset: 'USDT', contractType: 'PERPETUAL', status: 'TRADING', filters: [
      { filterType: 'PRICE_FILTER', tickSize: '0.01', minPrice: '0.01', maxPrice: '1000000' },
      { filterType: 'LOT_SIZE', stepSize: '0.01', minQty: '0.01', maxQty: '10000' },
      { filterType: 'MIN_NOTIONAL', notional: '5' },
    ] }] } : { symbol: 'COMPUSDT', price, time: Date.now() };
    return route.fulfill({ json: payload });
  });
  await page.routeWebSocket('wss://fstream.binance.com/**', ws => { socket = ws; });
  await page.addInitScript(() => localStorage.setItem('sellsmart-analytics-consent', 'rejected'));
  await page.goto('/trade-calculator/');
  await expect(page.getByLabel('Current / reference price')).toHaveValue('21.37');
  await page.getByLabel('Take profit price').fill('20.24');
  await expect(page.locator('[data-value="quantity"]')).toHaveText('8.84 COMP');
  price = '22';
  socket.send(JSON.stringify({ s: 'COMPUSDT', p: price, T: Date.now(), st: 1 }));
  await expect(page.locator('#market-price')).toHaveText('22 USDT');
  await expect(page.getByLabel('Current / reference price')).toHaveValue('21.37');
  await expect(page.locator('#snapshot-status')).toContainText('Recalculate');
  await page.getByRole('button', { name: 'Recalculate', exact: true }).click();
  await expect(page.getByLabel('Current / reference price')).toHaveValue('22');
  await page.getByRole('button', { name: 'Lock setup', exact: true }).click();
  socket.send(JSON.stringify({ s: 'COMPUSDT', p: '23', T: Date.now(), st: 1 }));
  await expect(page.locator('#market-price')).toHaveText('23 USDT');
  await expect(page.locator('[data-value="entry"]')).toHaveText('22');
});

test('320px and desktop layouts fit, labels are present, existing tools still load', async ({ page }) => {
  await offline(page);
  await manual(page);
  for (const width of [320, 768, 880, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (await page.locator('#site-navigation').isVisible()) {
      expect(await page.locator('#site-navigation').evaluate(nav => nav.getBoundingClientRect().right <= innerWidth)).toBe(true);
    }
    await expect(page.getByRole('heading', { name: 'Crypto Futures Trade Calculator' })).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: `test-results/trade-${width}.png`, fullPage: true });
  }
  await page.goto('/ebay-profit-calculator-uk/');
  await expect(page.locator('#profit-calculator-form')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Trade Calculator', exact: true })).toBeVisible();
});

test('LIMIT entry works independently; pending reminder follows direction; clipboard rejection is recoverable', async ({ page }) => {
  await offline(page);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('Denied')) }, configurable: true }));
  await page.getByLabel('Order type').selectOption('LIMIT');
  await page.getByLabel('Intended limit entry price').fill('21.37');
  await page.getByLabel('Take profit price').fill('20.24');
  await page.getByLabel('Existing pending order for this pair and direction').check();
  await page.getByRole('button', { name: 'Copy Trade Setup' }).click();
  await expect(page.locator('#copy-text')).toBeVisible();
  expect(await page.locator('#copy-text').inputValue()).toContain('Cancel old pending short order first.');
  expect(await page.locator('#copy-text').inputValue()).not.toContain('Recalculate if market price changes');
  await page.getByRole('button', { name: 'Unlock setup' }).click();
  await page.getByLabel('LONG', { exact: true }).check();
  await expect(page.getByLabel('Existing pending order for this pair and direction')).not.toBeChecked();
});

test('a stale market snapshot disables copying and manual prices remain usable', async ({ page }) => {
  await page.clock.install();
  const quoteTime = await page.evaluate(() => Date.now());
  await page.route('https://fapi.binance.com/**', route => route.request().url().includes('exchangeInfo') ? route.abort() : route.fulfill({ json: { symbol: 'COMPUSDT', price: '21.37', time: quoteTime } }));
  await page.routeWebSocket('wss://fstream.binance.com/**', ws => ws.close());
  await page.addInitScript(() => localStorage.setItem('sellsmart-analytics-consent', 'rejected'));
  await page.goto('/trade-calculator/');
  await expect(page.getByLabel('Current / reference price')).toHaveValue('21.37');
  await page.getByLabel('Take profit price').fill('20.24');
  await page.clock.runFor(31_000);
  await expect(page.locator('#connection-status')).toHaveText('Stale price');
  await expect(page.locator('#snapshot-status')).toContainText('stale');
  await expect(page.getByRole('button', { name: 'Copy Trade Setup' })).toBeDisabled();
  await page.getByLabel('Price input').selectOption('manual');
  await expect(page.getByRole('button', { name: 'Copy Trade Setup' })).toBeEnabled();
});

test('keyboard can switch direction and quantity modes without a mouse', async ({ page }) => {
  await offline(page);
  await manual(page);
  await page.getByLabel('SHORT', { exact: true }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByLabel('LONG', { exact: true })).toBeChecked();
  await page.getByLabel('Automatic quantity', { exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('Manual quantity', { exact: true })).toBeChecked();
  await expect(page.getByLabel('Trade quantity')).toBeEditable();
});

async function liveFixture(page, priceHandler) {
  await page.clock.install();
  await page.route('https://fapi.binance.com/**', route => route.request().url().includes('exchangeInfo') ? route.fulfill({ json: { symbols: [{ symbol: 'COMPUSDT', baseAsset: 'COMP', quoteAsset: 'USDT', marginAsset: 'USDT', contractType: 'PERPETUAL', status: 'TRADING', filters: [] }] } }) : priceHandler(route));
  await page.routeWebSocket('wss://fstream.binance.com/**', () => {});
  await page.addInitScript(() => localStorage.setItem('sellsmart-analytics-consent', 'rejected'));
  await page.goto('/trade-calculator/');
  await expect(page.getByLabel('Current / reference price')).toHaveValue('21.37');
  await page.getByLabel('Take profit price').fill('20.24');
}

test('locking during an in-flight refresh preserves both input and result snapshot', async ({ page }) => {
  let requests = 0;
  let heldRoute;
  await liveFixture(page, async route => {
    requests++;
    if (requests === 1) return route.fulfill({ json: { symbol: 'COMPUSDT', price: '21.37', time: await page.evaluate(() => Date.now()) } });
    heldRoute = route;
  });
  await page.clock.runFor(1100);
  await page.getByRole('button', { name: 'Recalculate', exact: true }).click();
  await expect.poll(() => Boolean(heldRoute)).toBe(true);
  await page.getByRole('button', { name: 'Lock setup', exact: true }).click();
  await heldRoute.fulfill({ json: { symbol: 'COMPUSDT', price: '22', time: await page.evaluate(() => Date.now()) } });
  await expect(page.getByRole('button', { name: 'Recalculate', exact: true })).toBeEnabled();
  await expect(page.getByLabel('Current / reference price')).toHaveValue('21.37');
  await expect(page.locator('[data-value="entry"]')).toHaveText('21.37');
  await expect(page.getByLabel('Wallet balance')).toBeDisabled();
});

test('back-forward cache suspension preserves live provenance and a locked setup', async ({ page }) => {
  await liveFixture(page, async route => route.fulfill({ json: { symbol: 'COMPUSDT', price: '21.37', time: await page.evaluate(() => Date.now()) } }));
  await page.getByRole('button', { name: 'Lock setup', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new window.PageTransitionEvent('pagehide', { persisted: true })));
  await page.clock.runFor(31_000);
  await page.evaluate(() => window.dispatchEvent(new window.PageTransitionEvent('pageshow', { persisted: true })));
  await expect(page.getByRole('button', { name: 'Unlock setup', exact: true })).toBeVisible();
  await expect(page.locator('#snapshot-status')).toContainText('stale');
  await expect(page.getByRole('button', { name: 'Copy Trade Setup' })).toBeDisabled();
  await expect(page.getByLabel('Wallet balance')).toBeDisabled();
  await page.getByRole('button', { name: 'Unlock setup', exact: true }).click();
  await expect(page.getByLabel('Wallet balance')).toBeEditable();
});

test('copying a manual LIMIT entry does not attach the live ticker timestamp', async ({ page }) => {
  await liveFixture(page, async route => route.fulfill({ json: { symbol: 'COMPUSDT', price: '21.37', time: await page.evaluate(() => Date.now()) } }));
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('Denied')) }, configurable: true }));
  await page.getByLabel('Order type').selectOption('LIMIT');
  await page.getByLabel('Intended limit entry price').fill('22');
  await page.getByRole('button', { name: 'Copy Trade Setup' }).click();
  await expect(page.locator('#copy-text')).toBeVisible();
  expect(await page.locator('#copy-text').inputValue()).toMatch(/Price source: manual limit entry\n/);
});
