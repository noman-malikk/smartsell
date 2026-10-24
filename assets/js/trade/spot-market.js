import { positiveDecimal, SYMBOL_PATTERN } from './calculator.js';
import { METADATA_TTL_MS, parseQuote } from './market.js';

export function parseSpotSymbols(data) {
  if (!Array.isArray(data?.symbols)) throw new Error('Invalid spot exchange metadata.');
  return data.symbols.filter(s => SYMBOL_PATTERN.test(s.symbol) && s.quoteAsset === 'USDT' && s.status === 'TRADING' && s.isSpotTradingAllowed === true)
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function spotFiltersFor(symbol) {
  if (!Array.isArray(symbol?.filters)) return null;
  const price = symbol.filters.find(f => f.filterType === 'PRICE_FILTER');
  const lot = symbol.filters.find(f => f.filterType === 'LOT_SIZE');
  if (!positiveDecimal(price?.tickSize) || !positiveDecimal(lot?.stepSize)) return null;
  const market = symbol.filters.find(f => f.filterType === 'MARKET_LOT_SIZE');
  const min = symbol.filters.find(f => f.filterType === 'MIN_NOTIONAL');
  const notional = symbol.filters.find(f => f.filterType === 'NOTIONAL');
  return {
    baseAsset: symbol.baseAsset, tickSize: price.tickSize, minPrice: price.minPrice, maxPrice: price.maxPrice,
    lots: [lot, ...(market ? [market] : [])],
    minNotional: notional?.applyMinToMarket ? notional.minNotional : min?.applyToMarket ? min.minNotional : undefined,
    maxNotional: notional?.applyMaxToMarket ? notional.maxNotional : undefined,
  };
}

function spotQuote(data, symbol, transport, now = Date.now()) {
  const quote = parseQuote(data, symbol, transport, now);
  return quote ? { ...quote, source: `Binance Spot ${transport}` } : null;
}

/** Separate spot endpoints and cache: no perpetual quotes enter this provider. */
export function createSpotProvider(fetcher = globalThis.fetch.bind(globalThis)) {
  let metadata = null;
  let cooldownUntil = 0;
  async function request(path, signal) {
    if (Date.now() < cooldownUntil) {
      const error = new Error('Binance requested a cooldown. Manual prices are available.');
      error.retryAfterMs = cooldownUntil - Date.now();
      throw error;
    }
    const response = await fetcher(`https://api.binance.com/api/v3/${path}`, {
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000), credentials: 'omit',
    });
    if (!response.ok) {
      const error = new Error(`Spot market data unavailable (HTTP ${response.status}).`);
      const retry = Number(response.headers.get('Retry-After'));
      error.retryAfterMs = Math.max(Number.isFinite(retry) ? retry * 1000 : 0, [403, 418, 429, 451].includes(response.status) ? 60_000 : 0);
      cooldownUntil = Date.now() + error.retryAfterMs;
      throw error;
    }
    return response.json();
  }
  return {
    label: 'Binance Spot',
    async getSymbols({ signal } = {}) {
      if (metadata && Date.now() - metadata.fetchedAt < METADATA_TTL_MS) return metadata;
      const symbols = parseSpotSymbols(await request('exchangeInfo?permissions=SPOT', signal));
      metadata = { symbols, fetchedAt: Date.now() };
      return metadata;
    },
    async getPrice(symbol, { signal } = {}) {
      if (!SYMBOL_PATTERN.test(symbol)) throw new Error('Invalid USDT spot symbol.');
      // A recent trade supplies an actual exchange timestamp; ticker/price does not.
      const trades = await request(`trades?symbol=${encodeURIComponent(symbol)}&limit=1`, signal);
      const quote = spotQuote({ symbol, price: trades?.[0]?.price, time: trades?.[0]?.time }, symbol, 'REST');
      if (!quote) throw new Error('Invalid spot price or trade timestamp.');
      return quote;
    },
    streamUrl: symbol => `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@aggTrade`,
    parseStreamQuote: (data, symbol, now) => spotQuote(data, symbol, 'WebSocket', now),
  };
}
