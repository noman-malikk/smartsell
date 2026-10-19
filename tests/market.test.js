import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSymbols, filtersFor, parseQuote, createPriceFeed, createBinanceProvider } from '../assets/js/trade/market.js';

const raw = { symbol: 'COMPUSDT', baseAsset: 'COMP', quoteAsset: 'USDT', marginAsset: 'USDT', contractType: 'PERPETUAL', status: 'TRADING', filters: [
  { filterType: 'PRICE_FILTER', tickSize: '0.01', minPrice: '0.01', maxPrice: '1000000' },
  { filterType: 'LOT_SIZE', stepSize: '0.01', minQty: '0.01', maxQty: '10000' },
  { filterType: 'MARKET_LOT_SIZE', stepSize: '0.1', minQty: '0.1', maxQty: '1000' },
  { filterType: 'MIN_NOTIONAL', notional: '5' },
] };

test('metadata permits only active USDT-margined perpetuals and preserves exchange filters', () => {
  const symbols = parseSymbols({ symbols: [raw, { ...raw, contractType: 'CURRENT_QUARTER' }, { ...raw, status: 'BREAK' }, { ...raw, marginAsset: 'BTC' }] });
  assert.equal(symbols.length, 1);
  assert.equal(filtersFor(symbols[0], 'MARKET').lots.length, 2);
  assert.equal(filtersFor(symbols[0], 'LIMIT').lots.length, 1);
  assert.equal(filtersFor(symbols[0], 'MARKET').tickSize, '0.01');
  assert.equal(filtersFor(symbols[0], 'MARKET').minNotional, '5');
  assert.throws(() => parseSymbols({}), /metadata/);
});

test('quotes reject wrong symbols, coin-margined data, invalid prices and future/missing timestamps', () => {
  const now = Date.now();
  const q = { symbol: 'COMPUSDT', price: '21.37', time: now };
  assert.equal(parseQuote(q, 'COMPUSDT', 'REST', now).price, '21.37');
  for (const quote of [{ ...q, symbol: 'BTCUSDT' }, { ...q, price: 'NaN' }, { ...q, price: '0' }, { ...q, time: undefined }, { ...q, time: now + 60000 }, { s: 'COMPUSDT', p: '21.37', T: now, st: 2 }]) {
    assert.equal(parseQuote(quote, 'COMPUSDT', 'REST', now), null);
  }
  assert.equal(parseQuote({ s: 'COMPUSDT', p: '21.37', T: now, st: 1 }, 'COMPUSDT', 'WebSocket', now).timestamp, now);
});

function harness(getPrice) {
  let time = 100000;
  const jobs = new Map();
  let id = 0;
  const sockets = [];
  const prices = [];
  const statuses = [];
  const feed = createPriceFeed('COMPUSDT', { onPrice: q => prices.push(q), onStatus: s => statuses.push(s) }, {
    provider: { getPrice, streamUrl: s => `wss://example.test/${s}` },
    socketFactory: () => { const socket = { close() { this.closed = true; } }; sockets.push(socket); return socket; },
    now: () => time,
    setTimer: (fn, delay) => { jobs.set(++id, { fn, at: time + delay }); return id; },
    clearTimer: n => jobs.delete(n),
    retryDelays: [10, 20], pollInterval: 100, staleAfter: 200, connectionTimeout: 50,
  });
  return { feed, sockets, prices, statuses, jobs, async advance(ms) {
    const end = time + ms;
    for (let safety = 0; safety < 1000; safety++) {
      const due = [...jobs].filter(([, j]) => j.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      const [key, job] = due; jobs.delete(key); time = job.at; job.fn(); await new Promise(resolve => setImmediate(resolve));
    }
    time = end;
    await new Promise(resolve => setImmediate(resolve));
  } };
}

test('REST fallback emits prices; older WS data cannot overwrite them; dispose prevents late effects', async () => {
  const h = harness(async () => ({ symbol: 'COMPUSDT', price: '21.37', timestamp: 100000, source: 'Binance USD-M Futures REST' }));
  await h.advance(0);
  assert.equal(h.prices.length, 1);
  h.sockets[0].onmessage({ data: JSON.stringify({ s: 'COMPUSDT', p: '20', T: 99999 }) });
  assert.equal(h.prices.length, 1);
  h.sockets[0].onmessage({ data: JSON.stringify({ s: 'COMPUSDT', p: '22', T: 100001 }) });
  assert.equal(h.prices.at(-1).price, '22');
  h.feed.dispose();
  assert.equal(h.jobs.size, 0);
  assert.equal(h.sockets[0].closed, true);
  const count = h.prices.length;
  h.sockets[0].onmessage?.({ data: JSON.stringify({ s: 'COMPUSDT', p: '23', T: 100002 }) });
  await h.advance(1000);
  assert.equal(h.prices.length, count);
});

test('disconnected WebSockets have bounded retries while REST failures back off', async () => {
  let requests = 0;
  const h = harness(async () => { requests++; throw new Error('Unavailable'); });
  await h.advance(0);
  h.sockets[0].onclose();
  await h.advance(10);
  h.sockets[1].onclose();
  await h.advance(20);
  h.sockets[2].onclose();
  await h.advance(1000);
  assert.equal(h.sockets.length, 3);
  assert.ok(requests < 10, `requests: ${requests}`);
  assert.ok(h.statuses.some(s => s.state === 'offline'));
  h.feed.dispose();
});

test('disposing an in-flight REST response prevents callbacks and aborts the request', async () => {
  let resolveRequest;
  let signal;
  const h = harness((symbol, options) => { signal = options.signal; return new Promise(resolve => { resolveRequest = resolve; }); });
  h.feed.dispose();
  assert.equal(signal.aborted, true);
  resolveRequest({ symbol: 'COMPUSDT', price: '21', timestamp: 100000 });
  await h.advance(0);
  assert.equal(h.prices.length, 0);
});

test('old or stale WebSocket traffic cannot suppress REST recovery', async () => {
  for (const tradeTime of [99999, 100001]) {
    let requests = 0;
    const h = harness(async () => { requests++; return { symbol: 'COMPUSDT', price: '21.37', timestamp: 100000, source: 'REST' }; });
    await h.advance(0);
    for (let i = 0; i < 20; i++) {
      h.sockets[0].onmessage({ data: JSON.stringify({ s: 'COMPUSDT', p: '21', T: tradeTime }) });
      await h.advance(50);
    }
    assert.ok(requests >= 3, `Stale stream must allow REST fallback, but made ${requests} requests for T=${tradeTime}`);
    assert.notEqual(h.statuses.at(-1).state, 'live');
    h.feed.dispose();
  }
});

test('provider preserves exchange rate-limit cooldown across feeds, symbols and manual retries', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 100000 });
  let requests = 0;
  const provider = createBinanceProvider(async () => { requests++; return { ok: false, status: 429, headers: { get: () => '60' } }; });
  await assert.rejects(provider.getSymbols(), /429/);
  await assert.rejects(provider.getPrice('COMPUSDT'));
  await assert.rejects(provider.getSymbols());
  await assert.rejects(provider.getPrice('BTCUSDT'));
  assert.equal(requests, 1);
  t.mock.timers.tick(60_001);
  await assert.rejects(provider.getPrice('BTCUSDT'));
  assert.equal(requests, 2);
});
