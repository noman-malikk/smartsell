import { mountTradeCalculator } from './component.js';
import { mountSpotCalculator } from './spot-component.js';

const panels = { futures: document.querySelector('[data-trade-calculator]'), spot: document.querySelector('[data-spot-calculator]') };
const factories = { futures: mountTradeCalculator, spot: mountSpotCalculator };
const calculators = { futures: panels.futures ? mountTradeCalculator(panels.futures) : null, spot: null };
let mode = 'futures';
const tabs = [...document.querySelectorAll('[role="tab"]')];
function selectMode(next, focus = false) {
  if (!panels[next]) return;
  if (next !== mode) {
    calculators[mode]?.suspend();
    mode = next;
    for (const [name, panel] of Object.entries(panels)) panel.hidden = name !== mode;
    if (calculators[mode]) calculators[mode].resume();
    else calculators[mode] = factories[mode](panels[mode]);
  }
  for (const tab of tabs) {
    const selected = tab.id === `${mode}-tab`;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  }
  const spot = mode === 'spot';
  document.querySelector('#futures-guide').hidden = spot;
  document.querySelector('#trade-title').textContent = spot ? 'Crypto Spot Trade Calculator' : 'Crypto Futures Trade Calculator';
  document.querySelector('#trade-intro').textContent = spot ? 'Choose a coin, enter your investment, and see how much you could earn at take profit or lose at your stop loss.' : 'Plan your position, define your risk, and see the potential reward. A USDT perpetual futures calculator for LONG and SHORT trades.';
  const labels = spot ? ['Spot purchases', 'Your investment', 'Gross PnL estimates'] : ['USDT perpetuals', 'Isolated margin', 'Gross PnL estimates'];
  document.querySelectorAll('#market-tags .fee-chip').forEach((el, i) => { el.textContent = labels[i]; });
}
for (const tab of tabs) {
  tab.addEventListener('click', () => selectMode(tab.id.replace('-tab', '')));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    selectMode(event.key === 'Home' ? 'spot' : event.key === 'End' ? 'futures' : mode === 'spot' ? 'futures' : 'spot', true);
  });
}
window.addEventListener('pagehide', event => {
  // A cached page retains its DOM: keep the matching reference and lock state too.
  if (event.persisted) calculators[mode]?.suspend();
  else Object.values(calculators).forEach(calculator => calculator?.dispose());
});
window.addEventListener('pageshow', event => { if (event.persisted) calculators[mode]?.resume(); });
