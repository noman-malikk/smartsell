import Decimal from '../vendor/decimal.mjs';

// Strings cross the module boundary; binary floating point never sizes a trade.
export const D = Decimal.clone({ precision: 80, rounding: Decimal.ROUND_DOWN, toExpNeg: -80, toExpPos: 80 });
export const DEFAULT_SETTINGS = Object.freeze({ marginUsage: '0.8', maxLeverage: 10 });
export const SYMBOL_PATTERN = /^[A-Z0-9]{1,24}USDT$/;

export function positiveDecimal(value) {
  const text = String(value ?? '').trim();
  if (text.length > 64 || !/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d{1,3})?$/i.test(text)) return null;
  const n = new D(text);
  return n.isFinite() && n.gte('1e-18') && n.lte('1e15') && n.decimalPlaces() <= 18 ? n : null;
}

function positiveFilter(value) {
  return positiveDecimal(value);
}

function commonStep(lots) {
  // LCM on scaled integers handles non-nested steps, e.g. 0.02 and 0.03.
  const steps = lots.map(lot => positiveFilter(lot.stepSize)).filter(Boolean);
  if (!steps.length) return new D('1e-18');
  const scale = new D(10).pow(Math.max(...steps.map(step => step.decimalPlaces())));
  const gcd = (a, b) => { while (!b.isZero()) { [a, b] = [b, a.mod(b)]; } return a; };
  return steps.map(step => step.mul(scale)).reduce((a, b) => a.div(gcd(a, b)).mul(b)).div(scale);
}

function roundedTo(value, step, mode) {
  return value.div(step).toDecimalPlaces(0, mode).mul(step);
}

/** Pure linear USDT perpetual calculation. Values and filters are decimal strings.
 * filters.lots contains LOT_SIZE and, for MARKET entries, MARKET_LOT_SIZE.
 * Optional leverageBrackets/supportedLeverages must come from a trusted provider.
 */
export function calculateTrade(input, filters = null, settings = {}) {
  const config = { ...DEFAULT_SETTINGS, ...settings };
  const errors = {};
  const warnings = [];
  const fail = () => ({ ok: false, errors, warnings, leverage: null, margin: null, remaining: null });
  const symbol = String(input.symbol ?? '').trim().toUpperCase();
  if (!SYMBOL_PATTERN.test(symbol)) errors.symbol = 'Enter a USDT pair such as BTCUSDT or COMPUSDT.';
  if (!['LONG', 'SHORT'].includes(input.direction)) errors.direction = 'Choose LONG or SHORT.';
  if (!['MARKET', 'LIMIT'].includes(input.orderType)) errors.orderType = 'Choose MARKET or LIMIT.';
  if (!['auto', 'manual'].includes(input.quantityMode)) errors.quantityMode = 'Choose automatic or manual quantity.';
  const values = {};
  const labels = { entry: 'Reference entry price', wallet: 'Wallet balance', risk: 'Maximum loss', profit: 'Desired profit', tp: 'Take profit', sl: 'Stop loss', quantity: 'Quantity' };
  const providedSL = String(input.sl ?? '').trim() !== '';
  const required = ['entry', 'wallet', 'risk', 'profit', 'tp', ...(providedSL ? ['sl'] : []), ...(input.quantityMode === 'manual' ? ['quantity'] : [])];
  for (const key of required) {
    values[key] = positiveDecimal(input[key]);
    if (!values[key]) errors[key] = `${labels[key]} must be a positive number (up to 15 integer digits and 18 decimal places).`;
  }
  const marginUsage = positiveDecimal(config.marginUsage);
  if (!marginUsage || marginUsage.gt(1) || !Number.isInteger(config.maxLeverage) || config.maxLeverage < 1 || config.maxLeverage > 125) errors.settings = 'Invalid margin or leverage settings.';
  if (Object.keys(errors).length) return fail();

  const { entry, wallet, risk, profit, tp } = values;
  const long = input.direction === 'LONG';
  const profitDistance = long ? tp.minus(entry) : entry.minus(tp);
  if (profitDistance.lte(0)) errors.tp = `For a ${input.direction}, take profit must be ${long ? 'above' : 'below'} entry.`;
  if (providedSL && (long ? values.sl.gte(entry) : values.sl.lte(entry))) errors.sl = `For a ${input.direction}, stop loss must be ${long ? 'below' : 'above'} entry.`;
  const tick = positiveFilter(filters?.tickSize);
  function checkPrice(key, price, enforceTick = true) {
    if (tick && enforceTick && !price.mod(tick).isZero()) errors[key] = `${labels[key]} must be a multiple of the exchange tick size ${tick}.`;
    if (positiveFilter(filters?.minPrice)?.gt(price)) errors[key] = `${labels[key]} is below the exchange minimum price.`;
    if (positiveFilter(filters?.maxPrice)?.lt(price)) errors[key] = `${labels[key]} is above the exchange maximum price.`;
  }
  checkPrice('entry', entry, input.orderType === 'LIMIT');
  checkPrice('tp', tp);
  if (providedSL) checkPrice('sl', values.sl);
  if (Object.keys(errors).length) return fail();

  const lots = filters?.lots ?? [];
  const step = commonStep(lots);
  const manual = input.quantityMode === 'manual';
  const rawQuantity = manual ? values.quantity : providedSL ? risk.div(entry.minus(values.sl).abs()) : profit.div(profitDistance);
  // A manual quantity is never silently altered. An automatic one is rounded down.
  const quantity = manual ? rawQuantity : roundedTo(rawQuantity, step, D.ROUND_DOWN);
  if (quantity.lte(0)) errors.quantity = 'Exchange quantity precision makes this setup too small. Increase the sizing objective or revise the exits.';
  if (quantity.gt('1e18')) errors.quantity = 'Calculated quantity is too large. Check the entry and exit distances.';
  for (const lot of lots) {
    const lotStep = positiveFilter(lot.stepSize);
    if (lotStep && !quantity.mod(lotStep).isZero()) errors.quantity = `Manual quantity must be a multiple of the exchange step ${lotStep}; your quantity was not changed.`;
    if (positiveFilter(lot.minQty)?.gt(quantity)) errors.quantity = `Quantity is below the exchange minimum ${lot.minQty}.`;
    if (positiveFilter(lot.maxQty)?.lt(quantity)) errors.quantity = `Quantity exceeds the exchange maximum ${lot.maxQty}.`;
  }
  if (Object.keys(errors).length) return fail();

  const calculatedSL = !providedSL;
  let sl = values.sl;
  if (calculatedSL) {
    const rawSL = long ? entry.minus(risk.div(quantity)) : entry.plus(risk.div(quantity));
    sl = roundedTo(rawSL, tick ?? new D('1e-18'), long ? D.ROUND_CEIL : D.ROUND_FLOOR);
    if (sl.lte(0) || (long ? sl.gte(entry) : sl.lte(entry))) errors.sl = 'No positive, correctly directed calculated stop fits this risk and price precision. Revise the sizing inputs.';
    checkPrice('sl', sl);
  }
  if (Object.keys(errors).length) return fail();

  const notional = quantity.mul(entry);
  if (notional.gt('1e18')) errors.quantity = 'Position value is too large. Check the inputs.';
  if (positiveFilter(filters?.minNotional)?.gt(notional)) errors.quantity = `Position value is below the exchange minimum notional ${filters.minNotional} USDT.`;
  if (Object.keys(errors).length) return fail();

  const grossTP = profitDistance.mul(quantity);
  const grossSL = (long ? sl.minus(entry) : entry.minus(sl)).mul(quantity);
  const loss = grossSL.abs();
  const walletRisk = loss.div(wallet).mul(100);
  const selectedRisk = risk.div(wallet).mul(100);
  const marginBudget = wallet.mul(marginUsage);
  const bracket = filters?.leverageBrackets?.find(b => notional.gte(b.notionalFloor) && notional.lt(b.notionalCap));
  const supported = config.supportedLeverages ?? Array.from({ length: config.maxLeverage }, (_, i) => i + 1);
  const allowed = supported.filter(n => Number.isInteger(n) && n >= 1 && n <= config.maxLeverage && (!filters?.leverageBrackets || (bracket && n <= bracket.initialLeverage))).sort((a, b) => a - b);
  const leverage = allowed.find(n => notional.div(n).lte(marginBudget)) ?? null;
  const margin = leverage ? notional.div(leverage) : null;
  if (!leverage) errors.margin = 'HIGH LEVERAGE REQUIRED — the requested trade does not fit the current margin settings or exchange leverage constraints.';
  if (selectedRisk.gte(10) || walletRisk.gte(10)) warnings.push(`High wallet risk: selected risk is ${formatNumber(selectedRisk, 2)}% and planned gross stop loss is ${formatNumber(walletRisk, 2)}% of your wallet.`);
  if (loss.gt(risk)) warnings.push(`Manual quantity produces a gross stop loss of ${formatNumber(loss, 4)} USDT, which exceeds your selected ${formatNumber(risk)} USDT maximum loss. Your quantity and stop were preserved.`);
  if (grossTP.minus(profit).abs().gt('0.00000001')) warnings.push(`At this quantity and stop loss, estimated TP profit is ${formatNumber(grossTP, 4)} USDT, not the requested ${formatNumber(profit)} USDT. Risk and the supplied stop were not increased to meet the objective.`);
  if (calculatedSL) warnings.push('Calculated SL: derived from financial risk inputs, not validated technical support or resistance.');
  if (!manual && !quantity.eq(rawQuantity)) warnings.push('Automatic quantity was rounded down; actual profit and loss were recalculated.');
  if (!filters) warnings.push('Exchange filters unavailable: this is a mathematical estimate. Verify tick size, quantity step, minimums and symbol availability on your exchange.');
  if (!filters?.leverageBrackets && !config.supportedLeverages) warnings.push('Exchange leverage limits are unverified. Suggested leverage assumes integer levels; confirm account and position-tier limits on your exchange.');
  warnings.push('Gross PnL excludes fees, funding and slippage. Net losses can exceed the selected gross risk.');
  warnings.push('Verify the exchange liquidation price and ensure your stop is safely before liquidation. The wallet buffer is not liquidation protection.');

  return {
    ok: !Object.keys(errors).length, errors, warnings, symbol, baseAsset: filters?.baseAsset ?? symbol.slice(0, -4),
    direction: input.direction, orderType: input.orderType, calculatedSL, leverage,
    leverageVerified: Boolean(filters?.leverageBrackets || config.supportedLeverages),
    entry: entry.toFixed(), quantity: quantity.toFixed(), rawQuantity: rawQuantity.toFixed(), sl: sl.toFixed(), tp: tp.toFixed(),
    notional: notional.toFixed(), grossTP: grossTP.toFixed(), grossSL: grossSL.toFixed(), wallet: wallet.toFixed(),
    selectedRisk: selectedRisk.toFixed(), walletRisk: walletRisk.toFixed(), rewardRisk: grossTP.div(loss).toFixed(),
    marginBudget: marginBudget.toFixed(), margin: margin?.toFixed() ?? null, remaining: margin ? wallet.minus(margin).toFixed() : null,
    marginPercent: margin ? margin.div(wallet).mul(100).toFixed() : null,
    profitDistance: profitDistance.toFixed(), stopDistance: entry.minus(sl).abs().toFixed(),
    comparisons: [3, 5, 10].filter(n => n <= config.maxLeverage).map(n => ({ leverage: n, margin: notional.div(n).toFixed(), fits: allowed.includes(n) && notional.div(n).lte(marginBudget) })),
  };
}

export function formatNumber(value, places) {
  if (value === null || value === undefined) return '—';
  const number = new D(value);
  if (!number.isFinite()) return '—';
  if (places === undefined) return number.toFixed();
  const rounded = number.toDecimalPlaces(places, D.ROUND_HALF_UP);
  // Do not turn small, nonzero financial amounts into misleading zeroes.
  return rounded.isZero() && !number.isZero() ? number.toSignificantDigits(4, D.ROUND_HALF_UP).toFixed() : rounded.toFixed(places);
}

export function tradeText(result, { source = 'manual', pendingOrder = false, timestamp = '' } = {}) {
  if (!result.ok) throw new Error('A valid setup is required before copying.');
  const r = result;
  return [
    `${r.symbol} ${r.orderType} ${r.direction}`, '',
    `Reference price: ${r.entry}`, `Quantity: ${r.quantity} ${r.baseAsset}`,
    `Leverage: ${r.leverage}x Isolated${r.leverageVerified ? '' : ' (provisional; verify exchange limits)'}`,
    `Approx margin: ${formatNumber(r.margin, 2)} USDT`,
    `${r.calculatedSL ? 'Calculated SL' : 'Stop Loss'}: ${r.sl}`, `Take Profit: ${r.tp}`,
    `Gross SL: approx ${formatNumber(r.grossSL, 2)} USDT`, `Gross TP: approx +${formatNumber(r.grossTP, 2)} USDT`,
    `Risk/Reward (risk:reward): 1:${formatNumber(r.rewardRisk, 2)}`,
    `Position size: ${formatNumber(r.notional, 4)} USDT`, `Wallet balance: ${formatNumber(r.wallet, 2)} USDT`,
    `Wallet risk: ${formatNumber(r.walletRisk, 2)}%`, `Remaining wallet: ${formatNumber(r.remaining, 2)} USDT (before costs and other positions)`,
    `Price source: ${source}${timestamp ? `; ${timestamp}` : ''}`, '',
    ...r.warnings,
    pendingOrder ? `Cancel old pending ${r.direction.toLowerCase()} order first.` : 'Check for existing pending orders before placing a new trade.',
    ...(r.orderType === 'MARKET' && source !== 'manual' ? ['Recalculate if market price changes.'] : []),
  ].join('\n');
}
