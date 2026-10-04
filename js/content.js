"use strict";

/* =============================================================
   CONTENT — fetches every JSON file in data/ and renders it.
   No visible string is written here; all copy comes from JSON so
   the site stays editable without touching code.
   ============================================================= */

const CONTENT_FILES = Object.freeze({
  meta: "00-meta.json",
  chrome: "01-chrome.json",
  hero: "02-hero.json",
  about: "03-about.json",
  numbers: "04-numbers.json",
  experience: "05-experience.json",
  practice: "06-practice.json",
  work: "07-work.json",
  edits: "08-edits.json",
  proof: "09-proof.json",
  stack: "10-stack.json",
  contact: "11-contact.json",
  ui: "12-ui.json",
  social: "social.json",
  notes: "notes.json"
});

let interfaceText = {};
let sectionIndex = new Map();

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const text = escapeHTML;
const attr = escapeHTML;
const list = (value) => (Array.isArray(value) ? value : []);
const records = (value) =>
  list(value).filter((item) => item && typeof item === "object" && !Array.isArray(item));
const hasText = (value) => typeof value === "string" && value.trim().length > 0;

const ui = (path) => {
  const value = path.split(".").reduce((current, key) => current?.[key], interfaceText);
  return hasText(value) ? value : "";
};

function setMeta(selector, value, attribute = "content") {
  const element = document.querySelector(selector);
  if (!element || !hasText(value)) return;
  element.setAttribute(attribute, value);
}

function setLabel(element, value) {
  if (!element || !hasText(value)) return;
  element.setAttribute("aria-label", value);
}

/* The live site loads every data file in one request, data/site.json
   (built by scripts/build-data.mjs). Previewing locally reads the
   individual files instead, so an edit shows up without a rebuild,
   and so does any host where the bundle is missing or incomplete. */
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]", ""];

async function loadBundle() {
  if (LOCAL_HOSTS.includes(window.location.hostname)) return null;
  try {
    const response = await fetch("data/site.json");
    if (!response.ok) return null;
    const bundle = await response.json();
    const files = bundle?.files || {};
    if (!Object.keys(CONTENT_FILES).every((key) => files[key] && typeof files[key] === "object")) return null;
    return { data: files, errors: [] };
  } catch {
    return null;
  }
}

async function loadPortfolioContent() {
  const bundled = await loadBundle();
  if (bundled) return bundled;

  const results = await Promise.all(
    Object.entries(CONTENT_FILES).map(async ([key, filename]) => {
      try {
        const response = await fetch(`data/${filename}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { key, filename, data: await response.json() };
      } catch (error) {
        console.error(`Could not load data/${filename}.`, error);
        return { key, filename, error };
      }
    })
  );

  return {
    data: Object.fromEntries(
      results.filter((result) => !result.error).map((result) => [result.key, result.data])
    ),
    errors: results.filter((result) => result.error)
  };
}

/* ---- Metadata -------------------------------------------------
   index.html ships static copies of these for crawlers that never
   run JS; this keeps data/00-meta.json authoritative at runtime.
---------------------------------------------------------------- */

function renderMeta(data) {
  if (!data) return;
  if (hasText(data.title)) document.title = data.title;
  setMeta('meta[name="description"]', data.description);
  setMeta('meta[name="theme-color"]', data.themeColor);
  setMeta('link[rel="canonical"]', data.canonicalUrl, "href");
  setMeta('meta[property="og:title"]', data.socialTitle || data.title);
  setMeta('meta[property="og:description"]', data.socialDescription || data.description);
  setMeta('meta[property="og:url"]', data.canonicalUrl);
  setMeta('meta[property="og:image"]', data.socialImage);
  setMeta('meta[property="og:image:alt"]', data.socialImageAlt);
  setMeta('meta[property="og:image:width"]', data.socialImageWidth);
  setMeta('meta[property="og:image:height"]', data.socialImageHeight);
}

/* ---- Icons ----------------------------------------------------
   Inline so the social rail costs no extra request and inherits
   currentColor for hover and focus states.
---------------------------------------------------------------- */

function socialIcon(name) {
  const icons = {
    github: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill-rule="evenodd" d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.9c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 0 1.6 1 1.6 1 .9 1.6 2.4 1.1 2.9.9.1-.7.4-1.1.7-1.3-2.2-.3-4.6-1.1-4.6-4.9 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.5 9.5 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.8-2.3 4.6-4.6 4.9.4.3.7.9.7 1.8V21c0 .3.2.6.7.5A10 10 0 0 0 12 2Z"/></svg>`,
    linkedin: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5.4 7.8H2.2V22h3.2V7.8ZM3.8 2A1.9 1.9 0 1 0 3.8 5.8 1.9 1.9 0 0 0 3.8 2ZM22 13.8c0-4.3-2.3-6.3-5.4-6.3a4.7 4.7 0 0 0-4.2 2.3v-2H9.2V22h3.2v-7c0-1.8.4-3.6 2.7-3.6 2.3 0 2.3 2.1 2.3 3.7V22h3.2l1.4-8.2Z"/></svg>`,
    tiktok: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14.5 3v11.1a4.6 4.6 0 1 1-3.8-4.5v3.1a1.7 1.7 0 1 0 .8 1.4V3h3Zm0 0c.4 2.2 1.7 3.6 4 4.1v3.1a8.2 8.2 0 0 1-4-1.8V3Z"/></svg>`,
    youtube: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21.4 6.5a2.7 2.7 0 0 0-1.9-1.9C17.8 4.2 12 4.2 12 4.2s-5.8 0-7.5.4a2.7 2.7 0 0 0-1.9 1.9A28 28 0 0 0 2.2 12c0 1.9.1 3.7.4 5.5a2.7 2.7 0 0 0 1.9 1.9c1.7.4 7.5.4 7.5.4s5.8 0 7.5-.4a2.7 2.7 0 0 0 1.9-1.9c.3-1.8.4-3.6.4-5.5s-.1-3.7-.4-5.5ZM10 15.4V8.6l5.8 3.4-5.8 3.4Z"/></svg>`,
    instagram: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill-rule="evenodd" d="M7.2 2h9.6A5.2 5.2 0 0 1 22 7.2v9.6a5.2 5.2 0 0 1-5.2 5.2H7.2A5.2 5.2 0 0 1 2 16.8V7.2A5.2 5.2 0 0 1 7.2 2Zm0 2A3.2 3.2 0 0 0 4 7.2v9.6A3.2 3.2 0 0 0 7.2 20h9.6a3.2 3.2 0 0 0 3.2-3.2V7.2A3.2 3.2 0 0 0 16.8 4H7.2Zm10.1 1.5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>`,
    facebook: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M13.8 22v-9h3l.5-3.5h-3.5V7.3c0-1 .3-1.8 1.8-1.8h1.9V2.4c-.3 0-1.5-.1-2.8-.1-2.8 0-4.7 1.7-4.7 4.8v2.4H7V13h3v9h3.8Z"/></svg>`
  };
  return icons[name] || "";
}

/* ---- Chrome: brand, nav, toggle ------------------------------ */

function renderTopChrome(data) {
  const root = document.querySelector('[data-chrome="top"]');
  if (!root) return;

  const brand = data.brand || {};
  const nav = data.nav || {};
  const links = records(nav.links);

  const navLinks = links
    .map(
      (link) =>
        `<li><a class="chrome-nav-link" href="${attr(link.href)}">${text(link.label)}</a></li>`
    )
    .join("");

  root.innerHTML = `
    <a class="brand" href="${attr(brand.href || "#hero")}" aria-label="${attr(brand.ariaLabel)}">
      <span class="brand-name">${text(brand.name)}</span>
    </a>
    <nav class="chrome-nav" aria-label="${attr(nav.ariaLabel)}">
      <ul class="chrome-nav-list">${navLinks}</ul>
      <button class="nav-toggle" id="nav-toggle" type="button"
        aria-controls="menu" aria-expanded="false" aria-label="${attr(nav.openLabel)}"
        data-close-label="${attr(nav.closeLabel)}">
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
      </button>
    </nav>`;
}

function renderSocialRail(data) {
  const root = document.querySelector('[data-chrome="socials"]');
  if (!root) return;

  const socials = data.socials || {};
  const links = records(socials.links);
  if (!links.length) {
    root.remove();
    return;
  }

  setLabel(root, socials.ariaLabel);
  root.innerHTML = links
    .map(
      (link) =>
        `<a href="${attr(link.href)}" target="_blank" rel="noopener noreferrer"
          aria-label="${attr(link.label)}">${socialIcon(link.icon)}</a>`
    )
    .join("");
}

function renderMenu(data) {
  const root = document.querySelector('[data-chrome="menu"]');
  if (!root) return;

  const nav = data.nav || {};
  const socials = data.socials || {};
  const links = records(nav.links);

  const menuLinks = links
    .map(
      (link, index) =>
        `<li><a class="menu-link" href="${attr(link.href)}">
          <span class="menu-index" aria-hidden="true">${text(String(index + 1).padStart(2, "0"))}</span>
          <span>${text(link.label)}</span>
        </a></li>`
    )
    .join("");

  const menuSocials = records(socials.links)
    .map(
      (link) =>
        `<a href="${attr(link.href)}" target="_blank" rel="noopener noreferrer">
          ${socialIcon(link.icon)}<span>${text(link.label)}</span>
        </a>`
    )
    .join("");

  setLabel(root, nav.menuAriaLabel);
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.innerHTML = `
    <ul class="menu-list">${menuLinks}</ul>
    <div class="menu-socials" aria-label="${attr(socials.ariaLabel)}">${menuSocials}</div>`;
}

/* ---- Scroll shell ---------------------------------------------
   Each section opens with its title. The dashed placeholder is
   temporary scaffolding and disappears as each real section is
   built.
---------------------------------------------------------------- */

/* Every section opens with the same heading row: the big title on
   the left and, where the section has somewhere to go, a "View all"
   link on the same line (both from data/01-chrome.json). The title
   text is repeated in data-text for the solid layer that wipes in
   over the outline as the section scrolls up (css/sections.css). */
function sectionTitle(id) {
  const section = sectionIndex.get(id);
  if (!section || !hasText(section.title)) return "";
  const link = section.viewAll || {};
  const more = hasText(link.href)
    ? `<a class="view-all" href="${attr(link.href)}" target="_blank" rel="noopener noreferrer">${text(link.label)}${ARROW}</a>`
    : "";
  return `<div class="section-head">
      <h2 class="section-title" data-text="${attr(section.title)}">${text(section.title)}</h2>
      ${more}
    </div>`;
}

/* Only fills sections that no renderer has claimed yet. Each one
   drops out as its phase lands. */
function renderSectionShell() {
  const pending = ui("phasePending");

  sectionIndex.forEach((section, id) => {
    const root = document.querySelector(`[data-section="${id}"]`);
    if (!root) return;

    setLabel(root, section.title);
    if (root.childElementCount) return;

    root.innerHTML = `
      <div class="section-inner">
        ${sectionTitle(id)}
        <p class="phase-pending">${text(pending)}</p>
      </div>`;
  });
}

/* ---- Preloader ------------------------------------------------
   Markup only; js/site.js runs the counter and the exit wipe.
---------------------------------------------------------------- */

function renderPreloader() {
  const root = document.querySelector('[data-chrome="preloader"]');
  if (!root) return;

  const config = interfaceText.preloader || {};
  setLabel(root, config.ariaLabel);
  root.dataset.fps = String(config.fps || 24);
  root.dataset.frames = String(config.frames || 36);
  root.dataset.duration = String(config.durationMs || 850);
  root.dataset.exit = String(config.exitMs || 650);
  root.dataset.maxWait = String(config.maxWaitMs || 2000);

  root.innerHTML = `
    <div class="preloader-inner">
      <div class="preloader-head">
        <span class="preloader-label">${text(config.label)}</span>
        <span class="preloader-timecode" id="preloader-timecode"></span>
      </div>
      <div class="preloader-bar">
        <span class="preloader-fill" id="preloader-fill"></span>
      </div>
    </div>`;
}

/* ---- Hero -----------------------------------------------------
   The portrait sits between the two lines of type. Until the
   cutout exists, a spec placeholder holds its exact position.
---------------------------------------------------------------- */

function portraitSlot(portrait) {
  const placeholder = portrait.placeholder || {};
  const specs = list(placeholder.specs)
    .map((spec) => `<li>${text(spec)}</li>`)
    .join("");

  return `<div class="portrait-slot">
      <p class="portrait-slot-label">${text(placeholder.label)}</p>
      <p class="portrait-slot-note">${text(placeholder.note)}</p>
      <ul class="portrait-slot-specs">${specs}</ul>
    </div>`;
}

/* Phones download the 640px WebP, larger screens the full one; the
   PNG is only for browsers without WebP. The sizes hint matches the
   layout: full width on phones, ~64% on tablets, ~30% on desktop. */
const PORTRAIT_SIZES = "(max-width: 767px) 100vw, (max-width: 1023px) 64vw, 30vw";

function portraitImage(portrait) {
  const set = records(portrait.sources)
    .filter((source) => hasText(source.src) && Number(source.width))
    .map((source) => `${source.src} ${Number(source.width)}w`)
    .join(", ");
  const sources = set
    ? `<source srcset="${attr(set)}" sizes="${PORTRAIT_SIZES}" type="image/webp">`
    : hasText(portrait.webp)
      ? `<source srcset="${attr(portrait.webp)}" type="image/webp">`
      : "";

  return `<picture>
      ${sources}
      <img src="${attr(portrait.src)}" alt="${attr(portrait.alt)}"
        width="${attr(portrait.width || "")}" height="${attr(portrait.height || "")}"
        fetchpriority="high" decoding="async">
    </picture>`;
}

function renderHero(data, chrome = {}) {
  const root = document.querySelector('[data-section="hero"]');
  if (!root || !data) return;

  const name = data.name || {};
  const lines = list(name.lines);
  const portrait = data.portrait || {};
  const ctas = data.ctas || {};
  const primary = ctas.primary || {};
  const secondary = ctas.secondary || {};
  const scroll = data.scrollHint || {};

  const nameLines = lines
    .map((line, index) => {
      const inner = `<span class="hero-line-inner" data-line="${index}" style="--line: ${index}">${text(line)}</span>`;
      /* Each line is drawn twice: the fill behind the portrait, an
         outline-only twin in front of it. Over the photo only the
         outline survives; elsewhere it sits on the fill unseen. On
         desktop only the second line crosses the photo, so the first
         line's twin is shown on phones only (css/hero.css). */
      if (index === 0) {
        return `<span class="hero-line hero-line-back">${inner}</span>
        <span class="hero-line hero-line-outline hero-line-outline-first" aria-hidden="true">${inner}</span>`;
      }
      return `<span class="hero-line hero-line-front">${inner}</span>
        <span class="hero-line hero-line-outline" aria-hidden="true">${inner}</span>`;
    })
    /* The newline is load-bearing: without whitespace between the
       block spans, the accessible name reads as one run-on word. */
    .join("\n");

  const portraitContent = hasText(portrait.src)
    ? portraitImage(portrait)
    : portraitSlot(portrait);

  root.setAttribute("aria-labelledby", "hero-title");
  root.innerHTML = `
    <div class="section-inner hero-inner">
      <div class="hero-stage">
        <div class="hero-lockup">
          <h1 class="hero-name" id="hero-title">${nameLines}</h1>
          <div class="hero-portrait">${portraitContent}</div>
        </div>
      </div>
      <div class="hero-foot">
        <p class="hero-intro">${text(data.intro)}</p>
        <div class="hero-actions">
          <a class="button button-primary" href="${attr(primary.href)}">${text(primary.label)}</a>
          <a class="button button-ghost" href="${attr(secondary.href)}">${text(secondary.label)}</a>
        </div>
        ${heroSocials(chrome.socials)}
      </div>
      ${hasText(scroll.href) ? `<a class="hero-scroll" href="${attr(scroll.href)}">${text(scroll.label)}</a>` : ""}
    </div>`;
}

/* Phones and tablets have no social rail, so the icons sit in the
   hero instead (hidden again once the rail appears, in CSS). */
function heroSocials(socials = {}) {
  const links = records(socials.links)
    .filter((link) => hasText(link.href))
    .map(
      (link) => `<a href="${attr(link.href)}" target="_blank" rel="noopener noreferrer"
        aria-label="${attr(link.label)}">${socialIcon(link.icon)}</a>`
    )
    .join("");
  return links ? `<nav class="hero-socials" aria-label="${attr(socials.ariaLabel)}">${links}</nav>` : "";
}

/* ---- About ----------------------------------------------------
   The heading and one short paragraph. Every word is its own span
   so the scroll scrub can sharpen them in one by one; {{braced}}
   runs carry the accent. Without the motion layer the markup
   simply reads as finished text.
---------------------------------------------------------------- */

function aboutWords(value) {
  if (!hasText(value)) return "";

  return String(value)
    .split(/(\{\{[^}]+\}\})/g)
    .map((segment) => {
      const accent = segment.match(/^\{\{([^}]+)\}\}$/);
      const className = accent ? "about-word is-accent" : "about-word";
      return (accent ? accent[1] : segment)
        .split(/(\s+)/)
        .map((token) => (token.trim() ? `<span class="${className}">${text(token)}</span>` : token))
        .join("");
    })
    .join("");
}

function renderAbout(data) {
  const root = document.querySelector('[data-section="about"]');
  if (!root || !data) return;

  root.classList.add("section-about");
  root.innerHTML = `
    <div class="section-inner about">
      ${sectionTitle("about")}
      <p class="about-text">${aboutWords(data.text)}</p>
    </div>`;
}

/* ---- Numbers --------------------------------------------------
   Final values are rendered server-side-equivalent, in the markup.
   The count-up animates down to zero and back up only when the
   motion layer is active, so these read correctly without it.
---------------------------------------------------------------- */

/* Small line icons for the stat cards, drawn here rather than loaded
   from an icon library. Keyed by "icon" in data/04-numbers.json. */
const STAT_ICONS = {
  views: '<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>',
  projects: '<path d="M8 1.75L14.25 5 8 8.25 1.75 5z"/><path d="M1.75 8L8 11.25 14.25 8"/><path d="M1.75 11L8 14.25 14.25 11"/>',
  years: '<rect x="2" y="3" width="12" height="11" rx="1"/><path d="M2 6.5h12M5.25 1.5v3M10.75 1.5v3"/>',
  certificate: '<circle cx="8" cy="6" r="4"/><path d="M5.5 9.25L4.5 14.5 8 12.75l3.5 1.75-1-5.25"/>'
};

function statIcon(name) {
  const paths = STAT_ICONS[name];
  if (!paths) return "";
  return `<svg class="number-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round">${paths}</svg>`;
}

/* ---- Live audience: the static version ---------------------------
   The per-platform table under the cards, drawn from the documented
   figures in data/social.json. This is what shows when the live
   stats can't load (or js/live-stats.js is removed): honest numbers,
   labelled "documented". js/live-stats.js fills the same markup with
   live numbers when /api/stats answers.
---------------------------------------------------------------- */

const compactNumber = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function liveValue(value, noValue) {
  if (!Number.isFinite(value)) return `<span class="live-value">${text(noValue)}</span>`;
  return `<data class="live-value" value="${attr(value)}" title="${attr(value.toLocaleString("en"))}">${text(compactNumber.format(value))}</data>`;
}

function renderLiveFallback(social) {
  const display = social?.display;
  if (!display) return "";
  const columns = display.columns || {};
  const names = display.names || {};
  const noValue = display.noValue || "";

  const rows = list(social.showPlatforms)
    .map((name) => [name, social.platforms?.[name]])
    .filter(([, platform]) => Number.isFinite(platform?.documented?.views))
    .map(
      ([name, platform]) => `
        <tr class="live-row" data-platform="${attr(name)}">
          <th scope="row" class="live-platform">
            <a class="live-platform-link" href="${attr(platform.url)}" target="_blank" rel="noopener noreferrer">
              <span class="live-icon">${socialIcon(name)}</span>
              <span class="live-name">${text(names[name] || name)}</span>
              <span class="live-handle">${text(platform.handle)}</span>
            </a>
          </th>
          <td class="live-cell" data-field="followers" data-label="${attr(columns.followers)}">${liveValue(null, noValue)}</td>
          <td class="live-cell" data-field="views" data-label="${attr(columns.views)}">${liveValue(platform.documented.views, noValue)}</td>
          <td class="live-cell" data-field="posts" data-label="${attr(columns.posts)}">${liveValue(null, noValue)}</td>
          <td class="live-cell live-trend" data-field="trend" aria-hidden="true"></td>
        </tr>`
    )
    .join("");
  if (!rows) return "";

  const methods = list(social.showPlatforms)
    .map((name) => [name, social.platforms?.[name]?.documented])
    .filter(([, documented]) => Number.isFinite(documented?.views))
    .map(([name, documented]) => `<li><strong>${text(names[name] || name)}</strong> ${text(`${compactNumber.format(documented.views)} (${documented.window})`)}</li>`)
    .join("");

  return `
    <div class="live" data-live-stats>
      <div class="live-head">
        <p class="live-status is-documented" data-live-status>
          <span class="live-dot" aria-hidden="true"></span>
          <span data-live-status-text>${text(display.status?.documented)}</span>
        </p>
        <details class="live-methods">
          <summary>${text(display.methods?.summary)}</summary>
          <div class="live-methods-body" data-live-methods>
            <ul>${methods}</ul>
            <p>${text(social.baseline?.note)}</p>
          </div>
        </details>
      </div>
      <table class="live-table">
        <caption class="sr-only">${text(display.caption)}</caption>
        <thead>
          <tr>
            <th scope="col">${text(columns.platform)}</th>
            <th scope="col">${text(columns.followers)}</th>
            <th scope="col">${text(columns.views)}</th>
            <th scope="col">${text(columns.posts)}</th>
            <th scope="col" class="live-trend-head"><span class="sr-only">${text(columns.trend)}</span></th>
          </tr>
        </thead>
        <tbody data-live-rows>${rows}</tbody>
        <tfoot>
          <tr class="live-row live-row-total" data-platform="total">
            <th scope="row" class="live-platform"><span class="live-name">${text(display.total)}</span></th>
            <td class="live-cell" data-field="followers" data-label="${attr(columns.followers)}">${liveValue(social.fallback?.followersTotal ?? null, noValue)}</td>
            <td class="live-cell" data-field="views" data-label="${attr(columns.views)}">${liveValue(social.fallback?.viewsTotal ?? null, noValue)}</td>
            <td class="live-cell" data-field="posts" data-label="${attr(columns.posts)}">${liveValue(null, noValue)}</td>
            <td class="live-cell live-trend" aria-hidden="true"></td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

function renderNumbers(data, social) {
  const root = document.querySelector('[data-section="numbers"]');
  if (!root || !data) return;

  const items = records(data.items)
    .map(
      (item) => `
      <div class="number"${hasText(item.live) ? ` data-live="${attr(item.live)}"` : ""}>
        ${statIcon(item.icon)}
        <p class="number-figure">
          <span class="number-value" data-count-to="${attr(item.value)}">${text(item.value)}</span><span class="number-suffix">${text(item.suffix)}</span>
        </p>
        <h3 class="number-label">${text(item.label)}</h3>
        <p class="number-detail">${text(item.detail)}</p>
      </div>`
    )
    .join("");

  root.innerHTML = `
    <div class="section-inner">
      ${sectionTitle("numbers")}
      <div class="numbers">${items}</div>
      ${renderLiveFallback(social)}
    </div>`;
}

/* ---- Experience -----------------------------------------------
   Roles are positioned on one shared axis so the bars read as clips
   on a timeline. Geometry is computed here, not in the motion layer,
   so the tracks are correct even with JS animation disabled.
---------------------------------------------------------------- */

function monthIndex(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  return Number(match[1]) * 12 + (Number(match[2]) - 1);
}

function trackGeometry(item, axisStart, axisEnd, today) {
  const span = axisEnd - axisStart;
  if (span <= 0) return null;

  const start = monthIndex(item.start);
  const rawEnd = item.end === "present" ? Math.min(today, axisEnd) : monthIndex(item.end);
  if (start === null || rawEnd === null) return null;

  const clamp = (value) => Math.min(Math.max(value, 0), 1);
  const left = clamp((start - axisStart) / span);
  const right = clamp((rawEnd - axisStart) / span);
  /* A role shorter than the axis resolution still needs to be seen. */
  const width = Math.max(right - left, 0.02);

  return { left: left * 100, width: Math.min(width, 1 - left) * 100 };
}

function axisTicks(axisStart, axisEnd) {
  const span = axisEnd - axisStart;
  const firstYear = Math.floor(axisStart / 12);
  const lastYear = Math.floor(axisEnd / 12);
  const ticks = [];

  for (let year = firstYear; year <= lastYear; year += 1) {
    const position = ((year * 12 - axisStart) / span) * 100;
    if (position < 0 || position > 100) continue;
    ticks.push(
      `<span class="track-axis-tick" style="left:${position.toFixed(2)}%">${text(year)}</span>`
    );
  }

  return ticks.join("");
}

/* "2022" over "Present": the short year column used on phones. */
function trackYears(item, presentLabel) {
  const start = String(item.start || "").slice(0, 4);
  const end = item.end === "present" ? presentLabel : String(item.end || "").slice(0, 4);
  if (!/^\d{4}$/.test(start)) return "";
  const parts = [start, end].filter((part, index) => hasText(part) && (index === 0 || part !== start));
  return `<p class="track-years" aria-hidden="true">${parts.map((part) => `<span>${text(part)}</span>`).join("")}</p>`;
}

function trackRow(item, geometry, presentLabel = "") {
  const link = item.link && typeof item.link === "object" ? item.link : null;
  /* A TODO is rendered as its own flagged note rather than restyling
     the summary, which may well be real copy already. */
  const todo = hasText(item.TODO) ? `<p class="track-todo">${text(item.TODO)}</p>` : "";
  const bar = geometry
    ? `<span class="track-clip-bar" style="left:${geometry.left.toFixed(2)}%;width:${geometry.width.toFixed(2)}%"></span>`
    : "";

  const body = `
    ${trackYears(item, presentLabel)}
    <p class="track-period">${text(item.period)}</p>
    <div class="track-identity">
      <h3 class="track-role">${text(item.role)}</h3>
      <p class="track-org">${text(item.organization)}</p>
    </div>
    <div class="track-media">
      <div class="track-clip">${bar}</div>
      <div class="track-detail"><div>
        <p class="track-summary">${text(item.summary)}</p>
        ${todo}
        ${link ? `<span class="track-link">${text(link.label)}</span>` : ""}
      </div></div>
    </div>`;

  /* A linked role is a real anchor; an unlinked one is not pretending
     to be interactive. */
  return link && hasText(link.href)
    ? `<li class="track"><a class="track-row" href="${attr(link.href)}"
        target="_blank" rel="noopener noreferrer">${body}</a></li>`
    : `<li class="track"><div class="track-row">${body}</div></li>`;
}

function renderExperience(data) {
  const root = document.querySelector('[data-section="experience"]');
  if (!root || !data) return;

  const axis = data.axis || {};
  const axisStart = monthIndex(axis.start);
  const axisEnd = monthIndex(axis.end);
  const now = new Date();
  const today = now.getFullYear() * 12 + now.getMonth();

  const items = records(data.items);
  const rows = items
    .map((item) =>
      trackRow(
        item,
        axisStart === null || axisEnd === null
          ? null
          : trackGeometry(item, axisStart, axisEnd, today),
        axis.presentLabel
      )
    )
    .join("");

  const ticks =
    axisStart === null || axisEnd === null
      ? ""
      : `<div class="track-axis" aria-hidden="true">
          <div class="track-axis-ticks">${axisTicks(axisStart, axisEnd)}</div>
        </div>`;

  root.innerHTML = `
    <div class="section-inner">
      ${sectionTitle("experience")}
      ${ticks}
      <ul class="tracks">${rows}</ul>
    </div>`;
}

/* ---- Shared bits for the work sections ------------------------- */

const pad2 = (value) => String(value).padStart(2, "0");

function tagList(tags, className) {
  const items = list(tags).filter(hasText);
  if (!items.length) return "";
  return `<ul class="${className}">${items.map((tag) => `<li>${text(tag)}</li>`).join("")}</ul>`;
}

/* image.srcset (optional) is a list of { src, width } so phones can
   take a smaller file; sizes says how wide the image is drawn. */
function picture(image, { className = "", eager = false, sizes = "" } = {}) {
  if (!hasText(image?.src)) return "";
  const size = image.width && image.height ? ` width="${attr(image.width)}" height="${attr(image.height)}"` : "";
  const set = records(image.srcset)
    .filter((source) => hasText(source.src) && Number(source.width))
    .map((source) => `${source.src} ${Number(source.width)}w`)
    .join(", ");
  const responsive = set && sizes ? ` srcset="${attr(set)}" sizes="${attr(sizes)}"` : "";
  return `<img class="${attr(className)}" src="${attr(image.src)}" alt="${attr(image.alt || "")}"${size}${responsive}
    loading="${eager ? "eager" : "lazy"}" decoding="async">`;
}

/* A small arrow drawn in SVG, so no glyph lives in the code. */
const ARROW = `<svg class="icon-arrow" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4.5 11.5l7-7M6 4.5h5.5V10" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;

/* ---- Services ----------------------------------------------------
   The offers, as cards that pin one over the next as the page
   scrolls (the shade layer is what js/motion.js darkens on the card
   underneath). Each card: what it is, the audience behind it where
   that is the point, what the client gets, the proof, and a button
   that jumps to the contact form with this service preselected.
---------------------------------------------------------------- */

function serviceAudience(audience) {
  if (!audience || !hasText(audience.total)) return "";
  const platforms = records(audience.platforms)
    .filter((platform) => hasText(platform.name) && hasText(platform.value))
    .map((platform) => `<li><strong>${text(platform.value)}</strong> ${text(platform.name)}</li>`)
    .join("");
  return `
    <div class="service-audience">
      <p class="service-audience-total"><strong>${text(audience.total)}</strong> ${text(audience.label)}${hasText(audience.asOf) ? ` <span>${text(audience.asOf)}</span>` : ""}</p>
      ${platforms ? `<ul class="service-platforms">${platforms}</ul>` : ""}
    </div>`;
}

function renderPractice(data) {
  const root = document.querySelector('[data-section="services"]');
  if (!root || !data) return;

  const cta = data.cta || {};
  const cards = records(data.items)
    .filter((item) => hasText(item.title))
    .map((item, index) => {
      const includes = list(item.includes).filter(hasText);
      return `
        <li class="practice-card" style="--i: ${index}">
          <article class="practice-card-inner">
            <div class="practice-copy">
              <span class="practice-index" aria-hidden="true">${pad2(index + 1)}</span>
              <h3 class="practice-title">${text(item.title)}</h3>
              <p class="practice-text">${text(item.text)}</p>
              ${serviceAudience(item.audience)}
              ${includes.length
                ? `<div class="service-block">
                    <p class="service-label">${text(data.includesLabel)}</p>
                    <ul class="service-includes">${includes.map((line) => `<li>${text(line)}</li>`).join("")}</ul>
                    ${hasText(item.addon) ? `<p class="service-addon">${text(item.addon)}</p>` : ""}
                  </div>`
                : ""}
              ${hasText(item.proof)
                ? `<p class="service-proof"><span class="service-label">${text(data.proofLabel)}</span> ${text(item.proof)}</p>`
                : ""}
              ${hasText(cta.href)
                ? `<a class="button button-primary service-cta" href="${attr(cta.href)}" data-service="${attr(item.service || "")}">${text(cta.label)}</a>`
                : ""}
            </div>
            <div class="practice-media">${picture(item.image)}</div>
            <span class="practice-shade" aria-hidden="true"></span>
          </article>
        </li>`;
    })
    .join("");

  root.innerHTML = `
    <div class="section-inner">
      ${sectionTitle("services")}
      <ol class="practice-stack">${cards}</ol>
    </div>`;
}

/* ---- Selected work -----------------------------------------------
   Clean full-width rows with the project name large. On a desktop
   pointer, hovering a row brings in one shared 3D preview card at
   the right of the list (js/interactions.js reads data-preview). On
   phones and touch screens the rows stay text-only, with no preview.
---------------------------------------------------------------- */

function workRow(item, index, labels) {
  const href = hasText(item.href) ? item.href : "";
  const title = href
    ? `<a class="work-link" href="${attr(href)}" target="_blank" rel="noopener noreferrer">${text(item.title)}</a>`
    : text(item.title);
  const code = hasText(item.code)
    ? `<a class="work-code" href="${attr(item.code)}" target="_blank" rel="noopener noreferrer">${text(labels.code)}${ARROW}</a>`
    : "";
  const preview = hasText(item.image?.src) ? ` data-preview="${attr(item.image.src)}"` : "";

  return `
    <li class="work-row${href ? " has-link" : ""}"${preview}>
      <span class="work-index" aria-hidden="true">${pad2(index + 1)}</span>
      <div class="work-main">
        <h3 class="work-title">${title}</h3>
        <p class="work-summary">${text(item.summary)}</p>
        <div class="work-meta">
          ${tagList(item.tags, "work-tags")}
          ${code}
          ${href ? `<span class="work-arrow" aria-hidden="true">${ARROW}</span>` : ""}
        </div>
      </div>
    </li>`;
}

function renderWork(data) {
  const root = document.querySelector('[data-section="work"]');
  if (!root || !data) return;

  const labels = { code: data.codeLabel };
  const rows = records(data.items)
    .filter((item) => hasText(item.title))
    .map((item, index) => workRow(item, index, labels))
    .join("");

  root.innerHTML = `
    <div class="section-inner">
      ${sectionTitle("work")}
      <div class="work-stage">
        <ul class="work-list">${rows}</ul>
        <div class="work-preview" aria-hidden="true">
          <div class="work-preview-card"><img alt="" decoding="async"></div>
        </div>
      </div>
    </div>`;
}

/* ---- Selected edits ----------------------------------------------
   Two tabs over the same card layout: "Edits" (each card links to
   its post, with the reach as a badge) and "AI Hooks" (the Google
   Flow product hooks; each card opens its video in the lightbox).
   On phones each tab is one swipeable row with position dots; on
   wider screens it is a grid. Videos are only attached (and
   downloaded) on desktop hover or when a hook is opened, by
   js/interactions.js.
---------------------------------------------------------------- */

function editMedia(item) {
  const video = hasText(item.video) ? ` data-video="${attr(item.video)}"` : "";
  return `
    <span class="edit-media"${video}>
      ${picture({ src: item.image, alt: "", width: item.imageWidth, height: item.imageHeight })}
      ${hasText(item.badge) ? `<span class="edit-badge">${text(item.badge)}</span>` : ""}
    </span>`;
}

function editMeta(title, platform) {
  return `
    <span class="edit-meta">
      <span class="edit-title">${text(title)}</span>
      <span class="edit-platform">${text(platform)}</span>
    </span>`;
}

function editPanel(id, cards, selected) {
  return `
    <div class="edits-panel" id="edits-panel-${id}" role="tabpanel" aria-labelledby="edits-tab-${id}"${selected ? "" : " hidden"}>
      <ul class="edits-grid">${cards}</ul>
      <div class="edits-dots" aria-hidden="true"></div>
    </div>`;
}

function renderEdits(data) {
  const root = document.querySelector('[data-section="edits"]');
  if (!root || !data) return;

  const editItems = records(data.items).filter((item) => hasText(item.title) && hasText(item.href));
  const edits = editItems
    .map((item) => {
      const label = [item.title, item.badge, item.platform].filter(hasText).join(", ");
      return `
        <li class="edit-card">
          <a class="edit-link" href="${attr(item.href)}" target="_blank" rel="noopener noreferrer" aria-label="${attr(label)}">
            ${editMedia(item)}
            ${editMeta(item.title, item.platform)}
          </a>
        </li>`;
    })
    .join("");

  const hookData = data.hooks || {};
  const hookItems = records(hookData.items).filter((item) => hasText(item.title) && hasText(item.video));
  const hooks = hookItems
    .map((item) => {
      const label = [item.title, item.badge, hookData.platform, hookData.playLabel].filter(hasText).join(", ");
      return `
        <li class="edit-card">
          <button class="edit-link" type="button" aria-haspopup="dialog" aria-label="${attr(label)}"
            data-lightbox-video="${attr(item.video)}" data-lightbox-alt="${attr(item.alt)}">
            ${editMedia(item)}
            ${editMeta(item.title, hookData.platform)}
          </button>
        </li>`;
    })
    .join("");

  const tabs = data.tabs || {};
  const tab = (id, label, count, selected) => `
    <button class="edits-tab" type="button" role="tab" id="edits-tab-${id}"
      aria-controls="edits-panel-${id}" aria-selected="${selected}" tabindex="${selected ? 0 : -1}">
      ${text(label)}<span class="edits-tab-count">${count}</span>
    </button>`;

  const tabList = hooks
    ? `<div class="edits-tabs" role="tablist" aria-label="${attr(tabs.label)}">
        ${tab("edits", tabs.edits, editItems.length, true)}
        ${tab("hooks", tabs.hooks, hookItems.length, false)}
      </div>`
    : "";

  root.innerHTML = `
    <div class="section-inner">
      ${sectionTitle("edits")}
      ${tabList}
      ${editPanel("edits", edits, true)}
      ${hooks ? editPanel("hooks", hooks, false) : ""}
    </div>`;
}

/* ---- Proof ------------------------------------------------------
   Analytics as hairline rows (big number, what it is, the
   screenshot), certificates as three tilting cards. Every item is a
   button that opens the full-size image in the lightbox
   (js/interactions.js); the page itself only loads small WebPs.
---------------------------------------------------------------- */

function lightboxAttrs(item) {
  const caption = hasText(item.caption) ? ` data-lightbox-caption="${attr(item.caption)}"` : "";
  return `type="button" aria-haspopup="dialog" data-lightbox="${attr(item.full)}" data-lightbox-alt="${attr(item.alt)}"${caption}`;
}

function renderProof(data) {
  const root = document.querySelector('[data-section="proof"]');
  if (!root || !data) return;

  root.classList.add("section-proof");
  const analytics = data.analytics || {};
  const certifications = data.certifications || {};
  const lightbox = data.lightbox || {};

  const carousel = analytics.carousel || {};
  const slideItems = records(analytics.items).filter((item) => hasText(item.value) && hasText(item.full));
  const total = slideItems.length;
  const slideLabel = (index) =>
    String(carousel.slide || "")
      .replace("{index}", String(index + 1))
      .replace("{total}", String(total));

  /* Each slide is a screenshot card plus its caption. Without
     js/interactions.js this is a plain swipeable row; with it, the
     row becomes the 3D carousel (css/closing.css, .is-3d). */
  const slides = slideItems
    .map(
      (item, index) => `
        <div class="proof-slide" role="group" aria-roledescription="slide"
          aria-label="${attr(slideLabel(index))}" data-index="${index}">
          <button class="proof-card" ${lightboxAttrs(item)}>
            <span class="proof-shot">${picture({ ...item.thumb, alt: item.alt }, { sizes: "(max-width: 767px) 90vw, 1280px" })}</span>
          </button>
          <div class="proof-caption">
            <span class="proof-value">${text(item.value)}</span>
            <span class="proof-label">${text(item.label)}</span>
          </div>
        </div>`
    )
    .join("");

  const chevron = (direction) =>
    `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="${direction === "previous" ? "M10 3.5L5.5 8l4.5 4.5" : "M6 3.5L10.5 8 6 12.5"}" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;

  /* Certificates use the same carousel markup as the analytics, but
     js/interactions.js only turns it into a carousel on phones (see
     data-carousel-media); wider screens show the three cards side by
     side. */
  const certCarousel = certifications.carousel || {};
  const certItems = records(certifications.items).filter((item) => hasText(item.title) && hasText(item.full));
  const certLabel = (index) =>
    String(certCarousel.slide || "")
      .replace("{index}", String(index + 1))
      .replace("{total}", String(certItems.length));
  const certs = certItems
    .map(
      (item, index) => `
        <div class="proof-slide" role="group" aria-roledescription="slide"
          aria-label="${attr(certLabel(index))}" data-index="${index}">
          <button class="cert-card" ${lightboxAttrs(item)}>
            <span class="cert-media">${picture({ ...item.thumb, alt: "" })}</span>
            <span class="cert-title">${text(item.title)}</span>
            <span class="cert-meta"><span>${text(item.issuer)}</span><span>${text(item.year)}</span></span>
          </button>
          ${hasText(item.link?.href)
            ? `<a class="cert-link" href="${attr(item.link.href)}" target="_blank" rel="noopener noreferrer">${text(item.link.label)}${ARROW}</a>`
            : ""}
        </div>`
    )
    .join("");

  root.innerHTML = `
    <div class="section-inner">
      ${sectionTitle("proof")}
      <div class="proof-block">
        <div class="proof-head">
          <h3 class="proof-heading">${text(analytics.heading)}</h3>
          <p class="proof-intro">${text(analytics.intro)}</p>
        </div>
        <div class="proof-carousel" role="region" aria-roledescription="carousel" aria-label="${attr(carousel.label)}">
          <div class="proof-track">${slides}</div>
          <div class="proof-controls">
            <button class="proof-arrow" type="button" data-step="-1" aria-label="${attr(carousel.previous)}">${chevron("previous")}</button>
            <span class="proof-count" aria-hidden="true"><span class="proof-current">${pad2(1)}</span><span class="proof-total">${pad2(total)}</span></span>
            <button class="proof-arrow" type="button" data-step="1" aria-label="${attr(carousel.next)}">${chevron("next")}</button>
          </div>
        </div>
      </div>
      <div class="proof-block">
        <div class="proof-head">
          <h3 class="proof-heading">${text(certifications.heading)}</h3>
          ${hasText(certifications.viewAll?.href)
            ? `<a class="view-all" href="${attr(certifications.viewAll.href)}" target="_blank" rel="noopener noreferrer">${text(certifications.viewAll.label)}${ARROW}</a>`
            : ""}
        </div>
        <div class="proof-carousel cert-carousel" data-carousel-media="(max-width: 767px)"
          role="region" aria-roledescription="carousel" aria-label="${attr(certCarousel.label)}">
          <div class="proof-track cert-grid">${certs}</div>
          <div class="proof-controls">
            <button class="proof-arrow" type="button" data-step="-1" aria-label="${attr(certCarousel.previous)}">${chevron("previous")}</button>
            <span class="proof-count" aria-hidden="true"><span class="proof-current">${pad2(1)}</span><span class="proof-total">${pad2(certItems.length)}</span></span>
            <button class="proof-arrow" type="button" data-step="1" aria-label="${attr(certCarousel.next)}">${chevron("next")}</button>
          </div>
        </div>
      </div>
    </div>
    <dialog class="lightbox" aria-label="${attr(lightbox.label)}">
      <button class="lightbox-close" type="button" aria-label="${attr(lightbox.close)}">
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>
      </button>
      <img alt="" decoding="async">
      <video controls playsinline preload="none" hidden></video>
      <p class="lightbox-caption" hidden></p>
    </dialog>`;
}

/* ---- Stack + GitHub ---------------------------------------------
   Skills as quiet pills in labelled rows. The contribution graph is
   an empty shell here; js/interactions.js draws it from the saved
   snapshot, and leaves it hidden if that file is missing.
---------------------------------------------------------------- */

function renderStack(data) {
  const root = document.querySelector('[data-section="stack"]');
  if (!root || !data) return;

  /* Items with an icon render as logos; plain strings as text tags
     (for skills that have no logo). */
  const stackItems = (items) => {
    const logos = records(items)
      .filter((item) => hasText(item.name) && hasText(item.icon))
      .map((item) => {
        /* Only a plain hex colour reaches the style attribute. */
        const brand = /^#[0-9a-f]{3,8}$/i.test(item.color || "") ? ` style="--brand: ${item.color}"` : "";
        return `
          <li class="stack-logo${item.mono ? " is-mono" : ""}"${brand}>
            <span class="stack-logo-icon"><img src="${attr(item.icon)}" alt="" width="40" height="40" loading="lazy" decoding="async"></span>
            <span class="stack-logo-name">${text(item.name)}</span>
          </li>`;
      })
      .join("");
    const tags = list(items).filter(hasText);
    return `${logos ? `<ul class="stack-logos">${logos}</ul>` : ""}${tagList(tags, "stack-pills")}`;
  };

  const groups = records(data.groups)
    .filter((group) => hasText(group.label))
    .map(
      (group) => `
        <div class="stack-group">
          <dt>${text(group.label)}</dt>
          <dd>${stackItems(group.items)}</dd>
        </div>`
    )
    .join("");

  /* The GitHub card is an empty frame here: js/interactions.js fills
     it from the snapshot (month ruler, weekday labels, the graph, a
     hover playhead with a tooltip, three stats), and leaves it hidden
     if the snapshot is missing. */
  const github = data.github || {};
  const link = github.link || {};

  root.innerHTML = `
    <div class="section-inner">
      ${sectionTitle("stack")}
      <dl class="stack-groups">${groups}</dl>
      <div class="github" data-snapshot="${attr(github.snapshot)}"
        data-labels="${attr(JSON.stringify({ tooltip: github.tooltip || {}, stats: github.stats || {} }))}">
        <div class="github-head">
          <h3 class="proof-heading">${text(github.heading)}</h3>
          ${hasText(link.href) ? `<a class="text-link" href="${attr(link.href)}" target="_blank" rel="noopener noreferrer">${text(link.label)}${ARROW}</a>` : ""}
        </div>
        <div class="github-scroll" hidden>
          <div class="gh-ruler" aria-hidden="true"></div>
          <div class="gh-body">
            <div class="gh-days" aria-hidden="true"></div>
            <div class="gh-grid-wrap">
              <div class="github-graph" role="img" aria-label="${attr(github.graphLabel)}"></div>
              <span class="gh-playhead" aria-hidden="true"></span>
              <span class="gh-tip" aria-hidden="true"></span>
            </div>
          </div>
          <dl class="gh-stats"></dl>
        </div>
      </div>
    </div>`;
}

/* ---- Contact + footer -------------------------------------------- */

/* The project brief form. js/interactions.js handles sending: to the
   form service when an access key is set, otherwise by opening the
   visitor's email app with the brief filled in. Every label and
   message comes from data/11-contact.json. */
function projectForm(form, address) {
  if (!form || !hasText(form.submit)) return "";
  const options = records(form.options)
    .filter((option) => hasText(option.value) && hasText(option.label))
    .map((option) => `<option value="${attr(option.value)}">${text(option.label)}</option>`)
    .join("");
  const messages = {
    sending: form.sending, sent: form.sent, mailtoSent: form.mailtoSent, failed: form.failed,
    subject: form.subject, name: form.name, replyTo: form.replyTo, service: form.service,
    deadline: form.deadline, message: form.message
  };

  return `
    <form class="brief" id="project-brief" novalidate
      data-endpoint="${attr(form.endpoint || "")}" data-key="${attr(form.accessKey || "")}"
      data-address="${attr(address || "")}" data-messages="${attr(JSON.stringify(messages))}">
      <h3 class="brief-heading">${text(form.heading)}</h3>
      <div class="brief-grid">
        <label class="brief-field">
          <span>${text(form.name)}</span>
          <input name="name" type="text" autocomplete="name" required>
        </label>
        <label class="brief-field">
          <span>${text(form.replyTo)}</span>
          <input name="email" type="email" autocomplete="email" required>
        </label>
        <label class="brief-field">
          <span>${text(form.service)}</span>
          <select name="service">${options}</select>
        </label>
        <label class="brief-field">
          <span>${text(form.deadline)}</span>
          <input name="deadline" type="text">
        </label>
        <label class="brief-field brief-wide">
          <span>${text(form.message)}</span>
          <textarea name="message" rows="5" required placeholder="${attr(form.messageHint || "")}"></textarea>
        </label>
      </div>
      <div class="brief-foot">
        <button class="button button-primary" type="submit">${text(form.submit)}</button>
        <p class="brief-status" role="status" aria-live="polite"></p>
      </div>
    </form>`;
}

function renderContact(data) {
  const root = document.querySelector('[data-section="contact"]');
  if (!root || !data) return;

  root.classList.add("section-contact");
  const email = data.email || {};
  const mailto = hasText(email.address)
    ? `mailto:${email.address}${hasText(email.subject) ? `?subject=${encodeURIComponent(email.subject)}` : ""}`
    : "";

  /* One label/value row. The value is plain text, the email address,
     a single link, a list of links, or the live local time. */
  const rowValue = (row) => {
    if (row.email && mailto) {
      return `<a class="contact-value-link" href="${attr(mailto)}">${text(email.address)}</a>`;
    }
    if (row.link && hasText(row.link.href)) {
      return `<a class="contact-value-link" href="${attr(row.link.href)}" target="_blank" rel="noopener">${text(row.link.label)}${ARROW}</a>`;
    }
    const links = records(row.links).filter((link) => hasText(link.href));
    if (links.length) {
      const items = links
        .map((link) => `<li><a href="${attr(link.href)}" target="_blank" rel="noopener noreferrer">${text(link.label)}</a></li>`)
        .join("");
      return `<ul class="contact-links">${items}</ul>`;
    }
    if (hasText(row.timeZone)) {
      return `<span class="contact-time" data-time-zone="${attr(row.timeZone)}" data-time-label="${attr(row.timeLabel || "")}"></span>`;
    }
    return text(row.value);
  };

  const rows = records(data.rows)
    .filter((row) => hasText(row.label))
    .map((row) => `<div class="contact-row"><dt>${text(row.label)}</dt><dd>${rowValue(row)}</dd></div>`)
    .join("");

  const pair = records(data.pair)
    .filter((row) => hasText(row.label))
    .map((row) => `<div class="contact-cell"><dt>${text(row.label)}</dt><dd>${rowValue(row)}</dd></div>`)
    .join("");

  /* Email is always there; the booking button appears once a link is
     set in data/11-contact.json. */
  const booking = data.booking || {};
  const buttons = [
    mailto ? `<a class="button button-ghost" href="${attr(mailto)}">${text(email.label)}</a>` : "",
    hasText(booking.href)
      ? `<a class="button button-ghost" href="${attr(booking.href)}" target="_blank" rel="noopener noreferrer">${text(booking.label)}</a>`
      : ""
  ].join("");
  const action = buttons.trim() ? `<div class="contact-actions">${buttons}</div>` : "";

  root.innerHTML = `
    <div class="section-inner contact">
      ${sectionTitle("contact")}
      <p class="contact-statement">${aboutWords(data.statement)}</p>
      ${projectForm(data.form, email.address)}
      ${action}
      ${rows ? `<dl class="contact-list">${rows}</dl>` : ""}
      ${pair ? `<dl class="contact-pair">${pair}</dl>` : ""}
    </div>`;

  renderFooter(data.footer);
}

/* The copyright line and a way back to the top. */
/* ---- Visitor notes -----------------------------------------------
   The shell only: title, intro, an empty list and the form, hidden.
   js/notes.js loads the approved notes from /api/feedback and shows
   the form once it knows the API is there, so without it (or with
   the API down) nobody gets a form that can't send.
---------------------------------------------------------------- */

function renderNotes(data) {
  const root = document.querySelector('[data-section="notes"]');
  if (!root || !data) return;
  const form = data.form || {};

  root.innerHTML = `
    <div class="section-inner">
      ${sectionTitle("notes")}
      <p class="notes-intro">${text(data.intro)}</p>
      <div class="notes" data-notes hidden>
        <ul class="notes-list" data-notes-list aria-label="${attr(data.listLabel)}"></ul>
        <p class="notes-empty" data-notes-empty hidden>${text(data.empty)}</p>
      </div>
      <form class="brief notes-form" data-notes-form novalidate hidden>
        <h3 class="brief-heading">${text(form.heading)}</h3>
        <div class="brief-grid">
          <label class="brief-field">
            <span>${text(form.name)}</span>
            <input name="name" type="text" autocomplete="name" required minlength="2" maxlength="60" placeholder="${attr(form.namePlaceholder)}">
          </label>
          <label class="brief-field">
            <span>${text(form.role)}</span>
            <input name="role" type="text" autocomplete="organization-title" maxlength="80" placeholder="${attr(form.rolePlaceholder)}">
          </label>
          <label class="brief-field brief-wide">
            <span>${text(form.message)}</span>
            <textarea name="message" required minlength="10" maxlength="500" placeholder="${attr(form.messagePlaceholder)}"></textarea>
            <small class="notes-counter" data-notes-counter aria-hidden="true"></small>
          </label>
          <label class="notes-trap" aria-hidden="true">
            <span>${text(form.trap)}</span>
            <input name="website" type="text" tabindex="-1" autocomplete="off">
          </label>
        </div>
        <p class="notes-rules">${text(form.rules)}</p>
        <div class="brief-foot">
          <button class="button button-primary" type="submit">${text(form.submit)}</button>
          <p class="brief-status" data-notes-status role="status" aria-live="polite"></p>
        </div>
      </form>
    </div>`;
}

function renderFooter(data) {
  const root = document.querySelector('[data-content="footer"]');
  if (!root || !data) return;

  /* Privacy and Terms stay visible on every visit: TikTok and Meta
     app review both check for them without opening any menu. */
  const legal = records(data.legal)
    .filter((link) => hasText(link.label) && hasText(link.href))
    .map((link) => `<a href="${attr(link.href)}">${text(link.label)}</a>`)
    .join("");

  root.innerHTML = `
    <div class="footer-inner">
      <span class="footer-copy">&copy; ${new Date().getFullYear()} ${text(data.name)}</span>
      ${hasText(data.visits) ? `<span class="footer-visits" data-visits data-template="${attr(data.visits)}" hidden></span>` : ""}
      ${legal ? `<nav class="footer-legal" aria-label="${attr(data.legalLabel || "Legal")}">${legal}</nav>` : ""}
      <a class="footer-top" href="#hero">${text(data.backToTop)}</a>
    </div>`;
}

function renderInterface(data) {
  const skip = document.querySelector("#skip-link");
  if (skip && hasText(data.skipLink)) skip.textContent = data.skipLink;
}

function reportErrors(errors) {
  const status = document.querySelector("#content-status");
  if (!status || !errors.length) return;
  const message = ui("contentError");
  if (!hasText(message)) return;
  status.textContent = message;
  status.hidden = false;
}

function renderPortfolio(payload) {
  const { data, errors } = payload;
  interfaceText = data.ui || {};
  sectionIndex = new Map(
    records(data.chrome?.sections)
      .filter((section) => hasText(section.id))
      .map((section) => [section.id, section])
  );

  renderInterface(interfaceText);
  renderMeta(data.meta);
  renderPreloader();

  if (data.chrome) {
    renderTopChrome(data.chrome);
    renderSocialRail(data.chrome);
    renderMenu(data.chrome);
  }

  renderHero(data.hero, data.chrome);
  renderAbout(data.about);
  renderNumbers(data.numbers, data.social);
  renderExperience(data.experience);
  renderPractice(data.practice);
  renderWork(data.work);
  renderEdits(data.edits);
  renderProof(data.proof);
  renderStack(data.stack);
  renderNotes(data.notes);
  renderContact(data.contact);
  renderSectionShell();

  reportErrors(errors);
  document.documentElement.classList.add("is-ready");
}

window.portfolioContentReady = loadPortfolioContent()
  .then((payload) => {
    renderPortfolio(payload);
    return payload;
  })
  .catch((error) => {
    console.error("Portfolio content failed to render.", error);
    document.documentElement.classList.add("is-ready");
  });
