# Futures calculator implementation plan

Goal: implement the user's supplied USDT perpetual futures calculator specification in the existing static website. The user explicitly requested implementation through verification without a design approval stop. No deployment.

Architecture: retain directory routes and the shared design tokens. Add `/trade-calculator/`, isolated page CSS, a reusable DOM controller, pure decimal calculation functions, and a public Binance futures provider. Vendor a pinned decimal.js module so manual calculations do not depend on a CDN. Development tooling must not become a hosting requirement.

## Tasks

- [ ] Financial engine: write and run failing Node tests for cases A–F, direction validation, conservative tick/step rounding, manual quantity preservation, tiny/huge inputs, leverage limits, and copy text. Implement `calculateTrade(input, filters?, settings?)`, formatting, and plain-text output. Run `npm test`.
- [ ] Market provider: test futures-only metadata, malformed/out-of-order prices, failure recovery, bounded retries, and disposal. Implement REST metadata/prices and WebSocket streaming with timestamps and manual fallback. No private endpoints or API keys.
- [ ] UI: add a responsive calculator matching the existing shared form/result panels. Inputs update immediately; market ticks update a separate ticker. Copy/lock preserve a snapshot; recalculate explicitly refreshes its reference. Add navigation links and sitemap entry only to existing pages.
- [ ] Verification: add browser tests for manual/live/offline workflows, snapshot protection, clipboard, reset, accessibility basics, and 320px overflow. Run tests, lint, static production build, and independent review. Document files, route, data limitations and deployment.

## Review focus

- Exchange lot and market-lot restrictions must both be respected; never quietly round a manual quantity.
- A calculated stop must remain positive and on the correct side after conservative rounding.
- No unsupported pair, stale quote or unavailable leverage tier may be described as exchange-verified.
- Symbol changes and disposal must prevent late responses from affecting a different setup.
- All displayed and copied prices, quantities and PnL must correspond to the same snapshot.

## Progress

- Inspected the clean static HTML/CSS/JS repository; no existing package manager, tests, bundler or TypeScript configuration. Work on `codex/trade-calculator` in the user's checkout. Existing tools remain unchanged except navigation.
