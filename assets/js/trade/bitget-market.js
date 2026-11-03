import { D, positiveDecimal, SYMBOL_PATTERN } from './calculator.js';
import { METADATA_TTL_MS, parseQuote } from './market.js';

function precisionStep(value) {
  if (!/^(0|[1-9]\d?)$/.test(String(value)) || Number(value) > 30) return null;
  return new D(10).pow(-Number(value)).toFixed();
}

function symbolInfo(raw, spot) {
  const priceStep = precisionStep(spot ? raw.pricePrecision : raw.pricePlace);
  const tickSize = spot ? priceStep : priceStep && positiveDecimal(raw.priceEndStep) ? new D(priceStep).times(raw.priceEndStep).toFixed() : null;
  const stepSize = spot ? precisionStep(raw.quantityPrecision) : positiveDecimal(raw.sizeMultiplier)?.toFixed();
  const filters = tickSize && stepSize ? [
    { filterType: 'PRICE_FILTER', tickSize },
    // Spot minTradeAmount/maxTradeAmount are deprecated; use notional limits.
    { filterType: 'LOT_SIZE', stepSize, ...(!spot ? { minQty: raw.minTradeNum, maxQty: raw.maxOrderQty } : {}) },
    ...(!spot ? [{ filterType: 'MARKET_LOT_SIZE', stepSize, minQty: raw.minTradeNum, maxQty: raw.maxMarketOrderQty }] : []),
    { filterType: 'MIN_NOTIONAL', notional: raw.minTradeUSDT, minNotional: raw.minTradeUSDT, applyToMarket: true },
    ...(spot ? [{ filterType: 'NOTIONAL', minNotional: raw.minTradeUSDT, maxNotional: raw.maxMarketOrderValue, applyMinToMarket: true, applyMaxToMarket: true }] : []),
  ] : [];
  return { symbol: raw.symbol, baseAsset: raw.baseCoin, quoteAsset: raw.quoteCoin, filters };
}

/** Public Bitget data, isolated by market. Never uses account or order endpoints. */
export function createBitgetProvider(market = 'futures', fetcher = globalThis.fetch.bind(globalThis)) {
  if (!['spot', 'futures'].includes(market)) throw new Error('Unsupported Bitget market.');
  const spot = market === 'spot';
  const instType = spot ? 'SPOT' : 'USDT-FUTURES';
  const label = spot ? 'Bitget Spot' : 'Bitget USDT-M Futures';
  let metadata = null;
  let cooldownUntil = 0;

  async function request(path, signal) {
    signal?.throwIfAborted();
    if (Date.now() < cooldownUntil) {
      const error = new Error('Bitget requested a cooldown. Manual prices are available.');
      error.retryAfterMs = cooldownUntil - Date.now();
      throw error;
    }
    const response = await fetcher(`https://api.bitget.com/api/v2/${path}`, {
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000), credentials: 'omit',
    });
    if (!response.ok) {
      const error = new Error(`${label} data unavailable (HTTP ${response.status}).`);
      const retry = Number(response.headers.get('Retry-After'));
      error.retryAfterMs = Math.max(Number.isFinite(retry) ? retry * 1000 : 0, [403, 429, 451].includes(response.status) ? 60_000 : 0);
      cooldownUntil = Date.now() + error.retryAfterMs;
      throw error;
    }
    const body = await response.json();
    signal?.throwIfAborted();
    if (body?.code !== '00000' || !Array.isArray(body.data)) throw new Error(`Invalid ${label} response.`);
    return body.data;
  }

  function latestTrade(trades, symbol, transport, now = Date.now(), requireSymbol = false) {
    if (!Array.isArray(trades)) return null;
    let latest = null;
    for (const trade of trades) {
      if (!trade || (requireSymbol && trade.symbol !== symbol) || (trade.symbol !== undefined && trade.symbol !== symbol)) continue;
      if (!/^\d{1,16}$/.test(String(trade.ts))) continue;
      const quote = parseQuote({ symbol, price: trade.price, time: Number(trade.ts) }, symbol, transport, now);
      if (quote && (!latest || quote.timestamp > latest.timestamp)) latest = { ...quote, source: `${label} ${transport}` };
    }
    return latest;
  }

  return {
    label,
    async getSymbols({ signal } = {}) {
      signal?.throwIfAborted();
      if (metadata && Date.now() - metadata.fetchedAt < METADATA_TTL_MS) return metadata;
      const rows = await request(spot ? 'spot/public/symbols' : 'mix/market/contracts?productType=USDT-FUTURES', signal);
      const symbols = rows.filter(s => s && SYMBOL_PATTERN.test(s.symbol) && s.quoteCoin === 'USDT' && (spot
        ? s.status === 'online'
        : s.symbolStatus === 'normal' && s.symbolType === 'perpetual' && s.supportMarginCoins?.includes('USDT')))
        .map(s => symbolInfo(s, spot)).sort((a, b) => a.symbol.localeCompare(b.symbol));
      metadata = { symbols, fetchedAt: Date.now() };
      return metadata;
    },
    async getPrice(symbol, { signal } = {}) {
      if (!SYMBOL_PATTERN.test(symbol)) throw new Error('Invalid USDT symbol.');
      const path = spot ? 'spot/market/fills?' : 'mix/market/fills?productType=USDT-FUTURES&';
      const rows = await request(`${path}symbol=${encodeURIComponent(symbol)}&limit=1`, signal);
      const quote = latestTrade(rows, symbol, 'REST', Date.now(), true);
      if (!quote) throw new Error(`Invalid ${label} price or trade timestamp.`);
      return quote;
    },
    streamUrl: () => 'wss://ws.bitget.com/v2/ws/public',
    subscription: symbol => ({ op: 'subscribe', args: [{ instType, channel: 'trade', instId: symbol }] }),
    heartbeat: { interval: 30_000, timeout: 10_000, ping: 'ping', pong: 'pong' },
    parseStreamQuote(data, symbol, now) {
      if (data?.arg?.instType !== instType || data.arg.channel !== 'trade' || data.arg.instId !== symbol) return null;
      return latestTrade(data.data, symbol, 'WebSocket', now);
    },
  };
}
