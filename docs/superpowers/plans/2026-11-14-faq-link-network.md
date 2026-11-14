# FAQ Link Network SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) or superpowers:subagent-driven-development (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a crawlable internal FAQ link network for the trading calculator and eBay fee calculator.

**Architecture:** Keep FAQ answers and `FAQPage` schema on the two calculator pages. Add a static `/faqs/` index page with descriptive links to those sections, then connect it from the homepage, About page, and related-tool sections. Update the sitemap and SEO documentation.

**Tech Stack:** Static HTML, JSON-LD, XML sitemap, Node.js built-in test runner, Playwright, ESLint.

**Spec:** `docs/superpowers/specs/2026-11-14-faq-link-network-design.md`

## Global Constraints

- Preserve the canonical origin `https://sellsmarttool.co.uk`.
- Do not duplicate the full FAQ answers on the hub page.
- Keep public pages indexable and the 404 page noindex.
- All local links must resolve and every public page must have unique title and description metadata.

## Review Focus

- FAQ fragment links resolve to the intended sections — covered by `tests/seo.test.js`.
- FAQ hub metadata and schema are valid — covered by `tests/seo.test.js` and `npm run build`.
- Sitemap exactly matches indexable pages — covered by `scripts/build.js`.
- Existing calculator behavior remains unchanged — covered by existing unit/browser suites.
- Mobile and desktop link layout remains usable — covered by the existing browser viewport checks and static CSS patterns.

### Task 1: Add failing SEO-link regression tests

**Files:**
- Create: `tests/seo.test.js`

- [ ] **Step 1: Write tests** for the FAQ hub metadata, calculator FAQ anchors, cross-page links, and sitemap entry.
- [ ] **Step 2: Run `node --test tests/seo.test.js`** and confirm it fails because `/faqs/` and the new links do not exist yet.

### Task 2: Implement the FAQ hub and internal links

**Files:**
- Create: `faqs/index.html`
- Modify: `trade-calculator/index.html`
- Modify: `ebay-profit-calculator-uk/index.html`
- Modify: `index.html`
- Modify: `about/index.html`
- Modify: `sitemap.xml`
- Modify: `docs/seo-setup.md`
- Modify: `llms.txt`

- [ ] **Step 1:** Add stable `id` attributes to the existing FAQ sections and contextual links to `/faqs/` and the relevant FAQ fragments.
- [ ] **Step 2:** Add the static FAQ hub with unique metadata, breadcrumb/WebPage JSON-LD, short non-duplicative summaries, and links to the two source FAQ sections.
- [ ] **Step 3:** Add the hub URL to the sitemap with the current modification date and document the internal-link strategy.
- [ ] **Step 4: Run `node --test tests/seo.test.js`** and confirm the new tests pass.

### Task 3: Verify the complete site

**Files:**
- No source changes expected.

- [ ] **Step 1:** Run `npm test`.
- [ ] **Step 2:** Run `npm run lint`.
- [ ] **Step 3:** Run `npm run build`.
- [ ] **Step 4:** Run `npm run test:browser -- --workers=2`.
- [ ] **Step 5:** Run `git diff --check` and inspect the final status.
