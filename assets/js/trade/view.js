import { D, formatNumber } from './calculator.js';

export function renderTrade(root, result, { touched = new Set(), showErrors = false, pendingOrder = false, orderType = 'MARKET' } = {}) {
  const find = selector => root.querySelector(selector);
  for (const element of root.querySelectorAll('.trade-field-error')) element.textContent = '';
  for (const element of root.querySelectorAll('[aria-invalid]')) element.removeAttribute('aria-invalid');
  const errors = Object.entries(result.errors).filter(([key]) => showErrors || touched.has(key) || !['entry', 'tp'].includes(key));
  const summary = find('#trade-errors');
  summary.replaceChildren();
  if (errors.length) {
    const list = document.createElement('ul');
    for (const [key, message] of errors) {
      const mappedKey = key === 'entry' && orderType === 'LIMIT' ? 'limitEntry' : key;
      const fieldError = find(`#error-${mappedKey}`);
      if (fieldError) {
        fieldError.textContent = message;
        root.querySelector(`[aria-describedby~="error-${mappedKey}"]`)?.setAttribute('aria-invalid', 'true');
      }
      const item = document.createElement('li');
      item.textContent = message;
      list.append(item);
    }
    summary.append(list);
  }
  summary.hidden = !errors.length;
  find('#trade-empty').hidden = result.ok || errors.length > 0;
  find('#trade-results').hidden = !result.ok;
  find('#copy-setup').disabled = !result.ok;
  find('#lock-setup').disabled = !result.ok;
  if (!result.ok) return;
  const r = result;
  const usdt = value => `${formatNumber(value, 2)} USDT`;
  const displayed = {
    grossTP: `+${usdt(r.grossTP)}`, grossSL: usdt(r.grossSL), entry: r.entry, quantity: `${r.quantity} ${r.baseAsset}`,
    leverage: `${r.leverage}x Isolated`, margin: usdt(r.margin), sl: r.sl, tp: r.tp,
    notional: `${formatNumber(r.notional, 4)} USDT`, rewardRisk: `1:${formatNumber(r.rewardRisk, 2)}`,
    wallet: usdt(r.wallet), remaining: usdt(r.remaining), marginPercent: `${formatNumber(r.marginPercent, 2)}%`, walletRisk: `${formatNumber(r.walletRisk, 2)}%`,
  };
  for (const element of root.querySelectorAll('[data-value]')) element.textContent = displayed[element.dataset.value];
  find('#stop-label').textContent = r.calculatedSL ? 'Calculated SL' : 'Stop Loss';
  find('#margin-meter').value = Math.min(100, Number(r.marginPercent));
  find('#risk-meter').value = Math.min(100, Number(r.walletRisk));
  find('#risk-meter').dataset.high = String(new D(r.walletRisk).gte(10));
  find('#risk-details').textContent = `Selected risk: ${formatNumber(r.selectedRisk, 2)}% of wallet. Planned gross loss: ${usdt(new D(r.grossSL).abs())}.`;
  const breakdown = [
    `Profit distance = |${r.entry} − ${r.tp}| = ${r.profitDistance}`,
    `Stop distance = |${r.entry} − ${r.sl}| = ${r.stopDistance}`,
    `Position value = ${r.quantity} × ${r.entry} = ${formatNumber(r.notional, 6)} USDT`,
    `Gross TP = ${r.profitDistance} × ${r.quantity} = +${formatNumber(r.grossTP, 6)} USDT`,
    `Gross SL = −${r.stopDistance} × ${r.quantity} = ${formatNumber(r.grossSL, 6)} USDT`,
    `Isolated margin = ${formatNumber(r.notional, 6)} ÷ ${r.leverage} = ${formatNumber(r.margin, 6)} USDT`,
    `Margin budget = ${r.wallet} × 80% = ${r.marginBudget} USDT`,
    `Risk:reward = 1:${formatNumber(r.rewardRisk, 4)}. Reward/risk quotient = ${formatNumber(r.rewardRisk, 4)}.`,
  ];
  find('#calculation-breakdown').replaceChildren(...breakdown.map(text => {
    const p = document.createElement('p'); p.textContent = text; return p;
  }));
  find('#leverage-comparisons').replaceChildren(...r.comparisons.map(row => {
    const tr = document.createElement('tr');
    for (const value of [`${row.leverage}x`, usdt(row.margin), row.fits ? 'Yes*' : 'No']) {
      const td = document.createElement('td'); td.textContent = value; tr.append(td);
    }
    return tr;
  }));
  const warnings = [...r.warnings, '*Margin comparisons assume the exchange supports the leverage. Fees and other positions reduce available funds.', pendingOrder ? `Cancel old pending ${r.direction.toLowerCase()} order first.` : 'Check for existing pending orders before placing a new trade.'];
  find('#trade-warnings').replaceChildren(...warnings.map(text => {
    const li = document.createElement('li'); li.textContent = text; return li;
  }));
}
