# SellSmart SEO setup

Implemented 29 October 2026 for `https://sellsmarttool.co.uk`. These are source changes; publishing and account-based indexing submission are separate steps.

## Search topics by page

| Canonical path | Search topics supported by the actual features |
| --- | --- |
| `/` | Free seller tools, eBay calculators, postage calculator, crypto trade calculator |
| `/ebay-profit-calculator-uk/` | eBay fee calculator UK, eBay profit calculator, business seller fees, profit margin, break-even price, target profit, promoted listing fees, postage and packaging costs |
| `/ebay-title-checker/` | eBay title builder, eBay title checker, listing title SEO, 80-character title checker, product keywords, duplicate words |
| `/uk-parcel-size-checker/` | Royal Mail postage calculator, UK delivery charge checker, parcel size checker, Large Letter dimensions, Small Parcel size, Medium Parcel weight, Tracked 24 and Tracked 48 prices, 1st and 2nd Class postage, Evri size limits |
| `/trade-calculator/` | Crypto trade calculator, spot profit calculator, futures calculator, position size calculator, simple risk management calculator, stop loss calculator, take profit calculator, risk/reward ratio, isolated margin, leverage, USDT profit and loss |

These are editorial topic targets, not measured search-volume or ranking claims. They appear naturally in page titles, descriptions, visible explanations and feature lists. No keyword stuffing, hidden keyword text or duplicate doorway pages are used. Google does not use the meta keywords tag.

## Implemented

- Unique search titles and descriptions, canonical URLs, English/UK language metadata and complete Open Graph/Twitter summaries with the existing brand image.
- Public pages permit indexing; the 404 page remains `noindex` and stays out of the sitemap.
- Tool application schema, breadcrumb schema and FAQ markup matching visible answers. The homepage lists all four tools in an `ItemList`.
- Static HTML explanations and examples for both spot and futures, accessible without selecting a tab. Both modes share one canonical trade URL.
- Homepage and About tool cards, contextual links between postage and eBay profit, and related tools from the trading page.
- A canonical sitemap and `robots.txt` sitemap declaration; `llms.txt` now includes trading as well as seller tools. `llms.txt` is an experimental convention, not an indexing guarantee.
- The production build rejects missing/duplicate canonical pages, sitemap omissions, duplicate titles/descriptions, indexing blocks, missing links and malformed schema JSON.

## Publish and submit for indexing

1. Deploy these files through the existing GitHub Pages workflow (repository root or the contents of `dist/`). Verify the live HTML contains the new titles and the October Royal Mail prices.
2. In [Google Search Console](https://search.google.com/search-console), use an existing verified property or verify the `sellsmarttool.co.uk` domain with Google's real DNS TXT record. A URL-prefix property can alternatively use Google's real verification HTML file or meta tag. Do not invent a token.
3. Submit `https://sellsmarttool.co.uk/sitemap.xml` in Sitemaps. Use URL Inspection on the homepage and each of the four tool URLs; run the live test and request indexing where offered.
4. Add or import the verified site in [Bing Webmaster Tools](https://www.bing.com/webmasters/) and submit the same sitemap.
5. Check Google Page Indexing, selected canonical URLs, and Core Web Vitals. Track impressions, clicks and queries by tool page in Performance. Requests and sitemap submission do not guarantee indexing, timing or ranking.

Search Console/Bing ownership credentials were not available in this workspace, so verification and submission have not been performed. No fake verification metadata or unsupported indexing API call is included. Analytics remains governed by the existing consent flow.

## Royal Mail maintenance

The parcel checker uses public **online** prices, excluding signature and other extras, from the [Royal Mail October 2026 online price guide](https://www.royalmail.com/sites/royalmail.com/files/2026-10/online-price-guide-october-2026-v1.pdf), effective 5 October 2026 and checked 29 October 2026. Tracked prices include VAT; standard 1st/2nd Class prices are VAT-exempt. Collection adds 50p per item and is excluded from displayed totals.

Update `assets/js/parcel-checker.js`, the visible tariff table and date in `uk-parcel-size-checker/index.html`, `llms.txt`, and the parcel sitemap modification date together when Royal Mail publishes another tariff. Keep the browser fixtures aligned with the official rate card. Run `npm test`, `npm run test:browser`, `npm run lint` and `npm run build`. Evri remains a separate snapshot last checked 9 June 2026; it is not represented as newly verified.

## References

- [Google SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Royal Mail current postage prices](https://www.royalmail.com/current-postage-prices)
- [Royal Mail 2026 changes](https://www.royalmail.com/prices2026)
