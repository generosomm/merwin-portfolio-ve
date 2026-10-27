import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const index = await fs.readFile('index.html', 'utf8');
const motion = await fs.readFile('js/motion.js', 'utf8');
for (const file of ['js/content.js', 'js/site.js', 'vendor/gsap.min.js', 'vendor/ScrollTrigger.min.js', 'js/motion.js']) assert.ok(index.includes(file), `${file} must load`);
assert.ok(index.indexOf('vendor/gsap.min.js') < index.indexOf('vendor/ScrollTrigger.min.js'));
assert.ok(index.indexOf('vendor/ScrollTrigger.min.js') < index.indexOf('js/motion.js'));
async function boot({ reduced = false, libraries = true, site = true } = {}) {
  let registrations = 0, configurations = 0, bindings = 0;
  const ready = Promise.resolve();
  const window = { portfolioContentReady: ready, addEventListener() {}, ...(site ? { portfolio: { reduceMotion: reduced, lenis: { on() { bindings++; } } } } : {}), ...(libraries ? { gsap: { registerPlugin() { registrations++; }, matchMedia: () => ({ add() {} }) }, ScrollTrigger: { config() { configurations++; }, update() {}, refresh() {}, addEventListener() {} } } : {}) };
  vm.runInNewContext(motion, { window, document: { querySelector: () => null, querySelectorAll: () => [], documentElement: { classList: { add() {} } }, addEventListener() {} }, navigator: {} });
  await ready; await Promise.resolve();
  return { registrations, configurations, bindings };
}
for (const options of [{ reduced: true }, { libraries: false }, { site: false }]) assert.deepEqual(await boot(options), { registrations: 0, configurations: 0, bindings: 0 });
assert.deepEqual(await boot(), { registrations: 1, configurations: 1, bindings: 1 });
console.log('Motion checks passed: current script order, reduced motion, missing dependencies, Lenis binding.');
