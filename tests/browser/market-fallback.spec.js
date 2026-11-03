import { test, expect } from '@playwright/test';
import { bitgetSpot, bitgetFutures } from '../fixtures/bitget.js';

for (const mode of ['Futures', 'Spot']) {
  const spot = mode === 'Spot';
  const pairInput = spot ? '#spot-symbol' : '#trade-symbol';
  const source = spot ? '#spot-market-source' : '#market-source';
  const price = spot ? '#spot-market-price' : '#market-price';
  const entry = spot ? '#spot-entry' : '#trade-entry';
  const originalPair = spot ? 'QNTUSDT' : 'COMPUSDT';
  const instType = spot ? 'SPOT' : 'USDT-FUTURES';

  async function fixture(page) {
    const bitgetRequests = [];
    const sockets = [];
    await page.route(/https:\/\/(fapi|api)\.binance\.com\//, route => {
      const url = new URL(route.request().url());
      const isSpot = url.host === 'api.binance.com';
      const symbol = isSpot ? 'QNTUSDT' : 'COMPUSDT';
      return route.fulfill({ json: url.pathname.endsWith('exchangeInfo') ? { symbols: [{
        symbol, baseAsset: isSpot ? 'QNT' : 'COMP', quoteAsset: 'USDT', marginAsset: 'USDT',
        contractType: 'PERPETUAL', status: 'TRADING', isSpotTradingAllowed: true, filters: [],
      }] } : isSpot ? [{ price: '20', time: Date.now() }] : { symbol, price: '20', time: Date.now() } });
    });
    await page.routeWebSocket(/wss:\/\/(fstream|stream)\.binance\.com/, () => {});
    await page.route('https://api.bitget.com/**', route => {
      const url = new URL(route.request().url());
      bitgetRequests.push(url);
      return route.fulfill({ json: { code: '00000', data: url.pathname.endsWith('fills')
        ? [{ symbol: 'TESTUSDT', price: '10', ts: String(Date.now()) }]
        : [url.pathname.includes('/spot/') ? bitgetSpot : bitgetFutures] } });
    });
    await page.routeWebSocket('wss://ws.bitget.com/**', ws => {
      const record = { ws, messages: [], closed: false };
      sockets.push(record);
      ws.onClose(() => { record.closed = true; });
      ws.onMessage(message => {
        record.messages.push(message);
        if (message === 'ping') ws.send('pong');
      });
    });
    await page.addInitScript(() => localStorage.setItem('sellsmart-analytics-consent', 'rejected'));
    await page.goto('/trade-calculator/');
    if (spot) await page.getByRole('tab', { name: 'Spot', exact: true }).click();
    await expect(page.locator(price)).toHaveText('20 USDT');
    return { bitgetRequests, sockets };
  }

  test(`${mode}: Binance stays primary; an unlisted pair uses Bitget REST and live trades`, async ({ page }) => {
    const h = await fixture(page);
    await expect(page.locator(source)).toContainText('Binance');
    expect(h.bitgetRequests).toHaveLength(0);
    await page.locator(pairInput).fill('TESTUSDT');
    await expect(page.locator(price)).toHaveText('10 USDT');
    await expect(page.locator(source)).toContainText('Bitget');
    await expect(page.locator(spot ? '#spot-filter-info' : '#filter-info')).toContainText('Bitget');
    await expect.poll(() => h.sockets[0]?.messages.length).toBe(1);
    expect(JSON.parse(h.sockets[0].messages[0])).toEqual({ op: 'subscribe', args: [{ instType, channel: 'trade', instId: 'TESTUSDT' }] });
    h.sockets[0].ws.send(JSON.stringify({ arg: { instType, channel: 'trade', instId: 'TESTUSDT' }, data: [{ price: '11', ts: String(Date.now()) }] }));
    await expect(page.locator(price)).toHaveText('11 USDT');
    await expect(page.locator(source)).toContainText('Bitget');
    await expect(page.locator(source)).toContainText('WebSocket');
    await expect(page.locator(entry)).toHaveValue('10');
    expect(h.bitgetRequests.every(url => url.pathname.includes(spot ? '/spot/' : '/mix/'))).toBe(true);
    await page.locator(pairInput).fill(originalPair);
    await expect(page.locator(price)).toHaveText('20 USDT');
    await expect(page.locator(source)).toContainText('Binance');
    await expect.poll(() => h.sockets[0].closed).toBe(true);
  });

  test(`${mode}: pair missing on both exchanges stays available for manual pricing`, async ({ page }) => {
    await fixture(page);
    await page.locator(pairInput).fill('MISSINGUSDT');
    await expect(page.locator(spot ? '#spot-connection' : '#connection-status')).toContainText('Binance or Bitget');
    await expect(page.locator(price)).toHaveText('—');
    await page.locator(entry).fill('10');
    await page.locator(spot ? '#spot-tp' : '#trade-tp').fill(spot ? '11' : '9');
    await expect(page.locator(spot ? '#spot-results' : '#trade-results')).toBeVisible();
  });

  test(`${mode}: unavailable Bitget data does not fetch a nonexistent Binance pair`, async ({ page }) => {
    const h = await fixture(page);
    const binancePricePairs = [];
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.host.endsWith('binance.com') && !url.pathname.endsWith('exchangeInfo')) binancePricePairs.push(url.searchParams.get('symbol'));
    });
    await page.route('https://api.bitget.com/**', route => route.abort());
    await page.locator(pairInput).fill('TESTUSDT');
    await expect(page.locator(spot ? '#spot-connection' : '#connection-status')).toContainText('Bitget market data unavailable');
    expect(binancePricePairs).not.toContain('TESTUSDT');
    expect(h.sockets).toHaveLength(0);
    await page.locator(entry).fill('10');
    await page.locator(spot ? '#spot-tp' : '#trade-tp').fill(spot ? '11' : '9');
    await expect(page.locator(spot ? '#spot-results' : '#trade-results')).toBeVisible();
  });

  test(`${mode}: changing pair during a Bitget lookup ignores its late response`, async ({ page }) => {
    const h = await fixture(page);
    let heldRoute;
    await page.route('https://api.bitget.com/**', route => { heldRoute = route; });
    await page.locator(pairInput).fill('TESTUSDT');
    await expect.poll(() => Boolean(heldRoute)).toBe(true);
    await page.locator(pairInput).fill(originalPair);
    await expect(page.locator(price)).toHaveText('20 USDT');
    await heldRoute.fulfill({ json: { code: '00000', data: [spot ? bitgetSpot : bitgetFutures] } });
    await expect(page.locator(source)).toContainText('Binance');
    await expect(page.locator(entry)).toHaveValue('20');
    expect(h.sockets).toHaveLength(0);
  });
}
