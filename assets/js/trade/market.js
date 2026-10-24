import { positiveDecimal, SYMBOL_PATTERN } from './calculator.js';

export const STALE_AFTER_MS = 30_000;
export const METADATA_TTL_MS = 10 * 60_000;

export function parseSymbols(data) {
  if (!Array.isArray(data?.symbols)) throw new Error('Invalid exchange metadata response.');
  return data.symbols.filter(s => SYMBOL_PATTERN.test(s.symbol) && s.contractType === 'PERPETUAL' && s.status === 'TRADING' && s.quoteAsset === 'USDT' && s.marginAsset === 'USDT')
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function filtersFor(symbol, orderType) {
  if (!Array.isArray(symbol?.filters)) return null;
  const price = symbol.filters.find(f => f.filterType === 'PRICE_FILTER');
  const lot = symbol.filters.find(f => f.filterType === 'LOT_SIZE');
  const market = symbol.filters.find(f => f.filterType === 'MARKET_LOT_SIZE');
  if (!positiveDecimal(price?.tickSize) || !positiveDecimal(lot?.stepSize)) return null;
  return {
    baseAsset: symbol.baseAsset, tickSize: price.tickSize, minPrice: price.minPrice, maxPrice: price.maxPrice,
    lots: [lot, ...(orderType === 'MARKET' && market ? [market] : [])],
    minNotional: symbol.filters.find(f => f.filterType === 'MIN_NOTIONAL')?.notional,
    // Public exchangeInfo does not include account-specific leverage brackets.
  };
}

export function parseQuote(data, symbol, transport, now = Date.now()) {
  const price = positiveDecimal(data?.price ?? data?.p);
  const timestamp = data?.time ?? data?.T;
  if ((data?.symbol ?? data?.s) !== symbol || (data.st !== undefined && data.st !== 1) || !price || !Number.isSafeInteger(timestamp) || timestamp <= 0 || timestamp > now + 10_000) return null;
  return { symbol, price: price.toFixed(), timestamp, source: `Binance USD-M Futures ${transport}` };
}

/** Public data only. A provider exposes getSymbols, getPrice and streamUrl. */
export function createBinanceProvider(fetcher = globalThis.fetch.bind(globalThis)) {
  let metadata = null;
  let rateLimitUntil = 0;
  async function request(path, signal) {
    if (Date.now() < rateLimitUntil) {
      const error = new Error('Binance requested a cooldown. Use manual prices or retry later.');
      error.retryAfterMs = rateLimitUntil - Date.now();
      throw error;
    }
    const response = await fetcher(`https://fapi.binance.com${path}`, {
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
      credentials: 'omit',
    });
    if (!response.ok) {
      const error = new Error(`Binance futures data unavailable (HTTP ${response.status}). Manual prices are available.`);
      const retryAfter = Number(response.headers.get('Retry-After'));
      error.retryAfterMs = Math.max(Number.isFinite(retryAfter) ? retryAfter * 1000 : 0, [418, 429, 403, 451].includes(response.status) ? 60_000 : 0);
      rateLimitUntil = Math.max(rateLimitUntil, Date.now() + error.retryAfterMs);
      throw error;
    }
    return response.json();
  }
  return {
    async getSymbols({ signal } = {}) {
      if (metadata && Date.now() - metadata.fetchedAt < METADATA_TTL_MS) return metadata;
      const symbols = parseSymbols(await request('/fapi/v1/exchangeInfo', signal));
      metadata = { symbols, fetchedAt: Date.now() };
      return metadata;
    },
    async getPrice(symbol, { signal } = {}) {
      if (!SYMBOL_PATTERN.test(symbol)) throw new Error('Invalid USDT symbol.');
      const quote = parseQuote(await request(`/fapi/v2/ticker/price?symbol=${encodeURIComponent(symbol)}`, signal), symbol, 'REST');
      if (!quote) throw new Error('Exchange returned an invalid futures price.');
      return quote;
    },
    streamUrl: symbol => `wss://fstream.binance.com/market/ws/${symbol.toLowerCase()}@aggTrade`,
  };
}

/** One symbol per feed. The caller owns disposal when the symbol/view changes. */
export function createPriceFeed(symbol, { onPrice, onStatus }, options = {}) {
  const {
    provider = createBinanceProvider(), socketFactory = url => new WebSocket(url),
    now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout,
    retryDelays = [1000, 2000, 4000, 8000, 16000], pollInterval = 15_000,
    staleAfter = STALE_AFTER_MS, connectionTimeout = 10_000,
  } = options;
  const controller = new AbortController();
  const label = provider.label ?? 'Binance USD-M Futures';
  const parseStreamQuote = provider.parseStreamQuote ?? ((data, pair, time) => parseQuote(data, pair, 'WebSocket', time));
  const timers = new Set();
  let disposed = false;
  let socket;
  let reconnects = 0;
  let latestTimestamp = 0;
  let lastSocketPrice = -Infinity;
  let lastRequest = -Infinity;
  let failures = 0;
  let blockedUntil = 0;
  let inFlight = null;
  let pollTimer;
  const status = (state, message) => { if (!disposed) onStatus({ state, message }); };
  const later = (fn, ms) => {
    const id = setTimer(() => { timers.delete(id); if (!disposed) fn(); }, ms);
    timers.add(id);
    return id;
  };
  const cancel = id => { clearTimer(id); timers.delete(id); };
  function emit(quote) {
    if (!disposed && quote && quote.timestamp >= latestTimestamp) {
      latestTimestamp = quote.timestamp;
      onPrice(quote);
      return true;
    }
    return false;
  }
  function schedulePoll(delay = pollInterval) {
    cancel(pollTimer);
    pollTimer = later(() => {
      if (now() - lastSocketPrice >= pollInterval) refresh();
      else schedulePoll();
    }, delay);
  }
  function refresh() {
    if (disposed) return Promise.resolve(null);
    if (inFlight) return inFlight;
    if (now() < blockedUntil || now() - lastRequest < Math.min(1000, pollInterval)) return Promise.resolve(null);
    lastRequest = now();
    // Start immediately; shared promise prevents overlapping REST requests.
    inFlight = (async () => {
      try {
        const quote = await provider.getPrice(symbol, { signal: controller.signal });
        if (disposed) return null;
        failures = 0;
        emit(quote);
        status(now() - lastSocketPrice < staleAfter ? 'live' : 'polling', `${label}; latest traded price.`);
        return quote;
      } catch (error) {
        if (!disposed) {
          failures++;
          blockedUntil = now() + Math.max(error.retryAfterMs ?? 0, Math.min(120_000, pollInterval * 2 ** Math.min(failures, 6)));
          status('offline', 'Market data unavailable. Enter a price manually or retry later.');
        }
        return null;
      } finally {
        inFlight = null;
        if (!disposed) schedulePoll(Math.max(pollInterval, blockedUntil - now()));
      }
    })();
    return inFlight;
  }
  function connect() {
    if (disposed) return;
    status('connecting', `Connecting to ${label}…`);
    let current;
    let ended = false;
    let watchdog;
    const disconnect = () => {
      if (ended || disposed) return;
      ended = true;
      cancel(watchdog);
      current?.close();
      lastSocketPrice = -Infinity;
      status('polling', 'WebSocket disconnected; trying REST prices.');
      if (reconnects < retryDelays.length) later(connect, retryDelays[reconnects++]);
      refresh();
    };
    try {
      current = socketFactory(provider.streamUrl(symbol));
      socket = current;
      watchdog = later(disconnect, connectionTimeout);
      current.onopen = () => { cancel(watchdog); };
      current.onmessage = event => {
        if (disposed || ended) return;
        try {
          const quote = parseStreamQuote(JSON.parse(event.data), symbol, now());
          if (!quote) return;
          cancel(watchdog);
          const accepted = emit(quote);
          // Replayed or delayed traffic is not evidence of a healthy price feed.
          if (accepted && now() - quote.timestamp <= staleAfter) {
            lastSocketPrice = now();
            status('live', `${label} WebSocket; latest traded price.`);
          }
        } catch { /* Ignore malformed frames without disrupting manual calculations. */ }
      };
      current.onclose = disconnect;
      current.onerror = disconnect;
    } catch { disconnect(); }
  }
  connect();
  refresh();
  return {
    refresh,
    dispose() {
      disposed = true;
      controller.abort();
      timers.forEach(clearTimer);
      timers.clear();
      if (socket) {
        socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
        socket.close();
      }
    },
  };
}
