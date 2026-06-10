# SellSmart Tools UK

SellSmart Tools UK is a lightweight static toolkit for UK eBay sellers, dropshippers, marketplace sellers, and small online businesses. It runs entirely in the browser and is ready for GitHub Pages.

## Features

- eBay UK Profit Calculator with estimated profit, margin, fees, break-even price, and target-profit price
- eBay Title Builder & Checker with browser-based suggestions, an 80-character target, issue detection, and practical writing guidance
- UK Parcel Size Checker using packed dimensions and weight
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

All internal asset and page links are relative, so the site works on a project URL such as `https://username.github.io/repository-name/`.

Before connecting a custom domain, update the canonical links and replace the placeholder contact email if needed.

## Future ideas

- Product image resizer using browser-based canvas processing
- eBay description generator
- Promoted listing calculator
- Seller checklist
- Practical selling guides and blog posts

## Disclaimer

All calculations and parcel categories are estimates. Marketplace fees, courier rules, prices, and policies can change. Always check the current official information before making business decisions.
