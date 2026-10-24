# Spot mode implementation plan

User request: add a Spot/Futures toggle to the existing trade calculator, preserving futures functionality and site styling, and run locally for testing. Spot inputs: USDT coin pair, market/manual entry price, investment in USDT, TP and SL. Quantity = investment / entry; gross PnL = (exit − entry) × quantity. The supplied QNT example uses both 100 and 50 investment amounts: test both explicitly. SL may be blank, in which case show no stop estimate rather than inventing a stop.

- [x] Add decimal spot calculations and tests for 100/200/220 → 0.5 QNT and +10 USDT, 50/200/220 → 0.25 QNT and +5 USDT, stops, invalid inputs and exchange rounding.
- [x] Add a distinct Binance Spot public provider using recent trades with exchange timestamps and spot-only symbol metadata. Reuse the existing disposable/retrying feed through a provider quote parser and source label. No futures price reuse.
- [x] Add an accessible same-page Spot/Futures toggle and matching Spot form/result panel. Suspend the hidden calculator, preserve each mode's state, keep network updates separate from reference snapshots, and support copy/reset/manual inputs.
- [x] Complete the pending LIMIT-copy timestamp correction from the earlier futures review; test both modes, mobile layout, data separation, switching during loading, stale pricing and clipboard. Run unit tests, browser tests, lint and static build. Leave local preview on port 8080; no deployment.

Local preview verified HTTP 200 on 2026-10-24. Baseline is user commit `9a28958` on `codex/trade-calculator`.

Verification on 2026-10-24: 31 Node tests and 16 Playwright tests passed; ESLint and the static production build passed. Inspected desktop and 320px screenshots. Real Binance Spot QNT metadata and timestamped trade responses were verified. The independent review identified a delayed clipboard callback race; revision guards fixed it in both modes, with regressions confirmed failing before and passing after the change. No deployment or exchange order placement was performed.
