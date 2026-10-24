import { calculateTrade, D, positiveDecimal, SYMBOL_PATTERN, tradeText } from './calculator.js';
import { createBinanceProvider, createPriceFeed, filtersFor, METADATA_TTL_MS, STALE_AFTER_MS } from './market.js';
import { renderTrade } from './view.js';

/** Reusable controller. Mount on a calculator root; dispose on view removal. */
export function mountTradeCalculator(root, { provider = createBinanceProvider() } = {}) {
  const find = selector => root.querySelector(selector);
  const form = find('#trade-form');
  const field = name => form.elements.namedItem(name);
  const touched = new Set();
  const events = new AbortController();
  let disposed = false;
  let metadata = null;
  let feed = null;
  let lookupController;
  let debounce;
  let generation = 0;
  let revision = 0;
  let latest = null;
  let reference = null;
  let source = 'manual';
  let locked = false;
  let showErrors = false;
  let result;
  let connection = { state: 'connecting', message: 'Loading market data…' };
  const symbol = () => field('symbol').value.trim().toUpperCase();
  const fresh = quote => quote && Date.now() - quote.timestamp <= STALE_AFTER_MS;
  const timestamp = ms => new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
  const selectedSymbol = () => metadata?.symbols.find(s => s.symbol === symbol());

  function inputs() {
    return {
      symbol: symbol(), direction: field('direction').value, orderType: field('orderType').value,
      entry: field(field('orderType').value === 'LIMIT' ? 'limitEntry' : 'marketEntry').value,
      wallet: field('wallet').value, risk: field('risk').value, profit: field('profit').value,
      tp: field('tp').value, sl: field('sl').value, quantityMode: field('quantityMode').value, quantity: field('quantity').value,
    };
  }
  function updateSnapshotStatus() {
    let text = 'Enter a reference price and take profit to get started.';
    let outdated = false;
    if (result?.ok) {
      if (field('orderType').value === 'LIMIT') text = 'Intended LIMIT entry. Market updates do not change this setup.';
      else if (source === 'manual') text = 'Manual reference price. Edit your inputs to update this estimate.';
      else {
        const stale = !fresh(reference);
        const priceMoved = latest && positiveDecimal(result.entry) && new D(latest.price).minus(result.entry).abs().div(result.entry).gte('0.001');
        outdated = stale || priceMoved;
        text = stale ? 'Reference snapshot is stale. Recalculate with a fresh price, or enter a manual price.' : priceMoved ? 'Market price has moved by at least 0.1%. Recalculate this setup.' : `Reference snapshot from ${timestamp(reference.timestamp)}. Recalculate to use the latest price.`;
      }
      if (locked) text = `Setup locked. ${text}`;
    }
    find('#snapshot-status').textContent = text;
    find('#snapshot-status').dataset.outdated = String(Boolean(outdated));
    find('#copy-setup').disabled = !result?.ok || Boolean(outdated);
    find('#lock-setup').disabled = !result?.ok;
    find('#lock-setup').textContent = locked ? 'Unlock setup' : 'Lock setup';
    find('#setup-state').textContent = locked ? 'Locked snapshot' : result?.ok ? 'Estimate' : 'Draft';
  }
  function updateMarketDisplay() {
    find('#market-symbol').textContent = symbol();
    find('#market-price').textContent = latest ? `${latest.price} USDT` : '—';
    find('#market-time').textContent = latest ? `Last successful price update: ${timestamp(latest.timestamp)}` : 'No successful price update yet';
    find('#market-source').textContent = latest?.source ?? 'Binance USD-M Futures';
    const stale = latest && !fresh(latest);
    const status = find('#connection-status');
    status.dataset.state = stale ? 'stale' : connection.state;
    status.textContent = stale ? 'Stale price' : connection.state === 'live' ? 'Live · WebSocket' : connection.state === 'polling' && fresh(latest) ? 'Recent · REST fallback' : connection.message;
    if (field('orderType').value === 'MARKET') {
      find('#entry-hint').textContent = source === 'live' && reference ? `${fresh(reference) ? 'Market' : 'Stale market'} snapshot · ${timestamp(reference.timestamp)}. Recalculate to refresh.` : field('marketEntry').value ? 'Manually entered reference price.' : 'Waiting for a reference price. You can type one manually.';
    }
    updateSnapshotStatus();
  }
  function updateFilters() {
    const current = selectedSymbol();
    const rules = metadata && Date.now() - metadata.fetchedAt < METADATA_TTL_MS ? filtersFor(current, field('orderType').value) : null;
    find('#filter-info').textContent = rules ? `Binance futures filters: tick ${rules.tickSize}; quantity step ${rules.lots.map(lot => lot.stepSize).join(' / ')}; minimum quantity ${rules.lots.map(lot => lot.minQty).join(' / ')}; minimum notional ${rules.minNotional ?? 'not supplied'} USDT. Loaded ${timestamp(metadata.fetchedAt)}. Account leverage limits unverified.` : 'Exchange filters unavailable or expired. Manual calculations are estimates; verify symbol, price and quantity rules on your exchange.';
    return rules;
  }
  function calculate() {
    if (locked || disposed) return;
    const values = inputs();
    result = calculateTrade(values, updateFilters());
    if (metadata && !selectedSymbol() && field('priceMode').value === 'live') {
      result.ok = false;
      result.errors.symbol = 'This symbol is not an active Binance USDT perpetual. Check the pair or choose manual pricing for another exchange.';
    }
    find('#setup-heading').textContent = `${values.symbol || 'Choose a pair'} ${values.orderType} ${values.direction}`;
    find('#limit-field').hidden = values.orderType !== 'LIMIT';
    find('#quantity-unit').textContent = `(${selectedSymbol()?.baseAsset ?? (SYMBOL_PATTERN.test(values.symbol) ? values.symbol.slice(0, -4) : 'coin')})`;
    const auto = values.quantityMode === 'auto';
    field('quantity').readOnly = auto;
    if (auto) field('quantity').value = result.quantity ?? '';
    field('quantity').placeholder = auto ? 'Calculated automatically' : 'Enter your quantity';
    renderTrade(root, result, { touched, showErrors, pendingOrder: field('pendingOrder').checked, orderType: values.orderType });
    updateMarketDisplay();
  }
  function adoptQuote(quote) {
    if (!fresh(quote)) return false;
    field('marketEntry').value = quote.price;
    reference = { ...quote };
    source = 'live';
    return true;
  }
  function setLocked(value) {
    // Any explicit lock/unlock supersedes an earlier asynchronous refresh.
    revision++;
    locked = value;
    find('#trade-inputs').disabled = value;
    if (!value) calculate();
    updateSnapshotStatus();
  }
  function stopMarket() {
    generation++;
    clearTimeout(debounce);
    lookupController?.abort();
    feed?.dispose();
    feed = null;
  }
  async function startMarket() {
    stopMarket();
    const currentGeneration = generation;
    const selected = symbol();
    if (!SYMBOL_PATTERN.test(selected)) {
      connection = { state: 'offline', message: 'Enter a USDT pair to load market data.' };
      updateMarketDisplay();
      return;
    }
    lookupController = new AbortController();
    connection = { state: 'connecting', message: 'Loading futures market data…' };
    updateMarketDisplay();
    try {
      const data = await provider.getSymbols({ signal: lookupController.signal });
      if (disposed || currentGeneration !== generation) return;
      metadata = data;
      find('#trade-symbols').replaceChildren(...metadata.symbols.map(s => { const option = document.createElement('option'); option.value = s.symbol; return option; }));
    } catch {
      if (disposed || currentGeneration !== generation) return;
      metadata = null;
    }
    calculate();
    if (metadata && !selectedSymbol()) {
      connection = { state: 'offline', message: 'No active Binance perpetual for this symbol.' };
      updateMarketDisplay();
      return;
    }
    feed = createPriceFeed(selected, {
      onPrice(quote) {
        if (disposed || currentGeneration !== generation) return;
        latest = quote;
        // Only the first fresh quote fills an empty reference. Ticks never reprice a setup.
        if (!locked && field('priceMode').value === 'live' && !field('marketEntry').value && adoptQuote(quote)) calculate();
        else updateMarketDisplay();
      },
      onStatus(status) { if (!disposed && currentGeneration === generation) { connection = status; updateMarketDisplay(); } },
    }, { provider });
  }
  async function recalculate(event) {
    event.preventDefault();
    showErrors = true;
    setLocked(false);
    find('#copy-status').textContent = '';
    find('#copy-fallback').hidden = true;
    const currentRevision = revision;
    const button = find('#recalculate');
    button.disabled = true;
    button.textContent = 'Refreshing…';
    try {
      if (field('priceMode').value === 'live') {
        if (!feed || !metadata || Date.now() - metadata.fetchedAt >= METADATA_TTL_MS) await startMarket();
        await feed?.refresh();
        if (!disposed && !locked && revision === currentRevision) adoptQuote(latest);
      }
      if (!disposed && revision === currentRevision) {
        calculate();
        if (!result.ok) root.querySelector('[aria-invalid="true"]')?.focus();
      }
    } finally {
      button.disabled = false;
      button.textContent = 'Recalculate';
    }
  }
  function edit(event) {
    const name = event.target.name;
    if (!name || locked) return;
    revision++;
    touched.add(name === 'marketEntry' || name === 'limitEntry' ? 'entry' : name);
    find('#copy-status').textContent = '';
    find('#copy-fallback').hidden = true;
    if (name === 'symbol') {
      stopMarket();
      latest = null;
      reference = null;
      source = 'manual';
      field('marketEntry').value = '';
      field('limitEntry').value = '';
      field('tp').value = '';
      field('sl').value = '';
      field('quantity').value = '';
      field('pendingOrder').checked = false;
      connection = { state: 'connecting', message: 'Waiting for a pair…' };
      debounce = setTimeout(startMarket, 500);
    }
    if (name === 'direction') field('pendingOrder').checked = false;
    if (name === 'marketEntry') { field('priceMode').value = 'manual'; source = 'manual'; reference = null; }
    if (name === 'priceMode') {
      if (field('priceMode').value === 'manual') { source = 'manual'; reference = null; }
      else if (!adoptQuote(latest)) { field('marketEntry').value = ''; reference = null; }
    }
    calculate();
  }
  async function copy() {
    updateSnapshotStatus();
    if (find('#copy-setup').disabled) return;
    const content = tradeText(result, {
      source: field('orderType').value === 'LIMIT' ? 'manual limit entry' : source === 'live' ? reference.source : 'manual',
      timestamp: field('orderType').value === 'MARKET' && source === 'live' && reference ? new Date(reference.timestamp).toISOString() : '',
      pendingOrder: field('pendingOrder').checked,
    });
    setLocked(true);
    const copyRevision = revision;
    try {
      await navigator.clipboard.writeText(content);
      if (disposed || revision !== copyRevision) return;
      find('#copy-status').textContent = 'Copied. This setup is locked; unlock to edit or recalculate for a fresh snapshot.';
    } catch {
      if (disposed || revision !== copyRevision) return;
      find('#copy-fallback').hidden = false;
      find('#copy-text').value = content;
      find('#copy-text').focus();
      find('#copy-text').select();
      find('#copy-status').textContent = 'Clipboard access was unavailable. Copy the selected text below. Setup locked.';
    }
  }
  function reset(event) {
    event.preventDefault();
    revision++;
    locked = false;
    find('#trade-inputs').disabled = false;
    for (const [name, value] of Object.entries({ symbol: 'COMPUSDT', direction: 'SHORT', orderType: 'MARKET', priceMode: 'live', marketEntry: '', limitEntry: '', wallet: '50', risk: '5', profit: '10', tp: '', sl: '', quantityMode: 'auto', quantity: '' })) field(name).value = value;
    field('pendingOrder').checked = false;
    touched.clear();
    showErrors = false;
    source = 'manual';
    reference = latest = null;
    find('#copy-status').textContent = '';
    find('#copy-fallback').hidden = true;
    calculate();
    startMarket();
  }
  form.addEventListener('input', edit, { signal: events.signal });
  form.addEventListener('submit', recalculate, { signal: events.signal });
  form.addEventListener('reset', reset, { signal: events.signal });
  find('#copy-setup').addEventListener('click', copy, { signal: events.signal });
  find('#lock-setup').addEventListener('click', () => setLocked(!locked), { signal: events.signal });
  let timer = setInterval(updateMarketDisplay, 1000);
  calculate();
  startMarket();
  return {
    suspend() { revision++; stopMarket(); clearInterval(timer); },
    resume() {
      if (disposed) return;
      clearInterval(timer);
      timer = setInterval(updateMarketDisplay, 1000);
      updateMarketDisplay();
      startMarket();
    },
    dispose() { disposed = true; revision++; stopMarket(); clearInterval(timer); events.abort(); },
  };
}
