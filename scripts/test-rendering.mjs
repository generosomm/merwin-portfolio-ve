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
  "04-work.json",
  "05-dev.json",
  "06-operations.json",
  "07-stats.json",
  "08-testimonials.json",
  "09-about.json",
  "10-credentials.json",
  "11-contact.json",
  "12-ui.json"
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
  getElement("#skip-link");
  getElement("#video-dialog");
  getElement("#image-dialog");
  getElement("#video-dialog-close");
  getElement("#image-dialog-close");
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
assert.equal(normal.selectors.get("#skip-link").textContent, "Skip to content");
assert.match(normal.selectors.get('[data-content="hero"]').innerHTML, /Merwin<br><em>Generoso\.<\/em>/);
assert.equal(count(normal.selectors.get('[data-content="hero"]').innerHTML, /class="hero-frame"/g), 3);
assert.match(normal.selectors.get('[data-content="hero"]').innerHTML, /aria-label="Featured editing work preview"/);
assert.match(normal.selectors.get('[data-content="hero"]').innerHTML, /seven-sundays-thumb\.jpg/);
assert.match(normal.selectors.get("#video-dialog-close").innerHTML, /Close &times;/);
assert.match(normal.selectors.get('[data-content="nav"]').innerHTML, /assets\/images\/og-cover\.jpg/);
assert.match(normal.selectors.get('[data-content="nav"]').innerHTML, /alt="ERO Visuals logo"/);
assert.doesNotMatch(normal.selectors.get('[data-content="nav"]').innerHTML, />MG</);
assert.match(normal.selectors.get('[data-content="nav"]').innerHTML, /<a href="#top">Home<\/a>/);
assert.match(normal.selectors.get('[data-content="nav"]').innerHTML, /class="nav-dropdown"/);
assert.match(normal.selectors.get('[data-content="nav"]').innerHTML, /class="nav-dropdown-menu"/);
assert.match(normal.selectors.get('[data-content="nav"]').innerHTML, /class="nav-dropdown-trigger"[\s\S]*class="ui-chevron"/);
assert.equal(count(normal.selectors.get('[data-content="nav"]').innerHTML, /class="nav-dropdown-menu"[\s\S]*href="#editing"[\s\S]*href="#development"[\s\S]*href="#operations"/g), 1);
  assert.equal(count(normal.selectors.get('[data-content="work"]').innerHTML, /class="case-study ui-card"/g), 8);
  assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /class="role-spotlight header-card ui-card video-spotlight"/);
  assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /Short-form edits built to earn attention/);
  assert.doesNotMatch(normal.selectors.get('[data-content="work"]').innerHTML, /124M\+ combined views|TikTok followers|YouTube subscribers|Creating since 2022/);
  assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /class="header-card-action ui-action ui-action-outline" href="#proof"><span>View analytics<\/span>/);
  assert.match(
    normal.selectors.get('[data-content="work"]').innerHTML,
    /class="creator-action-row"><a class="header-card-action ui-action ui-action-outline" href="#proof"><span>View analytics<\/span>/
  );
  assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /2022 – Present/);
  assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /2025 – Present/);
  assert.doesNotMatch(normal.selectors.get('[data-content="work"]').innerHTML, /June 2025/);
  assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /class="content-details council-details"/);
  assert.match(
    normal.selectors.get('[data-content="work"]').innerHTML,
    /class="role-spotlight-details header-card-secondary video-role-details"[\s\S]*NU Laguna School of Computer Studies Student Council[\s\S]*class="content-details council-details"/
  );
  assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /class="council-details-copy"/);
  assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /Browse council work <b>15<\/b>/);
assert.equal(count(normal.selectors.get('[data-content="work"]').innerHTML, /class="case-result-badge"/g), 8);
assert.equal(count(normal.selectors.get('[data-content="work"]').innerHTML, /class="play-pill"/g), 8);
assert.doesNotMatch(normal.selectors.get('[data-content="work"]').innerHTML, /class="case-result"/);
assert.doesNotMatch(normal.selectors.get('[data-content="work"]').innerHTML, /class="case-label"/);
assert.doesNotMatch(normal.selectors.get('[data-content="work"]').innerHTML, /class="case-scope"/);
assert.equal(count(normal.selectors.get('[data-content="work"]').innerHTML, /class="case-category"/g), 8);
assert.equal(count(normal.selectors.get('[data-content="work"]').innerHTML, /class="case-meta-row"/g), 8);
assert.equal(count(normal.selectors.get('[data-content="work"]').innerHTML, /class="case-original-link ui-action ui-action-outline"/g), 8);
assert.equal(count(normal.selectors.get('[data-content="work"]').innerHTML, /<span>View post<\/span><span aria-hidden="true">&nearr;<\/span><\/a>/g), 8);
assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /immediate emotional hook\.<\/p>\s*<div class="case-actions"><a class="case-original-link/);
assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /aria-label="View original post: Glass Child/);
assert.equal(count(normal.selectors.get('[data-content="work"]').innerHTML, /class="case-platform-icon /g), 8);
assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /class="case-platform-icon case-platform-tiktok" role="img" aria-label="TikTok"/);
assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /class="case-platform-icon case-platform-youtube" role="img" aria-label="YouTube"/);
assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /class="case-platform-icon case-platform-instagram" role="img" aria-label="Instagram"/);
assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /class="case-platform-icon case-platform-facebook" role="img" aria-label="Facebook"/);
assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /Film promo/);
assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /Video Production Officer/);
assert.equal(count(normal.selectors.get('[data-content="work"]').innerHTML, /class="selected-role-link"/g), 15);
assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /class="role-links-track council-work-track horizontal-track"/);
assert.equal(count(normal.selectors.get('[data-content="work"]').innerHTML, /data-scroll-target="council-work-track"/g), 2);
assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /aria-label="Scroll council work left"/);
assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /aria-label="Scroll council work right"/);
assert.ok(
  normal.selectors.get('[data-content="work"]').innerHTML.indexOf("BBQ Night 2026 Highlights")
    < normal.selectors.get('[data-content="work"]').innerHTML.indexOf("AlNUsalan 2025 Launch")
);
assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /Selected Editing Work/);
assert.doesNotMatch(normal.selectors.get('[data-content="work"]').innerHTML, /Drag to explore/);
assert.equal(count(normal.selectors.get('[data-content="work"]').innerHTML, /class="video-social-link"/g), 4);
assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /Watch more of my work/);
assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /aria-label="YouTube"/);
assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /class="role-organization-link"/);
assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /View all council reels/);
assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /class="role-organization-icon"/);
assert.doesNotMatch(normal.selectors.get('[data-content="work"]').innerHTML, /class="role-reels-link"/);
assert.doesNotMatch(normal.selectors.get('[data-content="work"]').innerHTML, />\s*Play (TikTok|Short|Edit|Reel)\s*</);
assert.equal(count(normal.selectors.get('[data-content="work"]').innerHTML, /data-scroll-target="video-track"/g), 2);
assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /aria-label="Scroll Video projects left"/);
assert.match(normal.selectors.get('[data-content="work"]').innerHTML, /aria-label="Scroll Video projects right"/);
assert.equal(count(normal.selectors.get('[data-content="dev"]').innerHTML, /<article>/g), 5);
assert.doesNotMatch(normal.selectors.get('[data-content="dev"]').innerHTML, /class="repo-index"/);
assert.equal(count(normal.selectors.get('[data-content="dev"]').innerHTML, /data-scroll-target="project-track"/g), 2);
assert.match(normal.selectors.get('[data-content="dev"]').innerHTML, /aria-label="Scroll Software projects left"/);
assert.match(normal.selectors.get('[data-content="dev"]').innerHTML, /aria-label="Scroll Software projects right"/);
assert.doesNotMatch(normal.selectors.get('[data-content="dev"]').innerHTML, /Drag to explore/);
assert.match(normal.selectors.get('[data-content="dev"]').innerHTML, /class="external-project-icon"/);
assert.match(normal.selectors.get('[data-content="dev"]').innerHTML, /View GitHub/);
assert.match(normal.selectors.get('[data-content="dev"]').innerHTML, /Web Development Lead/);
assert.match(normal.selectors.get('[data-content="dev"]').innerHTML, /Microsoft Student Community - NU Laguna/);
assert.match(normal.selectors.get('[data-content="dev"]').innerHTML, /SparkPoint 2026/);
assert.match(normal.selectors.get('[data-content="dev"]').innerHTML, /View our page/);
assert.match(normal.selectors.get('[data-content="dev"]').innerHTML, /class="role-organization-icon"/);
assert.doesNotMatch(normal.selectors.get('[data-content="dev"]').innerHTML, /View community contributions|Live MSC website|View source code/);
  assert.equal(count(normal.selectors.get('[data-content="dev"]').innerHTML, /class="tech-icons"/g), 5);
  assert.match(normal.selectors.get('[data-content="dev"]').innerHTML, /class="gallery-kicker">Selected web projects/);
  assert.doesNotMatch(normal.selectors.get('[data-content="dev"]').innerHTML, /class="dev-intro"/);
  assert.match(normal.selectors.get('[data-content="dev"]').innerHTML, /class="role-spotlight header-card development-role ui-card"/);
  assert.match(normal.selectors.get('[data-content="dev"]').innerHTML, /Backend v1 launched at SparkPoint 2026/);
assert.match(normal.selectors.get('[data-content="dev"]').innerHTML, /class="tech-icon tech-icon-html"/);
assert.match(normal.selectors.get('[data-content="dev"]').innerHTML, /class="tech-icon tech-icon-javascript"/);
assert.equal(count(normal.selectors.get('[data-content="dev"]').innerHTML, /aria-label="HTML5"/g), 3);
assert.match(normal.selectors.get('[data-content="dev"]').innerHTML, /aria-label="Node\.js"/);
assert.match(normal.selectors.get('[data-content="dev"]').innerHTML, /aria-label="PHP"/);
assert.doesNotMatch(normal.selectors.get('[data-content="dev"]').innerHTML, /HTML\s*\/\s*CSS/);
assert.doesNotMatch(normal.selectors.get('[data-content="dev"]').innerHTML, /class="repo-features"/);
assert.match(normal.selectors.get('[data-content="dev"]').innerHTML, /View website/);
assert.equal(count(normal.selectors.get('[data-content="stats"]').innerHTML, /class="proof-card image-trigger ui-card"/g), 5);
assert.equal(normal.selectors.get('[data-content="testimonials"]').hidden, true);
assert.equal(count(normal.selectors.get('[data-content="operations"]').innerHTML, /class="operations-card ui-card"/g), 3);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /^<details class="operations-section-details content-details">/);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /<summary class="subsection-title operations-section-summary">/);
assert.doesNotMatch(normal.selectors.get('[data-content="operations"]').innerHTML, /<details class="operations-section-details content-details"\s+open/);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /class="operations-label-mobile">Creative VA/);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /class="operations-status-mobile">Small brands &amp; teams/);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /class="role-spotlight header-card operations-role ui-card"/);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /Keep daily work moving/);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /Clear priorities and reliable follow-through/);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /Available for remote projects/);
assert.doesNotMatch(normal.selectors.get('[data-content="operations"]').innerHTML, /Explore workflow samples/);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /id="operations-workflows"/);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /class="gallery-kicker">Workflow samples/);
assert.doesNotMatch(normal.selectors.get('[data-content="operations"]').innerHTML, /class="operations-intro"/);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /e-commerce operations/i);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /Admin coordination/);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /Content operations/);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /class="operations-outcome"/);
assert.equal(count(normal.selectors.get('[data-content="operations"]').innerHTML, /class="content-details operations-details"/g), 3);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /Workflow demo/);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /class="operations-cards horizontal-track"/);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /data-scroll-target="operations-track"/);
assert.equal(count(normal.selectors.get('[data-content="operations"]').innerHTML, /class="operations-tool /g), 12);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /operations-tool-shopify/);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /operations-tool-gmail/);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /operations-tool-drive/);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /operations-tool-capcut/);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /aria-label="Google Calendar"/);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /class="sr-only">Meta Business Suite/);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /api\.iconify\.design\/logos:shopify\.svg/);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /Problem: listing errors and delayed order updates/);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /How I solve it/);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /Result: fewer catalog errors and faster customer updates/);
assert.doesNotMatch(normal.selectors.get('[data-content="operations"]').innerHTML, /Practice scope|Sample deliverables|paid-client results/);
assert.doesNotMatch(normal.selectors.get('[data-content="operations"]').innerHTML, /Portfolio exercises using demo data/);
assert.doesNotMatch(normal.selectors.get('[data-content="about"]').innerHTML, /student|Batangas/i);

for (const section of ["work", "dev", "operations", "about"]) {
  const markup = normal.selectors.get(`[data-content="${section}"]`).innerHTML;
  assert.equal(
    count(markup, /<summary(?:\s|>)/g),
    count(markup, /class="ui-disclosure-control"/g),
    `${section} must use the shared dropdown control for every disclosure`
  );
}
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /ui-disclosure-state-closed">Show</);
assert.match(normal.selectors.get('[data-content="operations"]').innerHTML, /ui-disclosure-state-open">Hide</);
assert.match(normal.selectors.get('[data-content="credentials"]').innerHTML, /class="credentials-kicker-row"[\s\S]*Training and certifications[\s\S]*class="credentials-actions"/);
assert.match(normal.selectors.get('[data-content="credentials"]').innerHTML, /Skills backed by recognized credentials\./);
assert.doesNotMatch(normal.selectors.get('[data-content="credentials"]').innerHTML, /class="credentials-details|View credentials/);
assert.match(normal.selectors.get('[data-content="contact"]').innerHTML, /class="contact-social-link contact-social-linkedin"/);
assert.match(normal.selectors.get('[data-content="contact"]').innerHTML, /class="contact-links-label">Connect with me/);
assert.match(normal.selectors.get('[data-content="contact"]').innerHTML, /class="contact-social-link contact-social-youtube"/);
assert.match(normal.selectors.get('[data-content="contact"]').innerHTML, /class="contact-cv-link ui-action ui-action-outline"[^>]*><span>View CV<\/span>/);
assert.match(normal.selectors.get('[data-content="contact"]').innerHTML, /class="eyebrow contact-availability">Available for remote work/);
assert.doesNotMatch(normal.selectors.get('[data-content="contact"]').innerHTML, /class="contact-social-link contact-social-cv"/);
assert.doesNotMatch(normal.selectors.get('[data-content="contact"]').innerHTML, />LinkedIn &nearr;</);
assert.match(normal.selectors.get('[data-content="footer"]').innerHTML, /2026/);
assert.match(normal.selectors.get('[data-content="footer"]').innerHTML, /Merwin Generoso/);
assert.match(normal.selectors.get('[data-content="footer"]').innerHTML, /Designed and built from scratch\./);
assert.match(normal.selectors.get('[data-content="footer"]').innerHTML, /Back to top/);

const revisedInterface = await renderWith((data) => {
  data["12-ui.json"].labels.connectWithMe = "Professional links";
  data["12-ui.json"].labels.expand = "Open proof";
  data["12-ui.json"].labels.featuredWorkPreview = "Selected project frames";
});
assert.match(revisedInterface.selectors.get('[data-content="contact"]').innerHTML, /Professional links/);
assert.match(revisedInterface.selectors.get('[data-content="stats"]').innerHTML, /Open proof/);
assert.match(revisedInterface.selectors.get('[data-content="hero"]').innerHTML, /aria-label="Selected project frames"/);

const added = await renderWith((data) => {
  data["04-work.json"].items.push({
    ...data["04-work.json"].items[0],
    title: "Temporary ninth project"
  });
  data["05-dev.json"].projects[0].technologies.push({ name: "PHP", icon: "php" });
  data["05-dev.json"].projects[1].technologies = [];
  data["05-dev.json"].projects[0].features = ["Responsive client dashboard", "Documented handoff"];
  data["06-operations.json"].items.push({
    ...data["06-operations.json"].items[0],
    title: "Temporary fourth VA workflow"
  });
  data["09-about.json"].paragraphs.push("Temporary extended about paragraph.");
});
assert.equal(count(added.selectors.get('[data-content="work"]').innerHTML, /class="case-study ui-card"/g), 9);
assert.match(added.selectors.get('[data-content="work"]').innerHTML, /Temporary ninth project/);
assert.equal(count(added.selectors.get('[data-content="dev"]').innerHTML, /class="tech-icons"/g), 4);
assert.equal(count(added.selectors.get('[data-content="dev"]').innerHTML, /aria-label="PHP"/g), 2);
assert.equal(count(added.selectors.get('[data-content="operations"]').innerHTML, /class="operations-card ui-card"/g), 4);
assert.match(added.selectors.get('[data-content="operations"]').innerHTML, /Temporary fourth VA workflow/);
assert.match(added.selectors.get('[data-content="dev"]').innerHTML, /class="content-details repo-details"/);
assert.match(added.selectors.get('[data-content="dev"]').innerHTML, /Project details/);
assert.match(added.selectors.get('[data-content="about"]').innerHTML, /class="content-details about-details"/);
assert.match(added.selectors.get('[data-content="about"]').innerHTML, /Temporary extended about paragraph/);

const removed = await renderWith((data) => {
  data["04-work.json"].items = [];
  data["05-dev.json"].projects = [];
  data["06-operations.json"].items = [];
  data["07-stats.json"].items = [];
  data["10-credentials.json"].items = [];
});
assert.doesNotMatch(removed.selectors.get('[data-content="work"]').innerHTML, /class="case-study ui-card"/);
assert.doesNotMatch(removed.selectors.get('[data-content="hero"]').innerHTML, /class="hero-reel"/);
assert.doesNotMatch(removed.selectors.get('[data-content="dev"]').innerHTML, /class="repo-list/);
assert.doesNotMatch(removed.selectors.get('[data-content="operations"]').innerHTML, /class="operations-card ui-card"/);
assert.doesNotMatch(removed.selectors.get('[data-content="stats"]').innerHTML, /class="proof-grid/);
assert.doesNotMatch(removed.selectors.get('[data-content="credentials"]').innerHTML, /class="certificate-grid/);

const malformedOptionalItems = await renderWith((data) => {
  data["04-work.json"].items.push(null, "invalid item");
  data["05-dev.json"].projects.push(null);
});
assert.equal(count(malformedOptionalItems.selectors.get('[data-content="work"]').innerHTML, /class="case-study ui-card"/g), 8);
assert.equal(count(malformedOptionalItems.selectors.get('[data-content="dev"]').innerHTML, /<article>/g), 5);

const testimonial = await renderWith((data) => {
  data["08-testimonials.json"].enabled = true;
  data["08-testimonials.json"].items = [
    { quote: "Reliable and creative.", name: "Test Client", role: "Producer" }
  ];
});
assert.equal(testimonial.selectors.get('[data-content="testimonials"]').hidden, false);
assert.equal(count(testimonial.selectors.get('[data-content="testimonials"]').innerHTML, /class="testimonial-card ui-card"/g), 1);
assert.doesNotMatch(testimonial.selectors.get('[data-content="testimonials"]').innerHTML, /gallery-controls/);

console.log("Rendering tests passed: baseline, added items, removed items, and optional testimonials checked.");
