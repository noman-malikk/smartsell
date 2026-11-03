# Bitget price fallback implementation plan

**Goal:** Keep Binance as the primary exchange and use Bitget for USDT pairs absent from Binance in the selected spot/futures market.

**Design:** Resolve the market before creating a feed. Check Binance metadata first; only a confirmed absent active pair triggers a Bitget lookup. Keep Binance network failures on the existing Binance REST/manual recovery path. Merge discovered symbols for suggestions, prefer Binance duplicates, and use the selected exchange's rules and source labels. Spot never consumes futures quotes. No new dependencies or account APIs.

**Architecture:** Add a Bitget public provider in `assets/js/trade/bitget-market.js` and a shared resolver in `market-resolver.js`. Extend the disposable feed with optional subscription and heartbeat configuration. Wire both controllers to the resolved provider. Preserve reference snapshots, stale detection, bounded retries and cancellation.

- [x] Add failing browser regressions for Binance priority, Bitget-only lookup/streaming, unsupported pairs and switching back to Binance.
- [x] Add Bitget provider and resolver unit tests for filtering, decimal rules, true trade timestamps, protocol validation, rate limits, metadata failures and cancellation; implement and verify.
- [x] Add subscription/heartbeat lifecycle tests; implement shared feed hooks and wire controllers with accurate source/filter labels.
- [x] Update source/privacy documentation. Run Node tests, browser tests, lint and build; inspect the diff and smoke-test public Bitget endpoints.

Review focus: no exchange switch on Binance outage; no spot/futures mixing; no stale or malformed prices marked live; no heartbeat/reconnect leak after disposal; no late lookup changing a newly selected pair.

Execution: work in the existing clean `codex/trade-calculator` checkout and leave changes available for review. Baseline: 31 Node tests pass.

Verification on 2026-11-03: 42 Node tests and 43 Playwright tests pass; ESLint, production build and diff whitespace checks pass. Public Bitget spot/futures metadata and recent fills were fetched successfully with browser CORS allowed, and both real v2 trade WebSocket subscriptions produced valid quotes. Independent review found deprecated spot quantity bounds; a failing calculation regression reproduced the issue and verified the fix to enforce current notional limits instead. No remaining important review findings. Changes remain uncommitted; no deployment performed.
