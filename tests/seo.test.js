import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

async function page(path) {
  return readFile(resolve(root, path), 'utf8');
}

test('FAQ hub has unique crawlable metadata and links to both calculator FAQs', async () => {
  const html = await page('faqs/index.html');

  assert.match(html, /<title>[^<]*FAQ[^<]*<\/title>/i);
  assert.match(html, /<meta name="description" content="[^"]+">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/sellsmarttool\.co\.uk\/faqs\/">/);
  assert.match(html, /<h1[^>]*>[^<]*FAQ[^<]*<\/h1>/i);
  assert.match(html, /href="\.\.\/ebay-profit-calculator-uk\/#ebay-faq"/);
  assert.match(html, /href="\.\.\/trade-calculator\/#trade-faq"/);
  assert.match(html, /"@type": "BreadcrumbList"/);
});

test('calculator FAQ sections and existing pages expose internal FAQ links', async () => {
  const [trade, ebay, home, about] = await Promise.all([
    page('trade-calculator/index.html'),
    page('ebay-profit-calculator-uk/index.html'),
    page('index.html'),
    page('about/index.html')
  ]);

  assert.match(trade, /<section[^>]+id="trade-faq"[^>]*>/);
  assert.match(ebay, /<section[^>]+id="ebay-faq"[^>]*>/);
  assert.match(trade, /href="\.\.\/faqs\/"/);
  assert.match(ebay, /href="\.\.\/faqs\/"/);
  assert.match(home, /href="faqs\/"/);
  assert.match(about, /href="\.\.\/faqs\/"/);
});

test('sitemap includes the FAQ hub exactly once', async () => {
  const sitemap = await page('sitemap.xml');
  const matches = sitemap.match(/https:\/\/sellsmarttool\.co\.uk\/faqs\//g) || [];
  assert.equal(matches.length, 1);
});
