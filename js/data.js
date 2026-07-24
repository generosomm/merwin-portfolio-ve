// data.js — data file paths, fetch helpers, and utility functions

/* ── Data File Paths ── */
const DATA_FILES = {
  nav:          "data/nav.json",
  hero:         "data/hero.json",
  work:         "data/work.json",
  services:     "data/services.json",
  stats:        "data/stats.json",
  testimonials: "data/testimonials.json",
  skills:       "data/skills.json",
  dev:          "data/dev.json",
  about:        "data/about.json",
  contact:      "data/contact.json",
};

/* ── String Helpers ── */

// Escape HTML special chars
function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Safely get a key from an object with a fallback
function pick(obj, key, fallback = "") {
  const v = obj ? obj[key] : undefined;
  return v === undefined || v === null ? fallback : v;
}

// Always return an array
function list(value) {
  return Array.isArray(value) ? value : [];
}

// Empty state HTML
function emptyState(message) {
  return `<p class="load-msg" style="padding:32px 0;">${esc(message)}</p>`;
}

// Stagger delay for reveal animations
function revealDelay(i) {
  return `${Math.min(i, 8) * 65}ms`;
}

/* ── Section Head Helpers ── */
function sectionIndex(num, label) {
  return `<span class="section-index">${String(num).padStart(2,"0")} / ${label}</span>`;
}

function sectionHead(index, label, data) {
  if (!data) return "";
  return `
    <div class="section-head reveal">
      ${sectionIndex(index, label)}
      <h2>${esc(pick(data, "heading", ""))}</h2>
      ${data.sub ? `<p>${esc(data.sub)}</p>` : ""}
    </div>`;
}

/* ── Data Loader ── */
async function loadData() {
  const results = await Promise.allSettled(
    Object.entries(DATA_FILES).map(async ([key, path]) => {
      const url = `${path}?t=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`${path} responded ${res.status}`);
      const json = await res.json();
      return [key, json];
    })
  );

  const data = {};
  const failed = [];

  results.forEach((result, i) => {
    const key = Object.keys(DATA_FILES)[i];
    if (result.status === "fulfilled") {
      data[result.value[0]] = result.value[1];
    } else {
      failed.push(key);
      data[key] = null;
      console.warn(`Couldn't load "${key}":`, result.reason?.message || result.reason);
    }
  });

  return { data, failed };
}
