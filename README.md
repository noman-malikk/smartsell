# SellSmart Tools UK

SellSmart Tools UK is a lightweight static toolkit for UK eBay sellers, dropshippers, marketplace sellers, and small online businesses. It runs entirely in the browser and is ready for GitHub Pages.

## Features

- eBay UK Profit Calculator with estimated profit, margin, fees, break-even price, and target-profit price
- eBay Title Builder & Checker with browser-based suggestions, an 80-character target, issue detection, and practical writing guidance
- UK Parcel Size Checker using packed dimensions and weight
- Unique metadata, canonical URLs, social sharing tags, and structured data
- XML sitemap, robots.txt, breadcrumbs, and a custom 404 page
- Explicit AI search crawler access and an experimental `llms.txt` site guide
- Optional analytics consent controls with analytics disabled by default
- Responsive, mobile-first layout
- Accessible labels, keyboard-friendly controls, and live result regions
- About, privacy policy, and contact pages
- No account, backend, database, API key, or external library

## Tech stack

- HTML5
- CSS3
- Vanilla JavaScript

There is no build step and no npm dependency.

## Folder structure

```text
/
├── index.html
├── 404.html
├── robots.txt
├── sitemap.xml
├── llms.txt
├── ebay-profit-calculator-uk/
│   └── index.html
├── ebay-title-checker/
│   └── index.html
├── uk-parcel-size-checker/
│   └── index.html
├── about/
│   └── index.html
├── privacy-policy/
│   └── index.html
├── contact/
│   └── index.html
├── assets/
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── main.js
│   │   ├── profit-calculator.js
│   │   ├── title-checker.js
│   │   └── parcel-checker.js
│   └── img/
└── README.md
```

## Run locally

Open `index.html` directly in a browser, or run a small local server from the project directory:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deploy to GitHub Pages

1. Push the project to a GitHub repository.
2. Open the repository's **Settings**.
3. Select **Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the main branch and the root (`/`) folder.
6. Save and wait for GitHub Pages to publish the site.

The production SEO metadata uses the canonical domain `https://sellsmarttool.co.uk`.

Replace the placeholder contact email if needed before promoting the contact page.

## SEO files

- Sitemap: `https://sellsmarttool.co.uk/sitemap.xml`
- Robots file: `https://sellsmarttool.co.uk/robots.txt`
- AI-readable site guide: `https://sellsmarttool.co.uk/llms.txt`
- Custom error page: `https://sellsmarttool.co.uk/404.html`

Every public page includes a unique title, description, canonical URL, Open Graph tags, Twitter card tags, and appropriate JSON-LD structured data. Tool pages include `WebApplication`, `FAQPage`, and `BreadcrumbList` schema. The homepage includes `WebSite` and `Organization` schema.

### Submit the sitemap to Google Search Console

1. Add and verify the `https://sellsmarttool.co.uk` property in Google Search Console.
2. Use the clearly marked verification placeholder in each page `<head>` if Google provides an HTML meta tag.
3. Open **Sitemaps** in Search Console.
4. Submit `https://sellsmarttool.co.uk/sitemap.xml`.
5. Use URL Inspection to request indexing for the homepage and main tool pages after deployment.

Do not add a made-up Search Console verification value.

## AI search discoverability

The robots file explicitly allows search and retrieval crawlers used by ChatGPT and Claude, as well as Googlebot for Google Search AI features. AI model development crawlers are also allowed for maximum public discoverability.

The root `llms.txt` file is a concise Markdown guide to the site's tools, intended audience, canonical URLs, and estimate disclaimers. `llms.txt` is an emerging convention rather than a guaranteed ranking or inclusion standard.

Crawler access only makes the site eligible to be discovered. ChatGPT, Claude, Gemini, Google, and other services independently decide whether to crawl, index, cite, or recommend a page. Helpful original content, official source citations, external mentions, reliable uptime, and regular updates remain important.

## Analytics and consent

Google Analytics is not active. The placeholder measurement ID in `assets/js/main.js` is:

```text
G-XXXXXXXXXX
```

To add GA4 later:

1. Implement and review the required privacy and cookie information.
2. Replace the placeholder with the real GA4 Measurement ID.
3. Keep analytics loading through `loadGoogleAnalytics(measurementId)`.
4. Do not add a separate analytics script to the page `<head>`.
5. Test that analytics loads only after **Accept analytics** and does not load after **Reject analytics**.

The consent choice is stored in browser local storage. Analytics must never be enabled without consent.

## Future ideas

- Product image resizer using browser-based canvas processing
- eBay description generator
- Promoted listing calculator
- Seller checklist
- Practical selling guides and blog posts

## Disclaimer

All calculations, title scores, parcel categories, and postage prices are estimates or guidance. Marketplace fees, courier rules, prices, and policies can change. Always check current official information before making business decisions.
