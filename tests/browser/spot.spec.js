import { test, expect } from '@playwright/test';

async function openSpot(page) {
  await page.route(/https:\/\/(fapi|api)\.binance\.com\//, route => route.abort());
  await page.routeWebSocket(/wss:\/\/(fstream|stream)\.binance\.com/, ws => ws.close());
  await page.addInitScript(() => localStorage.setItem('sellsmart-analytics-consent', 'rejected'));
  await page.goto('/trade-calculator/');
  await page.getByRole('tab', { name: 'Spot', exact: true }).click();
}

async function example(page) {
  await page.getByLabel('Spot entry price').fill('200');
  await page.getByLabel('Amount to invest').fill('100');
  await page.getByLabel('Spot take profit price').fill('220');
  await page.getByLabel('Spot stop loss price').fill('180');
}

test('spot QNT example updates investment, shows TP/SL values and copies the same result', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openSpot(page);
  await example(page);
  await expect(page.locator('[data-spot-value="quantity"]')).toHaveText('0.5 QNT');
  await expect(page.locator('[data-spot-value="grossTP"]')).toHaveText('+10.00 USDT');
  await expect(page.locator('[data-spot-value="grossSL"]')).toHaveText('-10.00 USDT');
  await expect(page.locator('[data-spot-value="tpValue"]')).toHaveText('110.00 USDT');
  await page.getByLabel('Amount to invest').fill('50');
  await expect(page.locator('[data-spot-value="quantity"]')).toHaveText('0.25 QNT');
  await expect(page.locator('[data-spot-value="grossTP"]')).toHaveText('+5.00 USDT');
  await page.getByRole('button', { name: 'Copy Spot Setup' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Gross TP: approx +5.00 USDT');
  await expect(page.getByLabel('Amount to invest')).toBeDisabled();
});

test('switching modes preserves both calculators and keyboard tabs work', async ({ page }) => {
  await openSpot(page);
  await example(page);
  await page.getByRole('tab', { name: 'Futures', exact: true }).click();
  await page.getByLabel('Current / reference price').fill('21.37');
  await page.getByLabel('Take profit price', { exact: true }).fill('20.24');
  await expect(page.locator('[data-value="leverage"]')).toHaveText('5x Isolated');
  await page.getByRole('tab', { name: 'Futures', exact: true }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: 'Spot', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('Spot entry price')).toHaveValue('200');
  await expect(page.locator('[data-spot-value="grossTP"]')).toHaveText('+10.00 USDT');
  await page.getByRole('tab', { name: 'Futures', exact: true }).click();
  await expect(page.getByLabel('Current / reference price')).toHaveValue('21.37');
});

test('spot exits validate clearly, optional stop stays unset, reset and 320px layout work', async ({ page }) => {
  await openSpot(page);
  await example(page);
  await page.getByLabel('Spot stop loss price').fill('210');
  await expect(page.locator('#spot-error-sl')).toContainText('below');
  await expect(page.getByRole('button', { name: 'Copy Spot Setup' })).toBeDisabled();
  await page.getByLabel('Spot stop loss price').fill('');
  await expect(page.locator('[data-spot-value="grossSL"]')).toHaveText('Not set');
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/spot-320.png', fullPage: true });
  await page.getByRole('button', { name: 'Reset spot' }).click();
  await expect(page.getByLabel('Amount to invest')).toHaveValue('50');
  await expect(page.getByLabel('Spot take profit price')).toHaveValue('');
});

test('spot uses its own market price and keeps its reference stable until recalculated', async ({ page }) => {
  let socket;
  let exchangePrice = '200';
  await page.route('https://fapi.binance.com/**', route => route.abort());
  await page.routeWebSocket('wss://fstream.binance.com/**', ws => ws.close());
  await page.route('https://api.binance.com/**', route => route.request().url().includes('exchangeInfo') ? route.fulfill({ json: { symbols: [{ symbol: 'QNTUSDT', baseAsset: 'QNT', quoteAsset: 'USDT', isSpotTradingAllowed: true, status: 'TRADING', filters: [] }] } }) : route.fulfill({ json: [{ price: exchangePrice, time: Date.now() }] }));
  await page.routeWebSocket('wss://stream.binance.com:9443/**', ws => { socket = ws; });
  await page.addInitScript(() => localStorage.setItem('sellsmart-analytics-consent', 'rejected'));
  await page.goto('/trade-calculator/');
  await page.getByRole('tab', { name: 'Spot', exact: true }).click();
  await expect(page.getByLabel('Spot entry price')).toHaveValue('200');
  await page.getByLabel('Spot take profit price').fill('220');
  // Recalculate may request REST; both transports must describe the same market.
  exchangePrice = '205';
  socket.send(JSON.stringify({ s: 'QNTUSDT', p: '205', T: Date.now() }));
  await expect(page.locator('#spot-market-price')).toHaveText('205 USDT');
  await expect(page.getByLabel('Spot entry price')).toHaveValue('200');
  await expect(page.locator('#spot-snapshot')).toContainText('Recalculate');
  await page.getByRole('button', { name: 'Recalculate spot' }).click();
  await expect(page.getByLabel('Spot entry price')).toHaveValue('205');
});

for (const mode of ['Spot', 'Futures']) {
  test(`${mode}: delayed clipboard rejection after switching and editing cannot expose an older setup`, async ({ page }) => {
    await openSpot(page);
    if (mode === 'Spot') await example(page);
    else {
      await page.getByRole('tab', { name: 'Futures', exact: true }).click();
      await page.locator('#futures-calculator').getByLabel('Current / reference price').fill('21.37');
      await page.locator('#futures-calculator').getByLabel('Take profit price').fill('20.24');
    }
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise((resolve, reject) => { window.rejectOldCopy = reject; }) } }));
    await page.getByRole('button', { name: mode === 'Spot' ? 'Copy Spot Setup' : 'Copy Trade Setup', exact: true }).click();
    await page.getByRole('tab', { name: mode === 'Spot' ? 'Futures' : 'Spot', exact: true }).click();
    await page.getByRole('tab', { name: mode, exact: true }).click();
    await page.getByRole('button', { name: mode === 'Spot' ? 'Unlock spot setup' : 'Unlock setup', exact: true }).click();
    const input = mode === 'Spot' ? page.getByLabel('Amount to invest') : page.locator('#futures-calculator').getByLabel('Wallet balance');
    await input.fill('75');
    await page.evaluate(() => window.rejectOldCopy(new Error('Clipboard denied later')));
    await expect(page.locator(mode === 'Spot' ? '#spot-copy-fallback' : '#copy-fallback')).toBeHidden();
    await expect(page.locator(mode === 'Spot' ? '#spot-copy-status' : '#copy-status')).toHaveText('');
    await expect(input).toBeEditable();
  });
}
