import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source = await fs.readFile('js/content.js', 'utf8');
const index = await fs.readFile('index.html', 'utf8');
const nodes = new Map();
function node(selector) { if (!nodes.has(selector)) nodes.set(selector, { innerHTML: '', textContent: '', hidden: true, dataset: {}, classList: { add() {} }, get childElementCount() { return this.innerHTML ? 1 : 0; }, style: { setProperty() {} }, setAttribute() {}, remove() {} }); return nodes.get(selector); }
const context = vm.createContext({ document: { querySelector: node, querySelectorAll: () => [], documentElement: { classList: { add() {} } } }, navigator: { userAgent: "Desktop", platform: "Win32", maxTouchPoints: 0 }, URLSearchParams, console });
vm.runInContext(source.split('window.portfolioContentReady =')[0], context);
const files = vm.runInContext('CONTENT_FILES', context);
const data = {};
for (const [key, filename] of Object.entries(files)) data[key] = JSON.parse(await fs.readFile(`data/${filename}`, 'utf8'));
context.payload = { data, errors: [] };
vm.runInContext('renderPortfolio(payload)', context);
for (const section of [...index.matchAll(/data-section="([^"]+)"/g)].map(m => m[1])) {
  const markup = node(`[data-section="${section}"]`).innerHTML;
  assert.ok(markup.trim(), `${section} must render`);
  assert.doesNotMatch(markup, /(?:src|href)="(?:undefined|null)"/, `${section} must not have missing destinations`);
}
const hero = node('[data-section="hero"]').innerHTML;
assert.equal([...hero.matchAll(/<h1\b/g)].length, 1);
assert.match(hero, /aria-hidden="true"/);
context.payload.errors = [{ filename: '03-about.json', message: 'HTTP 503' }];
vm.runInContext('reportErrors(payload.errors)', context);
assert.ok(node('#content-status').textContent, 'Partial data failures must report a status');
console.log('Rendering checks passed: all current sections, valid destinations, accessible hero and failure status.');
