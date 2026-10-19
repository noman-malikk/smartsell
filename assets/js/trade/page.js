import { mountTradeCalculator } from './component.js';

const root = document.querySelector('[data-trade-calculator]');
let calculator = root ? mountTradeCalculator(root) : null;
window.addEventListener('pagehide', event => {
  // A cached page retains its DOM: keep the matching reference and lock state too.
  if (event.persisted) calculator?.suspend();
  else { calculator?.dispose(); calculator = null; }
});
window.addEventListener('pageshow', event => { if (event.persisted) calculator?.resume(); });
