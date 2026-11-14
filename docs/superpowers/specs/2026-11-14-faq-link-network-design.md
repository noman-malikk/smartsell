# FAQ Link Network SEO Design

## Intent

Make the trading calculator and eBay fee calculator easier for search engines and visitors to discover by creating a crawlable internal path to their existing FAQ content.

## Goals

- Add a small, useful FAQ hub at `/faqs/` that links to the relevant FAQ sections.
- Give both calculator FAQ sections stable, descriptive fragment identifiers.
- Link to the FAQs from the homepage, About page, and the calculators' related-tool areas.
- Keep FAQ structured data aligned with the visible questions and answers.
- Add the FAQ hub to the sitemap and preserve unique canonical metadata.

## Non-goals and anti-goals

- Do not create keyword-stuffed or duplicate FAQ pages.
- Do not claim that internal links are external backlinks or guarantee rankings.
- Do not change calculator calculations, exchange behavior, or existing FAQ answers unless needed for link targets.
- Do not add fake search-console verification or unsupported indexing APIs.

## Constraints

- Static HTML site with the production validation in `scripts/build.js`.
- Canonical origin is `https://sellsmarttool.co.uk`.
- Existing page navigation and visual style should remain intact.
- The FAQ hub must be useful without JavaScript and must pass local-link and schema checks.

## Approaches considered

1. Add only links between the two calculator pages. This is the smallest change but gives crawlers no central FAQ index.
2. Create an FAQ hub with links to both calculators and add contextual links from existing pages. This gives one authoritative crawl entry point while keeping answers on the relevant tool pages.
3. Create separate duplicate FAQ pages for trading and eBay. This creates more URLs but duplicates content and risks thin or conflicting pages.

## Chosen approach

Use approach 2. The existing calculator pages remain the source of truth for visible FAQ answers and `FAQPage` schema. The new hub is an index page with short summaries and descriptive links, not a second copy of the answers. Internal links will use stable fragments such as `#trade-faq` and `#ebay-faq`.

## Success criteria

- `/faqs/` has unique title, description, canonical URL, one H1, `WebPage`, `BreadcrumbList`, and links to both FAQ sections.
- Homepage, About, trading calculator, and eBay calculator each contain a crawlable link to the hub or the other relevant FAQ section.
- Sitemap contains the FAQ hub and all canonical URLs exactly once.
- Build, unit tests, lint, and browser tests pass.
