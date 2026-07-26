import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const source = await readFile(path.join(root, "js", "content.js"), "utf8");
const filenames = [
  "00-meta.json",
  "01-nav.json",
  "02-hero.json",
  "03-services.json",
  "04-work.json",
  "05-dev.json",
  "06-operations.json",
  "07-stats.json",
  "08-testimonials.json",
  "09-about.json",
  "10-credentials.json",
  "11-contact.json"
];

const baseline = Object.fromEntries(
  await Promise.all(
    filenames.map(async (filename) => [
      filename,
      JSON.parse(await readFile(path.join(root, "data", filename), "utf8"))
    ])
  )
);

class MockElement {
  constructor() {
    this.hidden = false;
    this.innerHTML = "";
    this.textContent = "";
    this.attributes = new Map();
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  replaceChildren() {
    this.innerHTML = "";
    this.textContent = "";
  }
}

function count(sourceText, pattern) {
  return (sourceText.match(pattern) || []).length;
}

async function renderWith(mutate = () => {}) {
  const data = structuredClone(baseline);
  mutate(data);

  const selectors = new Map();
  const getElement = (selector) => {
    if (!selectors.has(selector)) selectors.set(selector, new MockElement());
    return selectors.get(selector);
  };

  [
    "nav",
    "hero",
    "work-heading",
    "services",
    "work",
    "dev",
    "operations",
    "stats",
    "testimonials",
    "about",
    "credentials",
    "contact",
    "footer"
  ].forEach((name) => getElement(`[data-content="${name}"]`));

  getElement("#work");
  getElement("#about");
  getElement("#content-status");
  getElement('meta[name="description"]');
  getElement('meta[property="og:title"]');
  getElement('meta[property="og:description"]');
  getElement('meta[property="og:url"]');
  getElement('meta[property="og:image"]');
  getElement('meta[property="og:image:alt"]');
  getElement('link[rel="canonical"]');

  const document = {
    title: "",
    querySelector(selector) {
      return selectors.get(selector) || null;
    }
  };

  const context = vm.createContext({
    console,
    document,
    window: {},
    encodeURIComponent,
    fetch: async (url) => {
      const filename = String(url).split("/").pop();
      if (!(filename in data)) return { ok: false, status: 404 };
      return {
        ok: true,
        status: 200,
        async json() {
          return structuredClone(data[filename]);
        }
      };
    }
  });

  vm.runInContext(source, context, { filename: "js/content.js" });
  await context.window.portfolioContentReady;
  return { selectors, document };
}

const normal = await renderWith();
assert.equal(count(normal.selectors.get('[data-content="work"]').innerHTML, /class="case-study"/g), 8);
assert.equal(count(normal.selectors.get('[data-content="work"]').innerHTML, /class="case-result-badge"/g), 8);
assert.equal(count(normal.selectors.get('[data-content="work"]').innerHTML, /class="play-pill"/g), 8);
assert.doesNotMatch(normal.selectors.get('[data-content="work"]').innerHTML, /class="case-result"/);
assert.doesNotMatch(normal.selectors.get('[data-content="work"]').innerHTML, />\s*Play (TikTok|Short|Edit|Reel)\s*</);
assert.equal(count(normal.selectors.get('[data-content="dev"]').innerHTML, /<article>/g), 5);
assert.equal(count(normal.selectors.get('[data-content="stats"]').innerHTML, /class="proof-card image-trigger"/g), 5);
assert.equal(normal.selectors.get('[data-content="testimonials"]').hidden, true);

const added = await renderWith((data) => {
  data["04-work.json"].items.push({
    ...data["04-work.json"].items[0],
    title: "Temporary ninth project"
  });
  data["03-services.json"].items.push(
    { ...data["03-services.json"].items[0], title: "Fourth service" },
    { ...data["03-services.json"].items[0], title: "Fifth service" }
  );
});
assert.equal(count(added.selectors.get('[data-content="work"]').innerHTML, /class="case-study"/g), 9);
assert.match(added.selectors.get('[data-content="work"]').innerHTML, /09 \/ 09/);
assert.equal(count(added.selectors.get('[data-content="services"]').innerHTML, /<article>/g), 5);

const removed = await renderWith((data) => {
  data["04-work.json"].items = [];
  data["05-dev.json"].projects = [];
  data["07-stats.json"].items = [];
  data["10-credentials.json"].items = [];
});
assert.doesNotMatch(removed.selectors.get('[data-content="work"]').innerHTML, /class="case-study"/);
assert.doesNotMatch(removed.selectors.get('[data-content="dev"]').innerHTML, /class="repo-list/);
assert.doesNotMatch(removed.selectors.get('[data-content="stats"]').innerHTML, /class="proof-grid/);
assert.doesNotMatch(removed.selectors.get('[data-content="credentials"]').innerHTML, /class="certificate-grid/);

const malformedOptionalItems = await renderWith((data) => {
  data["04-work.json"].items.push(null, "invalid item");
  data["05-dev.json"].projects.push(null);
});
assert.equal(count(malformedOptionalItems.selectors.get('[data-content="work"]').innerHTML, /class="case-study"/g), 8);
assert.equal(count(malformedOptionalItems.selectors.get('[data-content="dev"]').innerHTML, /<article>/g), 5);

const testimonial = await renderWith((data) => {
  data["08-testimonials.json"].enabled = true;
  data["08-testimonials.json"].items = [
    { quote: "Reliable and creative.", name: "Test Client", role: "Producer" }
  ];
});
assert.equal(testimonial.selectors.get('[data-content="testimonials"]').hidden, false);
assert.equal(count(testimonial.selectors.get('[data-content="testimonials"]').innerHTML, /class="testimonial-card"/g), 1);
assert.doesNotMatch(testimonial.selectors.get('[data-content="testimonials"]').innerHTML, /gallery-controls/);

console.log("Rendering tests passed: baseline, added items, removed items, and optional testimonials checked.");
