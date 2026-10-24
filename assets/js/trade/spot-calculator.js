import { commonStep, formatNumber, positiveDecimal, SYMBOL_PATTERN } from './calculator.js';

/** Unleveraged spot BUY: budget / entry gives coins; exits value those same coins. */
export function calculateSpot(input, filters = null) {
  const errors = {};
  const warnings = [];
  const fail = () => ({ ok: false, errors, warnings });
  const symbol = String(input.symbol ?? '').trim().toUpperCase();
  if (!SYMBOL_PATTERN.test(symbol)) errors.symbol = 'Enter a USDT pair such as QNTUSDT.';
  const values = {};
  const hasStop = String(input.sl ?? '').trim() !== '';
  const labels = { entry: 'Entry price', investment: 'Investment', tp: 'Take profit', sl: 'Stop loss' };
  for (const key of ['entry', 'investment', 'tp', ...(hasStop ? ['sl'] : [])]) {
    values[key] = positiveDecimal(input[key]);
    if (!values[key]) errors[key] = `${labels[key]} must be a positive number between 0.000000000000000001 and 1,000,000,000,000,000, with at most 18 decimal places.`;
  }
  if (Object.keys(errors).length) return fail();
  const { entry, investment, tp, sl } = values;
  if (tp.lte(entry)) errors.tp = 'For a spot buy, take profit must be above your entry price.';
  if (sl?.gte(entry)) errors.sl = 'For a spot buy, stop loss must be below your entry price.';
  for (const [key, price] of [['entry', entry], ['tp', tp], ...(sl ? [['sl', sl]] : [])]) {
    if (key !== 'entry' && positiveDecimal(filters?.tickSize) && !price.mod(filters.tickSize).isZero()) errors[key] = `${labels[key]} must follow the exchange price tick ${filters.tickSize}.`;
    if (positiveDecimal(filters?.minPrice)?.gt(price)) errors[key] = `${labels[key]} is below the exchange minimum price.`;
    if (positiveDecimal(filters?.maxPrice)?.lt(price)) errors[key] = `${labels[key]} exceeds the exchange maximum price.`;
  }
  if (Object.keys(errors).length) return fail();
  const lots = filters?.lots ?? [];
  const step = commonStep(lots);
  const rawQuantity = investment.div(entry);
  const quantity = rawQuantity.div(step).floor().mul(step);
  if (quantity.lte(0) || quantity.gt('1e18')) errors.investment = 'This investment produces an unsupported quantity. Check the amount and entry price.';
  for (const lot of lots) {
    if (positiveDecimal(lot.minQty)?.gt(quantity)) errors.investment = `Investment is too small for the exchange minimum quantity ${lot.minQty}.`;
    if (positiveDecimal(lot.maxQty)?.lt(quantity)) errors.investment = `Quantity exceeds the exchange maximum ${lot.maxQty}.`;
  }
  const spent = quantity.mul(entry);
  if (positiveDecimal(filters?.minNotional)?.gt(spent)) errors.investment = `Purchase value is below the exchange minimum ${filters.minNotional} USDT.`;
  if (positiveDecimal(filters?.maxNotional)?.lt(spent)) errors.investment = `Purchase value exceeds the exchange maximum ${filters.maxNotional} USDT.`;
  if (Object.keys(errors).length) return fail();
  const grossTP = tp.minus(entry).mul(quantity);
  const grossSL = sl ? sl.minus(entry).mul(quantity) : null;
  const unspent = investment.minus(spent);
  if (!unspent.isZero()) warnings.push(`Quantity was rounded down. ${formatNumber(unspent, 6)} USDT of your investment remains unspent before fees.`);
  if (!filters) warnings.push('Exchange filters unavailable: verify the pair, quantity steps and order minimums on your exchange.');
  if (grossSL && grossSL.abs().div(spent).gte('0.1')) warnings.push(`The stop risks ${formatNumber(grossSL.abs().div(spent).mul(100), 2)}% of the amount invested in this coin.`);
  if (!sl) warnings.push('No stop loss is set. A loss estimate and risk/reward ratio cannot be calculated without an exit price.');
  warnings.push('Gross estimates exclude trading fees and slippage. Market prices and stop execution can differ from this plan.');
  const text = value => value?.toFixed() ?? null;
  return {
    ok: true, errors, warnings, symbol, baseAsset: filters?.baseAsset ?? symbol.slice(0, -4),
    entry: text(entry), investment: text(investment), quantity: text(quantity), spent: text(spent), unspent: text(unspent),
    tp: text(tp), sl: text(sl), grossTP: text(grossTP), grossSL: text(grossSL),
    tpValue: text(quantity.mul(tp)), slValue: sl ? text(quantity.mul(sl)) : null,
    tpPercent: text(tp.minus(entry).div(entry).mul(100)), slPercent: sl ? text(sl.minus(entry).div(entry).mul(100)) : null,
    rewardRisk: grossSL ? text(grossTP.div(grossSL.abs())) : null,
  };
}

export function spotTradeText(result, { source = 'manual', timestamp = '' } = {}) {
  if (!result.ok) throw new Error('A valid spot setup is required before copying.');
  const r = result;
  return [
    `${r.symbol} SPOT BUY`, '', `Entry price: ${r.entry} USDT`,
    `Investment budget: ${formatNumber(r.investment, 2)} USDT`, `Quantity: ${r.quantity} ${r.baseAsset}`,
    `Amount invested: ${formatNumber(r.spent, 2)} USDT`, `Unspent balance: ${formatNumber(r.unspent, 2)} USDT`,
    `Take Profit: ${r.tp}`, `Coin value at TP: ${formatNumber(r.tpValue, 2)} USDT`,
    `Gross TP: approx +${formatNumber(r.grossTP, 2)} USDT (+${formatNumber(r.tpPercent, 2)}%)`,
    `Stop Loss: ${r.sl ?? 'not set'}`,
    ...(r.sl ? [`Coin value at SL: ${formatNumber(r.slValue, 2)} USDT`, `Gross SL: approx ${formatNumber(r.grossSL, 2)} USDT (${formatNumber(r.slPercent, 2)}%)`, `Risk/Reward (risk:reward): 1:${formatNumber(r.rewardRisk, 2)}`] : []),
    `Price source: ${source}${timestamp ? `; ${timestamp}` : ''}`, '', ...r.warnings,
    ...(source !== 'manual' ? ['Recalculate if market price changes.'] : []),
  ].join('\n');
}
