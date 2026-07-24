// Data Configuration & Helper Functions

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

// Sanitization & String Helpers

function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function pick(obj, key, fallback = "") {
  const v = obj ? obj[key] : undefined;
  return v === undefined || v === null ? fallback : v;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function emptyState(message) {
  return `<p class="load-msg" style="padding:32px 0;">${esc(message)}</p>`;
}

function revealDelay(i) {
  return `${Math.min(i, 8) * 65}ms`;
}

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

// Data Fetcher

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

function renderSection(id, renderFn, data) {
  try {
    renderFn(data);
  } catch (err) {
    console.error(`Error rendering #${id}:`, err);
    const el = document.getElementById(id);
    if (el) el.innerHTML = emptyState(`Failed to render ${id} section.`);
  }
}
