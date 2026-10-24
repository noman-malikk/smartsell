import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSpot, spotTradeText } from '../assets/js/trade/spot-calculator.js';

const base = { symbol: 'QNTUSDT', entry: '200', investment: '100', tp: '220', sl: '180' };
const calc = (changes = {}, filters = null) => calculateSpot({ ...base, ...changes }, filters);

test('100 USDT at 200 buys 0.5 QNT; TP 220 returns 110 with 10 profit; SL 180 loses 10', () => {
  const r = calc();
  assert.equal(r.ok, true);
  assert.equal(r.quantity, '0.5');
  assert.equal(r.spent, '100');
  assert.equal(r.tpValue, '110');
  assert.equal(r.grossTP, '10');
  assert.equal(r.tpPercent, '10');
  assert.equal(r.slValue, '90');
  assert.equal(r.grossSL, '-10');
  assert.equal(r.slPercent, '-10');
  assert.equal(r.rewardRisk, '1');
});

test('50 USDT at 200 buys 0.25 QNT and earns 5 USDT at 220', () => {
  const r = calc({ investment: '50' });
  assert.equal(r.quantity, '0.25');
  assert.equal(r.tpValue, '55');
  assert.equal(r.grossTP, '5');
  assert.equal(r.grossSL, '-5');
});

test('optional stop remains unset, without inventing loss or risk/reward', () => {
  const r = calc({ sl: '' });
  assert.equal(r.ok, true);
  assert.equal(r.sl, null);
  assert.equal(r.grossSL, null);
  assert.equal(r.rewardRisk, null);
  assert.match(spotTradeText(r), /Stop Loss: not set/);
});

test('spot rejects unprofitable TP, wrong-side SL and invalid investment or price', () => {
  for (const changes of [{ tp: '200' }, { tp: '199' }, { sl: '200' }, { sl: '201' }, { investment: '0' }, { investment: '-1' }, { investment: '1e100' }, { entry: '' }, { tp: 'NaN' }, { symbol: 'QNTBTC' }]) assert.equal(calc(changes).ok, false);
});

test('exchange steps round coin quantity down and disclose unspent investment', () => {
  const r = calc({ entry: '3', tp: '4', sl: '2', investment: '10' }, { tickSize: '0.01', lots: [{ stepSize: '0.1', minQty: '0.1', maxQty: '100' }], minNotional: '5' });
  assert.equal(r.quantity, '3.3');
  assert.equal(r.spent, '9.9');
  assert.equal(r.unspent, '0.1');
  assert.equal(r.grossTP, '3.3');
  assert.equal(r.grossSL, '-3.3');
  assert.equal(r.tpValue, '13.2');
});

test('spot enforces price ticks, minimum quantity/notional, and maximum quantities', () => {
  for (const filters of [{ tickSize: '3' }, { lots: [{ stepSize: '1', minQty: '1' }] }, { minNotional: '150' }, { lots: [{ stepSize: '0.1', maxQty: '0.4' }] }, { maxNotional: '99' }]) assert.equal(calc({}, filters).ok, false);
});

test('tiny coin prices remain precise and copied setup is consistent with the result', () => {
  const r = calc({ entry: '0.00000002', tp: '0.00000003', sl: '0.00000001', investment: '5' });
  assert.equal(r.quantity, '250000000');
  assert.equal(r.grossTP, '2.5');
  const text = spotTradeText(r);
  assert.match(text, /QNTUSDT SPOT BUY/);
  assert.match(text, /Gross TP: approx \+2.50 USDT/);
  assert.doesNotMatch(text, /leverage|Isolated/i);
  assert.throws(() => spotTradeText(calc({ entry: '' })), /valid/);
});
