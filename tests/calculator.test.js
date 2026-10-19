import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTrade, formatNumber, tradeText } from '../assets/js/trade/calculator.js';

const base = { symbol: 'COMPUSDT', direction: 'SHORT', orderType: 'MARKET', entry: '21.37', wallet: '50', risk: '5', profit: '10', tp: '20.24', sl: '', quantityMode: 'auto', quantity: '' };
const filters = { tickSize: '0.01', minPrice: '0.01', maxPrice: '1000000', lots: [{ stepSize: '0.01', minQty: '0.01', maxQty: '1000000' }], minNotional: '5' };
const calc = (values = {}, rules = null, settings = {}) => calculateTrade({ ...base, ...values }, rules, settings);
const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(Number(actual) - expected) < tolerance, `${actual} ≈ ${expected}`);

test('A: manual SHORT has exact notional and signed PnL; lowest affordable leverage is 3x', () => {
  const r = calc({ sl: '22.55', quantityMode: 'manual', quantity: '4.10' });
  assert.equal(r.ok, true);
  assert.equal(r.notional, '87.617');
  assert.equal(r.grossSL, '-4.838');
  assert.equal(r.grossTP, '4.633');
  assert.equal(r.leverage, 3);
  close(r.margin, 29.2056666667);
  assert.match(r.warnings.join(' '), /4.633.*10/);
});

test('B: missing stop sizes by profit, derives risk stop, then recommends 5x', () => {
  const r = calc();
  assert.equal(r.ok, true);
  close(r.quantity, 8.84955752212389);
  close(r.notional, 189.115044247788);
  close(r.sl, 21.935);
  close(r.grossSL, -5);
  close(r.grossTP, 10);
  assert.equal(r.leverage, 5);
  assert.equal(r.calculatedSL, true);
});

test('C: LONG automatic quantity, calculated stop and signed PnL', () => {
  const r = calc({ direction: 'LONG', entry: '100', tp: '110' });
  assert.equal(r.quantity, '1');
  assert.equal(r.sl, '95');
  assert.equal(r.grossSL, '-5');
  assert.equal(r.grossTP, '10');
  assert.equal(r.rewardRisk, '2');
});

test('D: rejects a SHORT stop below entry and all wrong-side or equal exits', () => {
  for (const values of [{ sl: '20' }, { sl: '21.37' }, { tp: '22' }, { tp: '21.37' }, { direction: 'LONG', tp: '22', sl: '23' }, { direction: 'LONG' }]) {
    assert.equal(calc(values).ok, false);
  }
  assert.match(calc({ sl: '20' }).errors.sl, /above entry/);
});

test('E: infeasible margin returns no suggested leverage, margin or remaining wallet', () => {
  const r = calc({ wallet: '1' });
  assert.equal(r.ok, false);
  assert.equal(r.leverage, null);
  assert.equal(r.margin, null);
  assert.equal(r.remaining, null);
  assert.match(r.errors.margin, /HIGH LEVERAGE REQUIRED/);
});

test('F: provided stop preserves risk and reports conflicting profit objective', () => {
  const r = calc({ sl: '22.55' });
  close(r.quantity, 5 / 1.18);
  assert.equal(r.sl, '22.55');
  close(r.grossSL, -5);
  close(r.grossTP, 5 / 1.18 * 1.13);
  assert.match(r.warnings.join(' '), /requested 10/);
});

test('automatic quantities and stops round conservatively and recompute actual risk', () => {
  const r = calc({}, filters);
  assert.equal(r.quantity, '8.84');
  assert.equal(r.sl, '21.93');
  assert.equal(r.grossSL, '-4.9504');
  assert.equal(r.grossTP, '9.9892');
  const long = calc({ direction: 'LONG', entry: '21.37', tp: '22.50' }, filters);
  assert.equal(long.sl, '20.81');
  assert.equal(long.grossSL, '-4.9504');
});

test('manual quantity is preserved, including risk above budget, but invalid step is rejected', () => {
  const r = calc({ quantityMode: 'manual', quantity: '10', sl: '22.55' }, filters);
  assert.equal(r.quantity, '10');
  assert.equal(r.grossSL, '-11.8');
  assert.match(r.warnings.join(' '), /exceeds/);
  const bad = calc({ quantityMode: 'manual', quantity: '4.105', sl: '22.55' }, filters);
  assert.equal(bad.ok, false);
  assert.match(bad.errors.quantity, /step/);
});

test('enforces both LOT_SIZE and MARKET_LOT_SIZE, minimums, maxima and ticks', () => {
  const rules = { ...filters, lots: [...filters.lots, { stepSize: '0.03', minQty: '0.03', maxQty: '100' }] };
  assert.equal(calc({}, rules).quantity, '8.82');
  for (const rule of [{ ...filters, minNotional: '1000' }, { ...filters, lots: [{ stepSize: '20', minQty: '20' }] }, { ...filters, maxPrice: '20' }]) {
    assert.equal(calc({}, rule).ok, false);
  }
  assert.equal(calc({ sl: '22.551' }, filters).ok, false);
  assert.equal(calc({ tp: '20.241' }, filters).ok, false);
  assert.equal(calc({ entry: '21.371', orderType: 'LIMIT' }, filters).ok, false);
});

test('impossible nonpositive or rounded-to-entry calculated stop is rejected', () => {
  assert.equal(calc({ direction: 'LONG', entry: '1', tp: '20' }).ok, false);
  assert.equal(calc({ risk: '0.0001' }, filters).ok, false);
});

test('rejects missing, nonfinite, extreme and malformed numeric inputs', () => {
  for (const value of ['', '0', '-1', 'NaN', 'Infinity', '1e1000', '100000000000000000000', '1,000', '1e-99', 'abc']) {
    assert.equal(calc({ entry: value }).ok, false, value);
  }
  assert.equal(calc({ quantityMode: 'manual', quantity: '' }).ok, false);
  assert.equal(calc({ symbol: 'BTCUSD' }).ok, false);
});

test('tiny prices retain nonzero price and quantity precision', () => {
  const r = calc({ entry: '0.00000012', tp: '0.00000010' }, { ...filters, minPrice: '0.00000001', tickSize: '0.00000001', lots: [{ stepSize: '1', minQty: '1' }] });
  assert.equal(r.ok, true);
  assert.equal(r.sl, '0.00000013');
  assert.equal(r.quantity, '500000000');
  assert.equal(formatNumber(r.sl), '0.00000013');
  assert.notEqual(formatNumber('0.0000000000000001', 2), '0.00');
});

test('leverage fits budget; optional verified support list and tiers are honoured', () => {
  const r = calc({ entry: '150', tp: '140', profit: '10' });
  assert.equal(r.leverage, 4);
  assert.equal(r.margin, '37.5');
  assert.equal(calc({}, null, { supportedLeverages: [1, 3, 10] }).leverage, 10);
  assert.equal(calc({}, null, { maxLeverage: 4 }).ok, false);
  assert.equal(calc({}, { ...filters, leverageBrackets: [{ notionalFloor: '0', notionalCap: '200', initialLeverage: 3 }] }).ok, false);
  assert.match(calc().warnings.join(' '), /leverage.*unverified/i);
});

test('copy text uses same exact setup, explicit risk:reward convention and conditional reminders', () => {
  const r = calc({ sl: '22.55', quantityMode: 'manual', quantity: '4.10' });
  const text = tradeText(r, { source: 'manual', pendingOrder: false });
  assert.match(text, /COMPUSDT MARKET SHORT/);
  assert.match(text, /Gross TP: approx \+4.63 USDT/);
  assert.match(text, /Risk\/Reward \(risk:reward\): 1:0.96/);
  assert.doesNotMatch(text, /Cancel old|Recalculate if market/);
  const live = tradeText(r, { source: 'live', pendingOrder: true });
  assert.match(live, /Cancel old pending short order first/);
  assert.match(live, /Recalculate if market price changes/);
  assert.throws(() => tradeText(calc({ tp: '22' })), /valid/);
});
