import { D, formatNumber, positiveDecimal, SYMBOL_PATTERN } from './calculator.js';
import { calculateSpot, spotTradeText } from './spot-calculator.js';
import { createSpotProvider, spotFiltersFor } from './spot-market.js';
import { createPriceFeed, METADATA_TTL_MS, STALE_AFTER_MS } from './market.js';

export function mountSpotCalculator(root, { provider = createSpotProvider() } = {}) {
  const find = selector => root.querySelector(selector);
  const form = find('#spot-form');
  const field = name => form.elements.namedItem(name);
  const events = new AbortController();
  const touched = new Set();
  let metadata = null;
  let feed;
  let lookup;
  let debounce;
  let timer;
  let generation = 0;
  let revision = 0;
  let active = true;
  let disposed = false;
  let latest = null;
  let reference = null;
  let locked = false;
  let showErrors = false;
  let result;
  let connection = { state: 'connecting', message: 'Loading spot data…' };
  const symbol = () => field('symbol').value.trim().toUpperCase();
  const selected = () => metadata?.symbols.find(s => s.symbol === symbol());
  const fresh = quote => quote && Date.now() - quote.timestamp <= STALE_AFTER_MS;
  const date = time => new Date(time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
  const setText = (id, text) => { find(id).textContent = text; };
  const dollars = value => value === null ? 'Not set' : `${formatNumber(value, 2)} USDT`;

  function status() {
    setText('#spot-market-symbol', symbol());
    setText('#spot-market-price', latest ? `${latest.price} USDT` : '—');
    setText('#spot-market-source', latest?.source ?? 'Binance Spot');
    setText('#spot-market-time', latest ? `Last successful price update: ${date(latest.timestamp)}` : 'No successful price update yet');
    const staleQuote = latest && !fresh(latest);
    const badge = find('#spot-connection');
    badge.dataset.state = staleQuote ? 'stale' : connection.state;
    badge.textContent = staleQuote ? 'Stale spot price' : connection.state === 'live' ? 'Live · Spot WebSocket' : connection.state === 'polling' && fresh(latest) ? 'Recent · Spot REST' : connection.message;
    let outdated = false;
    let text = 'Add an entry price and take profit to see your potential return.';
    if (result?.ok) {
      if (!reference) text = 'Manual entry price. Edit your inputs to update the outcome.';
      else {
        const moved = latest && positiveDecimal(result.entry) && new D(latest.price).minus(result.entry).abs().div(result.entry).gte('0.001');
        outdated = !fresh(reference) || moved;
        text = !fresh(reference) ? 'Spot reference is stale. Recalculate or enter a manual price.' : moved ? 'Spot market price has moved by at least 0.1%. Recalculate this setup.' : `Spot reference from ${date(reference.timestamp)}. Recalculate for the latest price.`;
      }
      if (locked) text = `Setup locked. ${text}`;
    }
    setText('#spot-entry-hint', reference ? `${fresh(reference) ? 'Spot market' : 'Stale spot'} snapshot · ${date(reference.timestamp)}` : 'Manually enter your purchase price, or use spot market data.');
    setText('#spot-snapshot', text);
    find('#spot-snapshot').dataset.outdated = String(Boolean(outdated));
    find('#spot-copy').disabled = !result?.ok || Boolean(outdated);
    find('#spot-lock').disabled = !result?.ok;
    setText('#spot-lock', locked ? 'Unlock spot setup' : 'Lock spot setup');
    setText('#spot-setup-state', locked ? 'Locked snapshot' : result?.ok ? 'Estimate' : 'Draft');
  }
  function render() {
    setText('#spot-setup-heading', `${symbol() || 'Choose a coin'} SPOT BUY`);
    root.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
    root.querySelectorAll('.trade-field-error').forEach(el => { el.textContent = ''; });
    const errors = Object.entries(result.errors).filter(([key]) => showErrors || touched.has(key) || !['entry', 'tp'].includes(key));
    const summary = find('#spot-errors');
    summary.replaceChildren();
    for (const [key, message] of errors) {
      setText(`#spot-error-${key}`, message);
      field(key)?.setAttribute('aria-invalid', 'true');
      const p = document.createElement('p'); p.textContent = message; summary.append(p);
    }
    summary.hidden = !errors.length;
    find('#spot-results').hidden = !result.ok;
    find('#spot-empty').hidden = result.ok || errors.length > 0;
    if (!result.ok) { status(); return; }
    const r = result;
    const displayed = {
      entry: r.entry, quantity: `${r.quantity} ${r.baseAsset}`, investment: dollars(r.investment), spent: dollars(r.spent), unspent: dollars(r.unspent),
      tp: r.tp, sl: r.sl ?? 'Not set', grossTP: `+${dollars(r.grossTP)}`, grossSL: dollars(r.grossSL), tpValue: dollars(r.tpValue), slValue: dollars(r.slValue),
      tpPercent: `+${formatNumber(r.tpPercent, 2)}%`, slPercent: r.slPercent === null ? 'Not set' : `${formatNumber(r.slPercent, 2)}%`,
      rewardRisk: r.rewardRisk === null ? 'Not set' : `1:${formatNumber(r.rewardRisk, 2)}`,
    };
    root.querySelectorAll('[data-spot-value]').forEach(el => { el.textContent = displayed[el.dataset.spotValue]; });
    setText('#spot-example', `At ${r.entry} USDT per coin, ${dollars(r.spent)} buys ${r.quantity} ${r.baseAsset}. At your ${r.tp} TP, those coins would be worth ${dollars(r.tpValue)} — a gross profit of ${dollars(r.grossTP)}.${r.sl ? ` At your ${r.sl} SL, they would be worth ${dollars(r.slValue)}, a gross loss of ${dollars(new D(r.grossSL).abs())}.` : ''}`);
    const lines = [
      `Quantity = ${r.investment} ÷ ${r.entry}, rounded down to ${r.quantity} ${r.baseAsset}.`,
      `Amount invested = ${r.quantity} × ${r.entry} = ${r.spent} USDT.`,
      `TP profit = (${r.tp} − ${r.entry}) × ${r.quantity} = ${formatNumber(r.grossTP, 6)} USDT.`,
      ...(r.sl ? [`SL loss = (${r.sl} − ${r.entry}) × ${r.quantity} = ${formatNumber(r.grossSL, 6)} USDT.`] : []),
      'Return percentages use the amount actually invested. Coin values exclude any unspent balance.',
    ];
    const nodes = (texts, tag) => texts.map(text => { const el = document.createElement(tag); el.textContent = text; return el; });
    find('#spot-breakdown').replaceChildren(...nodes(lines, 'p'));
    find('#spot-warnings').replaceChildren(...nodes(r.warnings, 'li'));
    status();
  }
  function calculate() {
    if (!active || disposed || locked) return;
    const rules = metadata && Date.now() - metadata.fetchedAt < METADATA_TTL_MS ? spotFiltersFor(selected()) : null;
    setText('#spot-filter-info', rules ? `Binance Spot filters: price tick ${rules.tickSize}; quantity steps ${rules.lots.map(l => l.stepSize).join(' / ')}. Order minimums use the reference price; verify execution rules on the exchange.` : 'Spot exchange filters unavailable or expired. This is a mathematical estimate; verify order rules on your exchange.');
    result = calculateSpot(Object.fromEntries(['entry', 'investment', 'tp', 'sl'].map(name => [name, field(name).value]).concat([['symbol', symbol()]])), rules);
    if (metadata && !selected() && field('priceMode').value === 'live') {
      result.ok = false;
      result.errors.symbol = 'This pair is not an active Binance Spot USDT pair. Check the symbol or choose a manual price for another exchange.';
    }
    render();
  }
  function adopt(quote) {
    if (!fresh(quote)) return false;
    reference = { ...quote };
    field('entry').value = quote.price;
    return true;
  }
  function lock(value) {
    revision++;
    locked = value;
    find('#spot-inputs').disabled = value;
    if (!value) calculate();
    status();
  }
  function stop() { generation++; clearTimeout(debounce); lookup?.abort(); feed?.dispose(); feed = null; }
  async function start() {
    stop();
    if (!active || disposed) return;
    const token = generation;
    const pair = symbol();
    if (!SYMBOL_PATTERN.test(pair)) { connection = { state: 'offline', message: 'Enter a USDT spot pair.' }; status(); return; }
    lookup = new AbortController();
    connection = { state: 'connecting', message: 'Loading Binance Spot data…' };
    status();
    try {
      const data = await provider.getSymbols({ signal: lookup.signal });
      if (!active || disposed || token !== generation) return;
      metadata = data;
      find('#spot-symbols').replaceChildren(...metadata.symbols.map(s => { const option = document.createElement('option'); option.value = s.symbol; return option; }));
    } catch { if (!active || disposed || token !== generation) return; metadata = null; }
    calculate();
    if (metadata && !selected()) { connection = { state: 'offline', message: 'Spot pair unavailable on Binance.' }; status(); return; }
    feed = createPriceFeed(pair, {
      onPrice(quote) {
        if (!active || disposed || token !== generation) return;
        latest = quote;
        if (!locked && field('priceMode').value === 'live' && !field('entry').value && adopt(quote)) calculate();
        else status();
      },
      onStatus(state) { if (active && !disposed && token === generation) { connection = state; status(); } },
    }, { provider });
  }
  function edit(event) {
    if (!event.target.name || locked || !active) return;
    revision++;
    const name = event.target.name;
    touched.add(name);
    setText('#spot-copy-status', '');
    find('#spot-copy-fallback').hidden = true;
    if (name === 'entry') { reference = null; field('priceMode').value = 'manual'; }
    if (name === 'priceMode') {
      if (field('priceMode').value === 'manual') reference = null;
      else if (!adopt(latest)) { reference = null; field('entry').value = ''; }
    }
    if (name === 'symbol') {
      stop(); latest = reference = null;
      for (const key of ['entry', 'tp', 'sl']) field(key).value = '';
      connection = { state: 'connecting', message: 'Waiting for a spot pair…' };
      debounce = setTimeout(start, 500);
    }
    calculate();
  }
  async function refresh(event) {
    event.preventDefault();
    lock(false); showErrors = true;
    setText('#spot-copy-status', ''); find('#spot-copy-fallback').hidden = true;
    const token = revision;
    find('#spot-recalculate').disabled = true;
    try {
      if (field('priceMode').value === 'live') {
        if (!feed || !metadata || Date.now() - metadata.fetchedAt >= METADATA_TTL_MS) await start();
        await feed?.refresh();
        if (active && !disposed && !locked && token === revision) adopt(latest);
      }
      if (active && !disposed && token === revision) { calculate(); root.querySelector('[aria-invalid="true"]')?.focus(); }
    } finally { find('#spot-recalculate').disabled = false; }
  }
  async function copy() {
    status(); if (find('#spot-copy').disabled) return;
    const text = spotTradeText(result, { source: reference?.source ?? 'manual', timestamp: reference ? new Date(reference.timestamp).toISOString() : '' });
    lock(true);
    const copyRevision = revision;
    try {
      await navigator.clipboard.writeText(text);
      if (disposed || !active || revision !== copyRevision) return;
      setText('#spot-copy-status', 'Copied. Spot setup locked; unlock to edit or recalculate for a fresh reference.');
    }
    catch {
      if (disposed || !active || revision !== copyRevision) return;
      find('#spot-copy-fallback').hidden = false; find('#spot-copy-text').value = text; find('#spot-copy-text').focus(); find('#spot-copy-text').select();
      setText('#spot-copy-status', 'Clipboard unavailable. Copy the selected text below. Spot setup locked.');
    }
  }
  function reset(event) {
    event.preventDefault(); revision++; locked = false; showErrors = false; touched.clear();
    find('#spot-inputs').disabled = false;
    for (const [key, value] of Object.entries({ symbol: 'QNTUSDT', priceMode: 'live', entry: '', investment: '50', tp: '', sl: '' })) field(key).value = value;
    latest = reference = null;
    setText('#spot-copy-status', ''); find('#spot-copy-fallback').hidden = true;
    calculate(); start();
  }
  form.addEventListener('input', edit, { signal: events.signal });
  form.addEventListener('submit', refresh, { signal: events.signal });
  form.addEventListener('reset', reset, { signal: events.signal });
  find('#spot-copy').addEventListener('click', copy, { signal: events.signal });
  find('#spot-lock').addEventListener('click', () => lock(!locked), { signal: events.signal });
  timer = setInterval(status, 1000); calculate(); start();
  return {
    suspend() { active = false; revision++; stop(); clearInterval(timer); },
    resume() { if (disposed) return; active = true; clearInterval(timer); timer = setInterval(status, 1000); status(); start(); },
    dispose() { disposed = true; active = false; revision++; stop(); clearInterval(timer); events.abort(); },
  };
}
