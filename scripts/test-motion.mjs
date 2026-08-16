import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const [index, app, motion, motionCss, glassCss] = await Promise.all([
  readFile(path.join(root, "index.html"), "utf8"),
  readFile(path.join(root, "js", "app.js"), "utf8"),
  readFile(path.join(root, "js", "motion.js"), "utf8"),
  readFile(path.join(root, "css", "motion.css"), "utf8"),
  readFile(path.join(root, "css", "liquid-glass.css"), "utf8")
]);

const appPosition = index.indexOf("js/app.js");
const gsapPosition = index.indexOf("gsap.min.js");
const scrollTriggerPosition = index.indexOf("ScrollTrigger.min.js");
const motionPosition = index.indexOf("js/motion.js");

assert.ok(appPosition >= 0, "index.html must load the original application script");
assert.ok(gsapPosition > appPosition, "GSAP must load after the independent application script");
assert.ok(scrollTriggerPosition > gsapPosition, "ScrollTrigger must load after GSAP Core");
assert.ok(motionPosition > scrollTriggerPosition, "The motion layer must load after its optional libraries");
assert.match(index, /gsap@3\.13\.0\/dist\/gsap\.min\.js/);
assert.match(index, /gsap@3\.13\.0\/dist\/ScrollTrigger\.min\.js/);

assert.match(app, /IntersectionObserver/, "The original reveal fallback must remain in app.js");
assert.match(motion, /!window\.gsap \|\| !window\.ScrollTrigger/, "Motion must exit safely without GSAP");
assert.match(motion, /prefers-reduced-motion: reduce/, "Motion must respect reduced-motion preferences");
assert.match(motion, /navigator\.connection\?\.saveData/, "Motion must respect data-saver mode");
assert.match(motion, /MOTION_CONFIG/, "Motion values must come from one reusable configuration");
assert.match(motion, /animateRevealDetails/, "Motion should layer details without changing layout");
assert.match(motion, /animateMicroInteractions/, "Motion should reuse pointer micro-interactions");
assert.doesNotMatch(motion, /navigationEntry\?\.type\s*!==\s*["']reload["']/, "Hero motion should remain visible during local refresh testing");
assert.match(index, /js\/motion\.js\?v=20260817-8/, "The visible motion update must bypass the previous browser cache");
assert.match(motion, /REVEAL_MOTION_PROFILES/, "Section animation variants must come from reusable profiles");
assert.match(motion, /selector: "\.repo-list article"/, "Project cards should use their own motion direction");
assert.match(motion, /selector: "\.proof-card"/, "Proof cards should use their own scale entrance");
assert.match(motion, /selector: "\.about-layout"/, "About should have its own restrained entrance profile");
assert.match(motion, /selector: "\.contact-email"/, "Contact actions should have their own entrance profile");
assert.match(motion, /clipPath: "inset\(0 0 12% 0\)"/, "Portfolio media should use a fast wipe reveal");
assert.match(motion, /animateCardDepth/, "Desktop cards should have restrained pointer depth");
assert.match(motion, /animateExpandableDetails/, "Expandable panels should animate their rendered content");
assert.match(motion, /animateTactileControls/, "Existing controls should have reusable tactile feedback");
assert.match(motion, /animateFooterEntrance/, "The footer should participate in the site motion system");
assert.match(motion, /animateActiveNavigation/, "Existing active navigation state should receive motion feedback");
assert.match(motion, /animateGallerySelection/, "Gallery selection changes should receive motion feedback");
assert.match(motion, /animateMagneticControls/, "Primary controls should have restrained pointer attraction");
assert.doesNotMatch(motion, /scrub\s*:/, "Motion must avoid continuous scroll-linked scrub work");
assert.doesNotMatch(glassCss, /background-attachment:\s*fixed/, "The full-page gradient must not repaint as a fixed background");
assert.match(glassCss, /html\.liquid-glass \.site-header[\s\S]*?backdrop-filter:\s*none/, "The sticky header must not recompute backdrop blur during scroll");
assert.match(motionCss, /html\.gsap-motion-ready \.reveal[\s\S]*?will-change:\s*auto/, "Reveal layers must only be promoted while animating");
assert.doesNotMatch(motion, /\.innerHTML\s*=/, "Motion must not hardcode rendered interface content");
assert.doesNotMatch(motion, /document\.createElement/, "Motion must not create layout-dependent UI");

assert.doesNotMatch(
  motionCss.match(/\.reveal\s*\{[\s\S]*?\}/)?.[0] || "",
  /filter\s*:\s*blur/,
  "Reveal motion must not blur section content"
);
assert.match(
  glassCss,
  /Keep the current liquid-glass colors and surfaces[\s\S]*?html\.liquid-glass \.contact[\s\S]*?backdrop-filter: none/,
  "Content surfaces must explicitly disable backdrop blur"
);

async function runMotionWith({ reduced = false, withGsap = false } = {}) {
  let registered = false;
  let refreshed = false;
  const gsap = {
    registerPlugin() {
      registered = true;
    },
    utils: { toArray: () => [] },
    set() {},
    to() {},
    fromTo() {},
    timeline() {
      return { fromTo() { return this; } };
    }
  };
  const ScrollTrigger = {
    create() {},
    refresh() {
      refreshed = true;
    }
  };
  const classList = { add() {}, remove() {}, contains() { return false; } };
  const ready = Promise.resolve();
  const window = {
    portfolioContentReady: ready,
    matchMedia: () => ({ matches: reduced }),
    location: { hash: "" },
    scrollY: 0,
    requestAnimationFrame(callback) {
      callback();
    },
    addEventListener() {},
    ...(withGsap ? { gsap, ScrollTrigger } : {})
  };
  const context = vm.createContext({
    console,
    document: {
      readyState: "complete",
      documentElement: { classList },
      querySelectorAll: () => [],
      querySelector: () => null
    },
    window,
    navigator: {},
    performance: { now: () => 0, getEntriesByType: () => [] },
    MutationObserver: class {}
  });

  vm.runInContext(motion, context, { filename: "js/motion.js" });
  await ready;
  await Promise.resolve();
  return { registered, refreshed };
}

assert.deepEqual(
  await runMotionWith(),
  { registered: false, refreshed: false },
  "The page must keep working when GSAP is unavailable"
);
assert.deepEqual(
  await runMotionWith({ reduced: true, withGsap: true }),
  { registered: false, refreshed: false },
  "Reduced-motion users must skip GSAP initialization"
);
assert.deepEqual(
  await runMotionWith({ withGsap: true }),
  { registered: true, refreshed: true },
  "GSAP should initialize when the optional libraries are available"
);

console.log("Motion tests passed: dependency order, fallback, performance modes, and blur removal checked.");
