/** Absence in successful primary metadata triggers fallback; an outage does not. */
export async function resolveMarket(symbol, primary, fallback, { signal } = {}) {
  signal?.throwIfAborted();
  const metadata = await primary.getSymbols({ signal });
  signal?.throwIfAborted();
  if (metadata.symbols.some(s => s.symbol === symbol)) return { provider: primary, metadata };

  let alternative;
  try {
    alternative = await fallback.getSymbols({ signal });
    signal?.throwIfAborted();
  } catch (error) {
    signal?.throwIfAborted();
    if (error.name === 'AbortError') throw error;
    return { provider: null, metadata, message: 'Bitget market data unavailable. Enter a manual price or retry later.' };
  }
  const symbols = new Map(alternative.symbols.map(s => [s.symbol, s]));
  for (const item of metadata.symbols) symbols.set(item.symbol, item);
  return {
    provider: alternative.symbols.some(s => s.symbol === symbol) ? fallback : null,
    metadata: { symbols: [...symbols.values()].sort((a, b) => a.symbol.localeCompare(b.symbol)), fetchedAt: Math.min(metadata.fetchedAt, alternative.fetchedAt) },
    message: 'No active pair on Binance or Bitget in this market. Enter a manual price.',
  };
}
