import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const [index, styles, app, motion, motionCss, editorialCss, layout, components] = await Promise.all([
  readFile(path.join(root, "index.html"), "utf8"),
  readFile(path.join(root, "css", "styles.css"), "utf8"),
  readFile(path.join(root, "js", "app.js"), "utf8"),
  readFile(path.join(root, "js", "motion.js"), "utf8"),
  readFile(path.join(root, "css", "motion.css"), "utf8"),
  readFile(path.join(root, "css", "editorial-cut.css"), "utf8"),
  readFile(path.join(root, "css", "layout.css"), "utf8"),
  readFile(path.join(root, "css", "components.css"), "utf8")
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
assert.doesNotMatch(app, /clone\.inert\s*=\s*true/, "Carousel clones must remain pointer-targetable for consistent hover feedback");
assert.match(app, /originalControls\[controlIndex\]\?\.click\(\)/, "Clone controls must forward activation to the matching accessible original");
assert.match(motion, /!window\.gsap \|\| !window\.ScrollTrigger/, "Motion must exit safely without GSAP");
assert.match(motion, /prefers-reduced-motion: reduce/, "Motion must respect reduced-motion preferences");
assert.match(motion, /navigator\.connection\?\.saveData/, "Motion must respect data-saver mode");
assert.match(motion, /MOTION_CONFIG/, "Motion values must come from one reusable configuration");
assert.match(motion, /animateRevealDetails/, "Motion should layer details without changing layout");
assert.match(motion, /animateMicroInteractions/, "Motion should reuse pointer micro-interactions");
assert.doesNotMatch(motion, /navigationEntry\?\.type\s*!==\s*["']reload["']/, "Hero motion should remain visible during local refresh testing");
assert.match(index, /classList\.add\("editorial-cut"\)/, "The editorial system must be enabled from one root class");
assert.match(index, /class="scroll-progress" aria-hidden="true"/, "The page must expose a non-verbal reading progress indicator");
assert.match(index, /js\/app\.js\?v=20260817-2/, "The UX update must bypass the previous application cache");
assert.match(index, /js\/motion\.js\?v=20260817-9/, "The visible motion update must bypass the previous browser cache");
assert.match(styles, /editorial-cut\.css\?v=\d+/, "The stylesheet entry point must load the editorial theme with a cache version");
assert.doesNotMatch(styles, /liquid-glass/, "The removed glass theme must not load");
assert.match(motion, /MOTION_PROFILES/, "Motion variants must come from reusable profiles");
assert.match(motion, /name: "cut"/, "Headings should use the editorial cut family");
assert.match(motion, /name: "lift"/, "Cards and panels should use the lift family");
assert.match(motion, /name: "stagger"/, "Metadata should use the stagger family");
assert.match(motion, /clipPath: "inset\(0 0 10% 0\)"/, "Portfolio media should use a short wipe reveal");
assert.match(motion, /animateExpandableDetails/, "Expandable panels should animate their rendered content");
assert.doesNotMatch(motion, /scrub\s*:/, "Motion must avoid continuous scroll-linked scrub work");
assert.doesNotMatch(motion, /quickTo|rotationX|rotationY|animateMagnetic/, "Motion must avoid novelty pointer effects");
assert.doesNotMatch(editorialCss, /backdrop-filter:\s*blur/, "Editorial surfaces must not use backdrop blur");
assert.doesNotMatch(editorialCss, /radial-gradient/, "Editorial surfaces must not use floating gradient blobs");
assert.doesNotMatch(editorialCss, /border-radius:\s*(?:[1-9]|0\.)/, "Editorial surfaces must not restore rounded glass cards");
assert.match(editorialCss, /--signal:\s*#31c979/, "The editorial system must use one reusable signal color");
assert.match(editorialCss, /\.subsection-title p > span:first-child/, "Only subsection numbers should receive the signal highlight");
assert.doesNotMatch(editorialCss, /\.subsection-title p span\s*\{[^}]*background:\s*var\(--signal\)/, "Subsection label text must not receive a green highlight");
assert.match(editorialCss, /html\.editorial-cut \.hero-reel\s*\{/, "The hero must expose the reusable project-frame wall");
assert.match(editorialCss, /html\.editorial-cut \.hero-receipt\s*\{[^}]*position:\s*relative/, "The hero proof panel must stay in normal layout flow");
assert.doesNotMatch(editorialCss, /html\.editorial-cut \.hero-receipt\s*\{[^}]*position:\s*absolute/, "The hero proof panel must not overlap project captions");
assert.match(editorialCss, /html\.editorial-cut \.credentials-heading\s*\{[^}]*grid-template-columns:/, "Credentials must use the reusable editorial masthead layout");
assert.match(editorialCss, /html\.editorial-cut \.operations-section-summary\s*\{[^}]*min-height:\s*64px/, "Section 03 must expose a compact accessible summary");
assert.match(editorialCss, /\.credentials \.credentials-actions > \.ui-action\s*\{[^}]*background:\s*var\(--signal\)\s*!important/, "The credentials verification action must remain visible on the dark panel");
assert.match(editorialCss, /html\.editorial-cut \.hero-services[\s\S]*?border-top:\s*1px solid var\(--ink\)/, "Hero services must share one editorial timeline treatment");
assert.match(editorialCss, /html\.editorial-cut \.contact\s*\{[\s\S]*?background:\s*var\(--night\)/, "Contact must provide a deliberate dark end-cap");
assert.match(editorialCss, /html\.editorial-cut \.site-footer\s*\{[\s\S]*?width:\s*100%/, "The footer must continue the full-width contact end-cap");
assert.match(editorialCss, /html\.editorial-cut \.contact-email strong\s*\{[\s\S]*?color:\s*var\(--white\)\s*!important/, "The contact address must stay readable on the dark email rail");
assert.match(editorialCss, /html\.editorial-cut \.contact-email\s*\{[\s\S]*?max-width:\s*410px/, "The contact action must remain compact on desktop");
assert.match(editorialCss, /html\.editorial-cut \.contact-email strong\s*\{[\s\S]*?font-size:\s*clamp\(18px, 1\.8vw, 24px\)/, "The contact action label must not become a display heading");
assert.match(app, /scrollProgress\.style\.transform = `scaleX\(\$\{progress\}\)`/, "Reading progress must reuse the scheduled navigation frame");
assert.match(editorialCss, /html\.editorial-cut \.about-layout\s*\{[\s\S]*?background:\s*var\(--night\)/, "About must use the shared editorial split-panel treatment");
assert.doesNotMatch(editorialCss, /content:\s*["'][^"']*[A-Za-z][^"']*["']/, "The editorial layer must not hardcode visible interface copy");
assert.doesNotMatch(editorialCss, /content-details[^{}]*summary::after/, "The editorial theme must reuse the shared dropdown component instead of drawing a local control");
assert.doesNotMatch(layout, /content-details[^{}]*summary::after/, "Dropdown controls must be rendered by the shared component instead of CSS pseudo-elements");
assert.match(components, /\.ui-disclosure-control\s*\{/, "Dropdowns must share one reusable visual control");
assert.match(components, /\.ui-chevron\s*\{/, "Dropdowns and navigation must share one chevron primitive");
assert.match(editorialCss, /html\.editorial-cut \.case-study,[\s\S]*?border-top:\s*3px solid var\(--ink\)/, "Work cards must share one real top-border treatment");
assert.match(editorialCss, /html\.editorial-cut \.case-study:hover,[\s\S]*?border-top-color:\s*var\(--signal\)/, "Every hovered work card must expose the signal border");
assert.doesNotMatch(editorialCss, /\.case-study:hover::before/, "Card hover feedback must not depend on layered pseudo-elements");
assert.match(editorialCss, /html\.editorial-cut \.development \.horizontal-track[\s\S]*?mask-image:\s*none/, "Web project masks must not clip hover markers");
assert.match(motionCss, /html\.gsap-motion-ready \.reveal[\s\S]*?will-change:\s*auto/, "Reveal layers must only be promoted while animating");
assert.doesNotMatch(motion, /\.innerHTML\s*=/, "Motion must not hardcode rendered interface content");
assert.doesNotMatch(motion, /document\.createElement/, "Motion must not create layout-dependent UI");
assert.doesNotMatch(editorialCss, /\.scroll-progress span[\s\S]*?will-change:/, "Reading progress must not keep a permanent compositor promotion");

assert.doesNotMatch(
  motionCss.match(/\.reveal\s*\{[\s\S]*?\}/)?.[0] || "",
  /filter\s*:\s*blur/,
  "Reveal motion must not blur section content"
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

console.log("Motion tests passed: dependency order, fallback, three motion families, performance modes, and editorial theme checked.");
