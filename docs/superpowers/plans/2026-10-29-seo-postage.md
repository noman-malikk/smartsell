# SEO and Royal Mail prices implementation plan

**Goal:** Improve discoverability of every existing tool and update the parcel checker to Royal Mail's current public online tariff.

**Approach:** Keep the static HTML, existing URLs and browser calculators. Use useful visible content and consistent metadata rather than duplicate keyword landing pages or meta keyword lists. The user's request authorizes implementation in this workspace; leave changes reviewable without publishing.

**Sources:** Royal Mail online price guide, valid from 5 October 2026, pages 2–6: https://www.royalmail.com/sites/royalmail.com/files/2026-10/online-price-guide-october-2026-v1.pdf. Checked 29 October 2026. Google Search Central SEO starter guide and sitemap guidance inform the indexing work.

## Tasks

- [x] Add browser regressions for Royal Mail prices at letter and parcel weight boundaries, tracked-only Large Letters, oversize inputs and invalid values. Confirm the new tariff tests fail against the old calculator.
- [x] Update `assets/js/parcel-checker.js` with weight-band pricing for 1st/2nd Class and Tracked 24/48. Separate Royal Mail's verification date from Evri's unchanged June snapshot. Update visible price notes, source links, and a static tariff table on the parcel page.
- [x] Improve titles, descriptions, social metadata, crawl directives and JSON-LD across existing pages. Add homepage/about links for the trade calculator, static spot/futures/risk examples and matching FAQs. Keep one canonical trade URL and existing mode controls.
- [x] Update `sitemap.xml`, `llms.txt` and SEO documentation. Add build validation for canonical URLs, sitemap coverage and indexability. Preserve the 404 noindex directive.
- [x] Run unit/browser tests, lint, production build and responsive checks. Review the final diff and report any remaining external indexing steps.

## Review focus

- Large Letter standard prices vary at 100g, 250g, 500g and 750g; tracked Large Letters allow 1kg.
- Medium Parcel prices vary at 2kg, 10kg and 20kg; sorted dimensions and weight must both fit.
- Royal Mail public online prices exclude collection, signature and other extras; do not label Evri's older estimates as newly verified.
- Spot and futures information remains present in HTML regardless of the selected tab. No ranking, guaranteed-return or rich-result promises.
- Only real public canonical pages enter the sitemap; modification dates describe actual changes. Search Console verification requires a real owner token/account.

## Verification record

- Original tariff regression run: 17 expected failures and 2 passes, including incorrect price assertions against the old June data.
- Final full browser suite: 35 passed with 2 workers. A prior 4-worker run had four browser startup timeouts; no price assertion failed after the tariff fix.
- Calculation/provider suite: 31 passed. ESLint and production build passed.
- FAQ schema answers were checked against visible HTML. Five homepage/tool routes expose useful HTML with JavaScript disabled.
- Independent read-only review found no actionable issues. Evri/eBay tariff changes and search-engine indexing state remain outside this change.
- Contact/privacy sitemap dates retain their previous dates because their substantive content did not change.
- Source files remain uncommitted and unpublished for review. Search Console/Bing verification and submission require the owner's account.
