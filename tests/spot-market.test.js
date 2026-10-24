import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpotProvider, parseSpotSymbols, spotFiltersFor } from '../assets/js/trade/spot-market.js';

const symbol = { symbol: 'QNTUSDT', baseAsset: 'QNT', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true, filters: [
  { filterType: 'PRICE_FILTER', tickSize: '0.1', minPrice: '0.1', maxPrice: '100000' },
  { filterType: 'LOT_SIZE', stepSize: '0.001', minQty: '0.001', maxQty: '100000' },
  { filterType: 'MARKET_LOT_SIZE', stepSize: '0', minQty: '0', maxQty: '10000' },
  { filterType: 'NOTIONAL', minNotional: '5', maxNotional: '100000', applyMinToMarket: true, applyMaxToMarket: false },
] };

test('spot metadata excludes non-spot, halted and non-USDT symbols', () => {
  const list = parseSpotSymbols({ symbols: [symbol, { ...symbol, isSpotTradingAllowed: false }, { ...symbol, quoteAsset: 'BTC' }, { ...symbol, status: 'HALT' }] });
  assert.equal(list.length, 1);
  const filters = spotFiltersFor(list[0]);
  assert.equal(filters.tickSize, '0.1');
  assert.equal(filters.minNotional, '5');
  assert.equal(filters.maxNotional, undefined);
  assert.equal(filters.lots.length, 2);
});

test('spot provider uses spot endpoints and actual trade timestamps, never futures prices', async () => {
  const urls = [];
  const time = Date.now();
  const provider = createSpotProvider(async url => { urls.push(url); return { ok: true, json: async () => url.includes('exchangeInfo') ? { symbols: [symbol] } : [{ price: '200', time }] }; });
  await provider.getSymbols();
  const quote = await provider.getPrice('QNTUSDT');
  assert.equal(quote.price, '200');
  assert.equal(quote.timestamp, time);
  assert.equal(quote.source, 'Binance Spot REST');
  assert.ok(urls.every(url => url.startsWith('https://api.binance.com/api/v3/')));
  assert.match(provider.streamUrl('QNTUSDT'), /stream\.binance\.com:9443\/ws\/qntusdt@aggTrade$/);
  assert.equal(provider.parseStreamQuote({ s: 'QNTUSDT', p: '201', T: time }, 'QNTUSDT', time).source, 'Binance Spot WebSocket');
});

test('spot provider rejects absent timestamps and honours rate-limit cooldown', async () => {
  const bad = createSpotProvider(async () => ({ ok: true, json: async () => [{ price: '200' }] }));
  await assert.rejects(bad.getPrice('QNTUSDT'), /invalid/i);
  let requests = 0;
  const limited = createSpotProvider(async () => { requests++; return { ok: false, status: 429, headers: { get: () => '60' } }; });
  await assert.rejects(limited.getSymbols());
  await assert.rejects(limited.getPrice('QNTUSDT'));
  assert.equal(requests, 1);
});
