import test from 'node:test';
import assert from 'node:assert/strict';
import { createBitgetProvider } from '../assets/js/trade/bitget-market.js';
import { resolveMarket } from '../assets/js/trade/market-resolver.js';
import { filtersFor } from '../assets/js/trade/market.js';
import { spotFiltersFor } from '../assets/js/trade/spot-market.js';
import { calculateSpot } from '../assets/js/trade/spot-calculator.js';
import { bitgetSpot, bitgetFutures } from './fixtures/bitget.js';

const response = data => ({ ok: true, json: async () => ({ code: '00000', data }) });

for (const market of ['spot', 'futures']) {
  const spot = market === 'spot';
  const raw = spot ? bitgetSpot : bitgetFutures;
  test(`Bitget ${market} metadata excludes inactive/wrong markets and maps decimal order rules`, async () => {
    let requests = 0;
    const provider = createBitgetProvider(market, async () => {
      requests++;
      return response([raw, { ...raw, quoteCoin: 'BTC' }, { ...raw, status: 'offline', symbolStatus: 'off' },
        ...(!spot ? [{ ...raw, symbolType: 'delivery' }, { ...raw, supportMarginCoins: ['BTC'] }] : [])]);
    });
    const metadata = await provider.getSymbols();
    assert.equal(metadata.symbols.length, 1);
    const rules = spot ? spotFiltersFor(metadata.symbols[0]) : filtersFor(metadata.symbols[0], 'MARKET');
    assert.equal(rules.tickSize, spot ? '0.01' : '0.05');
    assert.equal(rules.lots[0].stepSize, spot ? '0.001' : '0.01');
    assert.equal(rules.minNotional, spot ? '1' : '5');
    if (!spot) assert.equal(rules.lots[1].maxQty, '1000');
    await provider.getSymbols();
    assert.equal(requests, 1);
  });

  test(`Bitget ${market} REST and WebSocket keep real trade times and reject wrong channels/symbols`, async () => {
    const time = Date.now();
    const urls = [];
    const provider = createBitgetProvider(market, async url => {
      urls.push(url);
      return response([{ symbol: 'TESTUSDT', price: '10', ts: String(time) }]);
    });
    const quote = await provider.getPrice('TESTUSDT');
    assert.equal(quote.timestamp, time);
    assert.equal(quote.price, '10');
    assert.match(quote.source, spot ? /^Bitget Spot REST$/ : /^Bitget USDT-M Futures REST$/);
    assert.ok(urls[0].includes(spot ? '/spot/market/fills?' : '/mix/market/fills?'));
    if (!spot) assert.ok(urls[0].includes('productType=USDT-FUTURES'));
    const arg = { instType: spot ? 'SPOT' : 'USDT-FUTURES', channel: 'trade', instId: 'TESTUSDT' };
    const data = [{ price: '11', ts: String(time) }, { price: '9', ts: String(time - 1000) }];
    const parse = frame => provider.parseStreamQuote(frame, 'TESTUSDT', time);
    assert.equal(parse({ arg, data }).price, '11');
    assert.equal(parse({ arg, data }).timestamp, time);
    for (const frame of [
      { arg: { ...arg, instId: 'BTCUSDT' }, data }, { arg: { ...arg, instType: 'COIN-FUTURES' }, data },
      { arg: { ...arg, channel: 'ticker' }, data }, { event: 'subscribe', arg }, { arg, data: [{}] },
      { arg, data: [{ price: '0', ts: String(time) }] }, { arg, data: [{ price: 'NaN', ts: String(time) }] },
      { arg, data: [{ price: '10', ts: String(time + 60000) }] }, { arg, data: [{ price: '10' }], ts: time },
    ]) assert.equal(parse(frame), null);
    // Preserve old timestamps so the consumer can label a quiet market stale.
    assert.equal(parse({ arg, data: [{ price: '10', ts: String(time - 60000) }] }).timestamp, time - 60000);
  });
}

test('Bitget rejects API errors, malformed prices and metadata without caching them', async () => {
  for (const payload of [{ code: '40034', data: [] }, { code: '00000', data: {} }]) {
    const provider = createBitgetProvider('spot', async () => ({ ok: true, json: async () => payload }));
    await assert.rejects(provider.getSymbols());
    await assert.rejects(provider.getPrice('TESTUSDT'));
  }
  for (const data of [[{ symbol: 'BTCUSDT', price: '10', ts: String(Date.now()) }], [{ symbol: 'TESTUSDT', price: '10' }]]) {
    const provider = createBitgetProvider('spot', async () => response(data));
    await assert.rejects(provider.getPrice('TESTUSDT'));
  }
});

test('Bitget spot ignores deprecated quantity bounds while enforcing current notional limits', async () => {
  const provider = createBitgetProvider('spot', async () => response([{
    ...bitgetSpot, symbol: '10SETUSDT', baseCoin: '10SET', pricePrecision: '5', quantityPrecision: '2',
    minTradeAmount: '500', maxTradeAmount: '1000000', minTradeUSDT: '5', maxMarketOrderValue: '1000000',
  }]));
  const rules = spotFiltersFor((await provider.getSymbols()).symbols[0]);
  const input = { symbol: '10SETUSDT', entry: '0.1', investment: '10', tp: '0.11', sl: '' };
  const result = calculateSpot(input, rules);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.quantity, '100');
  assert.equal(calculateSpot({ ...input, investment: '4' }, rules).ok, false);
  assert.equal(calculateSpot({ ...input, investment: '200000' }, rules).ok, true);
  assert.equal(calculateSpot({ ...input, investment: '1000001' }, rules).ok, false);
});

test('Bitget rate limits persist across symbols and requests are abortable', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 100000 });
  let requests = 0;
  const limited = createBitgetProvider('futures', async () => {
    requests++;
    return { ok: false, status: 429, headers: { get: () => '60' } };
  });
  await assert.rejects(limited.getSymbols());
  await assert.rejects(limited.getPrice('TESTUSDT'));
  assert.equal(requests, 1);
  t.mock.timers.tick(60001);
  await assert.rejects(limited.getPrice('BTCUSDT'));
  assert.equal(requests, 2);
  const controller = new AbortController();
  const provider = createBitgetProvider('spot', async (url, { signal, credentials }) => {
    assert.equal(credentials, 'omit');
    controller.abort();
    signal.throwIfAborted();
  });
  await assert.rejects(provider.getSymbols({ signal: controller.signal }), { name: 'AbortError' });
});

test('resolver preserves Binance priority, only looks at Bitget for absent pairs, and merges suggestions', async () => {
  let fallbackRequests = 0;
  const primary = { label: 'Binance Spot', getSymbols: async () => ({ symbols: [{ symbol: 'BTCUSDT', baseAsset: 'BTC' }], fetchedAt: 200 }) };
  const fallback = { label: 'Bitget Spot', getSymbols: async () => {
    fallbackRequests++;
    return { symbols: [{ symbol: 'BTCUSDT', baseAsset: 'wrong duplicate' }, { symbol: 'TESTUSDT', baseAsset: 'TEST' }], fetchedAt: 100 };
  } };
  assert.equal((await resolveMarket('BTCUSDT', primary, fallback)).provider, primary);
  assert.equal(fallbackRequests, 0);
  const resolved = await resolveMarket('TESTUSDT', primary, fallback);
  assert.equal(resolved.provider, fallback);
  assert.deepEqual(resolved.metadata.symbols.map(s => s.symbol), ['BTCUSDT', 'TESTUSDT']);
  assert.equal(resolved.metadata.symbols[0].baseAsset, 'BTC');
  assert.equal(resolved.metadata.fetchedAt, 100);
  assert.equal((await resolveMarket('MISSINGUSDT', primary, fallback)).provider, null);
});

test('resolver never treats a Binance outage as an absent listing, and propagates cancellation', async () => {
  let requests = 0;
  const broken = { getSymbols: async () => { throw new Error('Network failure'); } };
  const fallback = { getSymbols: async () => { requests++; return { symbols: [], fetchedAt: 1 }; } };
  await assert.rejects(resolveMarket('TESTUSDT', broken, fallback), /Network failure/);
  assert.equal(requests, 0);
  const primary = { getSymbols: async () => ({ symbols: [], fetchedAt: 1 }) };
  const failed = await resolveMarket('TESTUSDT', primary, broken);
  assert.equal(failed.provider, null);
  assert.match(failed.message, /unavailable/i);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(resolveMarket('TESTUSDT', primary, fallback, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(requests, 0);
});
