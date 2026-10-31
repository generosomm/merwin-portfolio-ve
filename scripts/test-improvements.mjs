import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { versionAssets, FULL_PAGES } from './initial-html.mjs';
const source = await fs.readFile('js/content.js', 'utf8');
const nodes = new Map();
const node = selector => { if (!nodes.has(selector)) nodes.set(selector, {innerHTML:'',setAttribute(){}}); return nodes.get(selector); };
const context = vm.createContext({document:{querySelector:node}});
vm.runInContext(source.split('window.portfolioContentReady =')[0], context);
context.work = JSON.parse(await fs.readFile('data/07-work.json','utf8'));
context.stack = JSON.parse(await fs.readFile('data/10-stack.json','utf8'));
vm.runInContext('renderWork(work)',context);
context.edits = JSON.parse(await fs.readFile('data/08-edits.json','utf8'));
context.experience = JSON.parse(await fs.readFile('data/05-experience.json','utf8'));
vm.runInContext('renderEdits(edits); renderExperience(experience)',context);
const work = node('[data-section="work"]').innerHTML;
assert.doesNotMatch(work,/ai-workflow/,'The old open-source block stays removed; the skill is a deck project');
assert.match(work,/data-visit-label="Get it free"/,'The skill card links to its free install page');
assert.match(work,/<details class="project-case">/,'Case studies must be keyboard-accessible disclosures');
vm.runInContext('renderStack(stack)',context);
const stackHTML = node('[data-section="stack"]').innerHTML;
assert.doesNotMatch(stackHTML,/stack-more/,'Every tool shows without a toggle');
assert.match(stackHTML,/class="stack-guide"/,'The stack guide bot must render');
for (const group of context.stack.groups) for (const item of group.items) { const name = typeof item === 'string' ? item : item.name; assert.ok(stackHTML.includes(name.replace(/&/g,'&amp;')), `Stack must show ${name}`); }
const html = await fs.readFile('index.html','utf8');
assert.equal(await versionAssets(html), html, 'The built page must reference current asset versions');
const stale = html.replace(/(css\/fonts\.css\?v=)[^"]+/, '$1old');
assert.notEqual(await versionAssets(stale), stale, 'A stale asset reference must be detectable');
assert.match(html,/<h1 class="hero-name"/,'Built HTML must contain the actual hero');
assert.match(html,/href="mailto:generosomerwin10@gmail.com"/,'No-JS visitors need a real contact destination');
assert.match(html,/<section[^>]+id="work"[^>]*><!-- initial:access:start -->/,'Initial and enhanced work share the same anchor');
assert.doesNotMatch(html,/href="#initial-work"/,'Hydration must not strand navigation at a discarded fallback');
// The full Work page: generated from the same JSON, never stale, every project listed.
// Full pages (work, edits, experience): fresh, versioned, complete, linked from the homepage.
const amp = value => value.replace(/&/g,'&amp;').replace(/'/g,'&#39;');
for (const page of FULL_PAGES) {
  const html = await fs.readFile(page.file,'utf8');
  assert.equal(await versionAssets(html), html, `${page.file} must reference current asset versions`);
  assert.ok(html.includes(`<!-- page:start -->${page.render(context)}<!-- page:end -->`), `${page.file} is out of date: run npm run build`);
}
const pages = Object.fromEntries(await Promise.all(FULL_PAGES.map(async page => [page.file, await fs.readFile(page.file,'utf8')])));
for (const item of context.work.items) assert.ok(pages['work.html'].includes(amp(item.title)), `work.html must list ${item.title}`);
for (const item of [...context.edits.items, ...(context.edits.hooks?.items || [])]) assert.ok(pages['edits.html'].includes(amp(item.title)), `edits.html must list ${item.title}`);
for (const item of context.experience.items) assert.ok(pages['experience.html'].includes(amp(item.role)), `experience.html must list ${item.role}`);
assert.match(work, /class="page-all" href="work.html"/, 'The homepage links to the full Work page');
assert.match(node('[data-section="edits"]').innerHTML, /class="page-all" href="edits.html"/, 'The homepage links to the full Edits page');
assert.match(node('[data-section="experience"]').innerHTML, /class="page-all" href="experience.html"/, 'The homepage links to the full Experience page');
const notFound = await fs.readFile('404.html','utf8');
assert.match(notFound,/href="\/#work"/);
console.log('Portfolio refinement checks passed: case studies, full stack, work page, initial hero and recovery.');
