import { cp, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

// Optional static packaging; the committed source also serves directly on Pages.
const root = resolve(import.meta.dirname, '..');
const out = join(root, 'dist');
const top = await readdir(root, { withFileTypes: true });
const pages = [];
const publish = [];
for (const entry of top) {
  if (entry.isFile() && (/\.(html|xml|ico|txt)$/.test(entry.name) || entry.name === 'CNAME')) {
    publish.push(entry.name);
    if (entry.name.endsWith('.html')) pages.push(entry.name);
  } else if (entry.isDirectory() && !entry.name.startsWith('.') && !['dist', 'node_modules'].includes(entry.name)) {
    try { await stat(join(root, entry.name, 'index.html')); publish.push(entry.name); pages.push(`${entry.name}/index.html`); } catch { /* Not a public page. */ }
  }
}
publish.push('assets');
const origin = `https://${(await readFile(join(root, 'CNAME'), 'utf8')).trim()}`;
const sitemap = await readFile(join(root, 'sitemap.xml'), 'utf8');
const sitemapURLs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
assert.equal(new Set(sitemapURLs).size, sitemapURLs.length, 'Duplicate sitemap URLs');
const indexableURLs = [];
const titles = new Set();
const descriptions = new Set();
const robots = await readFile(join(root, 'robots.txt'), 'utf8');
assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`), 'robots.txt must reference the canonical sitemap');
// Fail if the checked-in runtime dependency diverges from the pinned package.
assert.equal(await readFile(join(root, 'assets/js/vendor/decimal.mjs'), 'utf8'), await readFile(join(root, 'node_modules/decimal.js/decimal.mjs'), 'utf8'), 'Vendored decimal.js differs from the installed, pinned dependency.');
for (const page of pages) {
  const html = await readFile(join(root, page), 'utf8');
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1, `Expected one main heading in ${page}`);
  if (page === '404.html') {
    assert.match(html, /<meta name="robots" content="noindex[^"]*"/, 'The 404 page must stay noindex');
  } else {
    const canonical = `${origin}/${page.replace(/index\.html$/, '')}`;
    indexableURLs.push(canonical);
    const canonicalTags = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)];
    assert.equal(canonicalTags.length, 1, `Expected one canonical URL in ${page}`);
    assert.equal(canonicalTags[0][1], canonical, `Incorrect canonical URL in ${page}`);
    assert.ok(html.includes(`<meta property="og:url" content="${canonical}">`), `Social URL must match canonical in ${page}`);
    assert.doesNotMatch(html, /<meta[^>]+content="[^"]*(?:noindex|nofollow)[^"]*"/i, `Public page blocks indexing in ${page}`);
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
    assert.ok(title && description, `Missing search title or description in ${page}`);
    assert.ok(!titles.has(title) && !descriptions.has(description), `Duplicate search title or description in ${page}`);
    titles.add(title);
    descriptions.add(description);
  }
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, `Duplicate HTML ids in ${page}`);
  for (const [, raw] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(?:https?:|mailto:|tel:|data:|#)/.test(raw)) continue;
    const path = raw.split(/[?#]/)[0];
    const file = path.startsWith('/') ? join(root, path) : resolve(root, dirname(page), path);
    const info = await stat(file).catch(() => null);
    assert.ok(info, `Missing local asset or link ${raw} in ${page}`);
    if (info.isDirectory()) await stat(join(file, 'index.html'));
  }
  for (const [, data] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(data);
}
assert.deepEqual(sitemapURLs.toSorted(), indexableURLs.toSorted(), 'Sitemap must contain exactly the indexable canonical pages');
async function checkScripts(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) await checkScripts(path);
    else if (/\.(m?js)$/.test(path)) execFileSync(process.execPath, ['--check', path]);
  }
}
await checkScripts(join(root, 'assets/js'));
await rm(out, { recursive: true, force: true });
await mkdir(out);
for (const path of publish) await cp(join(root, path), join(out, path), { recursive: true });
console.log(`Static production build passed: ${pages.length} pages, canonical URLs, sitemap coverage, indexability, local links, metadata JSON and JavaScript syntax verified. Output: dist/`);
