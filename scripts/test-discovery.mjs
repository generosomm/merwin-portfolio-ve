import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const html = await fs.readFile('index.html', 'utf8');
const meta = JSON.parse(await fs.readFile('data/00-meta.json', 'utf8'));
const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] || 'null');
assert.deepEqual(schema, meta.structuredData, 'Crawler HTML and JSON metadata must agree');
assert.equal(schema['@context'], 'https://schema.org');
assert.equal(schema['@graph'].find(x => x['@type'] === 'Person').name, 'Merwin Generoso');
const sitemap = await fs.readFile('sitemap.xml', 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
assert.equal(urls.length, 3);
for (const value of urls) { const url = new URL(value); assert.equal(url.origin, new URL(meta.canonicalUrl).origin); await fs.access(url.pathname === '/' ? 'index.html' : url.pathname.slice(1)); }
assert.doesNotMatch(sitemap, /notes-admin|\/api\//);
const robots = await fs.readFile('robots.txt', 'utf8');
assert.match(robots, /Sitemap: https:\/\/generosomm\.dev\/sitemap\.xml/);
console.log('Discovery checks passed: factual schema, metadata parity and existing public sitemap routes.');
