"use strict";

/* =============================================================
   LIVE STATS — fills the Numbers section with live figures from
   /api/stats, and adds a "Top posts" strip to Proof.

   How it fits in:
   - js/content.js already rendered an honest static version from
     data/social.json (documented figures). This file only upgrades
     it. Delete this file (or /api) and the site still works.
   - The request starts the moment this script runs, in parallel
     with the content. If it fails or takes over 3 s, the documented
     figures stay and the error goes to the console only.
   - js/motion.js waits for window.portfolioLive.ready before
     counting the live "Views" card, so it counts once, to the right
     number.
   - Every word on screen comes from data/social.json (display).
     Text from the APIs (handles, captions) is only ever set with
     textContent, never innerHTML.
   ============================================================= */

(function liveStats() {
  const STATS_URL = "/api/stats";
  const FIRST_TIMEOUT_MS = 3000;
  const POLL_TIMEOUT_MS = 8000;
  const POLL_MS = 10 * 60_000; // a tab left open picks up new numbers
  const COUNT_MS = 1200;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Tell js/motion.js that live numbers are on their way. */
  let resolveReady = () => {};
  window.portfolioLive = { ready: new Promise((resolve) => { resolveReady = resolve; }) };

  async function fetchStats(timeoutMs) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(STATS_URL, { signal: controller.signal, headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || typeof data !== "object" || !data.platforms || !data.totals) throw new Error("unexpected response");
      return data;
    } finally {
      window.clearTimeout(timer);
    }
  }

  /* Start now; the page content is still loading in parallel. */
  const firstFetch = fetchStats(FIRST_TIMEOUT_MS);
  firstFetch.catch(() => {}); // handled in start(); avoids an "unhandled" warning meanwhile

  /* ---- Formatting -------------------------------------------------
     Rounded DOWN (81,402,513 -> 81.4M, never 81.5M): every figure here
     is presented as "at least", so it must never round up. The full
     number goes in a title tooltip. */

  function compactParts(n) {
    const units = [[1e9, "B"], [1e6, "M"], [1e3, "K"]];
    const [divisor, unit] = units.find(([d]) => n >= d) || [1, ""];
    const raw = n / divisor;
    const decimals = divisor > 1 && raw < 100 ? 1 : 0;
    const value = Math.floor(raw * 10 ** decimals) / 10 ** decimals;
    return { value, decimals: Number.isInteger(value) ? 0 : decimals, unit };
  }

  function formatCompact(n) {
    const { value, decimals, unit } = compactParts(n);
    return `${value.toFixed(decimals)}${unit}`;
  }

  const full = (n) => Math.round(n).toLocaleString("en");
  const fill = (template, values) =>
    String(template || "").replace(/\{(\w+)\}/g, (_, key) => (key in values ? String(values[key]) : ""));
  const isCount = (n) => typeof n === "number" && Number.isFinite(n) && n >= 0;
  const safeHref = (url) => (/^https:\/\//.test(String(url || "")) ? url : "");
  const safeImage = (url) => (/^(https:\/\/|\/api\/thumb\?)/.test(String(url || "")) ? url : "");

  function el(tag, className, textValue) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (textValue !== undefined) node.textContent = textValue;
    return node;
  }

  /* ---- Counting --------------------------------------------------- */

  function tween(from, to, onFrame, done) {
    if (reduceMotion || from === to) {
      onFrame(to);
      done?.();
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      const eased = 1 - (1 - t) ** 3;
      onFrame(from + (to - from) * eased);
      if (t < 1) window.requestAnimationFrame(step);
      else done?.();
    };
    window.requestAnimationFrame(step);
  }

  /* A table value: <data value="237822" title="237,822">237.8K</data>.
     data-target holds the final number while it counts. */
  function valueNode(n, noValue) {
    if (!isCount(n)) return el("span", "live-value", noValue);
    const node = el("data", "live-value", formatCompact(n));
    node.value = String(n);
    node.title = full(n);
    node.dataset.target = String(n);
    return node;
  }

  function countTableValues(root, previous) {
    root.querySelectorAll("data.live-value").forEach((node) => {
      const to = Number(node.dataset.target);
      const from = previous?.get(node.dataset.key) ?? 0;
      tween(from, to, (v) => { node.textContent = formatCompact(v); });
    });
  }

  /* Start the table's count-up the first time it scrolls into view. */
  function countWhenVisible(block) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      block.dataset.seen = "1";
      return;
    }
    block.querySelectorAll("data.live-value").forEach((node) => { node.textContent = formatCompact(0); });
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      block.dataset.seen = "1";
      countTableValues(block, null);
    }, { threshold: 0.25 });
    observer.observe(block);
  }

  /* ---- Rows ------------------------------------------------------ */

  function sparkline(values) {
    const width = 72;
    const height = 20;
    const pad = 2;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const x = (i) => pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = (v) => (max === min ? height / 2 : height - pad - ((v - min) / (max - min)) * (height - pad * 2));
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("class", "live-spark");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    line.setAttribute("points", values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" "));
    svg.append(line);
    return svg;
  }

  /* Followers per day for one platform, from the daily history
     points (added by the server in Phase 5). Needs at least 2 days. */
  function trendCell(history, name, display) {
    const cell = el("td", "live-cell live-trend");
    const points = (Array.isArray(history) ? history : [])
      .slice(-30)
      .map((point) => (name === "total" ? point?.followers : point?.platforms?.[name]?.followers))
      .filter(isCount);
    if (points.length < 2) {
      cell.setAttribute("aria-hidden", "true");
      return cell;
    }
    const sentence = fill(display.trend, { days: points.length, from: full(points[0]), to: full(points[points.length - 1]) });
    cell.title = sentence;
    cell.append(sparkline(points), el("span", "sr-only", sentence));
    return cell;
  }

  function platformRow(name, platform, social, stats) {
    const display = social.display;
    const columns = display.columns || {};
    const row = el("tr", `live-row is-${platform.status}`);
    row.dataset.platform = name;

    const head = el("th", "live-platform");
    head.scope = "row";
    const href = safeHref(platform.url || social.platforms?.[name]?.url);
    const link = el(href ? "a" : "span", "live-platform-link");
    if (href) {
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    const icon = el("span", "live-icon");
    if (typeof window.socialIcon === "function") icon.innerHTML = window.socialIcon(name); // our own static SVG
    link.append(icon, el("span", "live-name", display.names?.[name] || name));
    if (platform.handle) link.append(el("span", "live-handle", platform.handle));
    const tag = display.tags?.[platform.status];
    if (tag) link.append(el("span", "live-tag", tag));
    head.append(link);
    row.append(head);

    for (const field of ["followers", "views", "posts"]) {
      const cell = el("td", "live-cell");
      cell.dataset.field = field;
      cell.dataset.label = columns[field] || field; // the phone layout shows it beside the value
      const node = valueNode(platform[field], display.noValue);
      node.dataset.key = `${name}:${field}`;
      if (field === "followers" && isCount(platform.followers) && platform.followersLabel) {
        node.title = `${full(platform.followers)} ${platform.followersLabel}`;
      }
      cell.append(node);
      row.append(cell);
    }
    row.append(trendCell(stats.history, name, display));
    return row;
  }

  function totalRow(stats, social) {
    const display = social.display;
    const row = el("tr", "live-row live-row-total");
    row.dataset.platform = "total";
    const head = el("th", "live-platform");
    head.scope = "row";
    head.append(el("span", "live-name", display.total));
    row.append(head);
    for (const field of ["followers", "views", "posts"]) {
      const cell = el("td", "live-cell");
      cell.dataset.field = field;
      cell.dataset.label = display.columns?.[field] || field;
      const node = valueNode(stats.totals[field], display.noValue);
      node.dataset.key = `total:${field}`;
      cell.append(node);
      row.append(cell);
    }
    row.append(trendCell(stats.history, "total", display));
    return row;
  }

  function shownPlatforms(stats, social) {
    const order = Array.isArray(social.showPlatforms) ? social.showPlatforms : Object.keys(stats.platforms);
    return order
      .map((name) => [name, stats.platforms[name]])
      .filter(([, platform]) => platform && platform.status !== "disabled" && (isCount(platform.views) || isCount(platform.followers)));
  }

  /* ---- The Numbers section ------------------------------------------ */

  function renderTable(block, stats, social, { first }) {
    const body = block.querySelector("[data-live-rows]");
    const foot = block.querySelector("tfoot");
    if (!body || !foot) return;

    /* Remember what's on screen so a later update counts from it. */
    const previous = new Map();
    block.querySelectorAll("data.live-value").forEach((node) => {
      if (node.dataset.key) previous.set(node.dataset.key, Number(node.dataset.target));
    });

    body.replaceChildren(...shownPlatforms(stats, social).map(([name, platform]) => platformRow(name, platform, social, stats)));
    foot.replaceChildren(totalRow(stats, social));

    if (first && !block.dataset.seen) countWhenVisible(block);
    else countTableValues(block, previous);
  }

  function renderMethods(block, stats, social) {
    const target = block.querySelector("[data-live-methods]");
    if (!target) return;
    const display = social.display;
    const listNode = el("ul");
    for (const [name, platform] of shownPlatforms(stats, social)) {
      const item = el("li");
      item.append(el("strong", "", display.names?.[name] || name), document.createTextNode(` ${platform.viewsMethod || ""}`));
      const note = display.methods?.notes?.[name];
      if (note) item.append(el("span", "live-note", note));
      listNode.append(item);
    }
    const total = el("li");
    total.append(el("strong", "", display.methods?.total || ""), document.createTextNode(` ${stats.totals.viewsMethod || ""}`));
    listNode.append(total);
    const parts = [listNode];
    const note = stats.baseline?.note || social.baseline?.note;
    if (note) {
      const baseline = el("p");
      baseline.append(el("strong", "", display.methods?.baseline || ""), document.createTextNode(` ${note}`));
      parts.push(baseline);
    }
    target.replaceChildren(...parts);
  }

  function updateViewsCard(stats, social) {
    const card = document.querySelector('.number[data-live="views"]');
    const total = stats.totals.views;
    if (!card || !isCount(total)) return;
    const valueEl = card.querySelector(".number-value");
    const suffixEl = card.querySelector(".number-suffix");
    if (!valueEl) return;

    const { value, decimals, unit } = compactParts(total);
    const from = Number(valueEl.dataset.countTo) || 0;
    valueEl.dataset.countTo = String(value);
    valueEl.dataset.decimals = String(decimals);
    if (suffixEl) suffixEl.textContent = `${unit}+`;
    card.querySelector(".number-figure")?.setAttribute("title", full(total));
    const label = card.querySelector(".number-label");
    const detail = card.querySelector(".number-detail");
    if (label && social.display.viewsCard?.label) label.textContent = social.display.viewsCard.label;
    if (detail && social.display.viewsCard?.detail) detail.textContent = social.display.viewsCard.detail;

    /* js/motion.js owns the first count ("waiting" or "running").
       Otherwise (already counted, motion off, or no motion.js) count
       from what's shown. */
    const show = (v) => { valueEl.textContent = v.toFixed(decimals); };
    const state = valueEl.dataset.countState;
    if (state === "waiting") return;
    if (state === "running") {
      valueEl.addEventListener("count:done", () => tween(from, value, show), { once: true });
      return;
    }
    tween(from, value, show);
  }

  /* ---- Status line --------------------------------------------------- */

  function ago(iso, display) {
    const minutes = Math.floor((Date.now() - new Date(iso)) / 60_000);
    const words = display.ago || {};
    if (!Number.isFinite(minutes) || minutes < 1) return words.now || "";
    if (minutes < 60) return fill(words.minutes, { n: minutes });
    if (minutes < 48 * 60) return fill(words.hours, { n: Math.floor(minutes / 60) });
    return fill(words.days, { n: Math.floor(minutes / 1440) });
  }

  let statusState = { kind: "documented", updatedAt: null };

  function paintStatus(block, display) {
    const line = block.querySelector("[data-live-status]");
    const label = block.querySelector("[data-live-status-text]");
    if (!line || !label) return;
    const { kind, updatedAt } = statusState;
    line.classList.remove("is-live", "is-cached", "is-documented", "is-loading");
    line.classList.add(`is-${kind}`);
    label.textContent = fill(display.status?.[kind], { ago: updatedAt ? ago(updatedAt, display) : "" });
  }

  /* Announced once, politely, on first load. The minute-by-minute
     "updated X min ago" ticks are not announced. */
  function announceOnce(block) {
    const line = block.querySelector("[data-live-status]");
    if (!line || line.dataset.announced) return;
    line.dataset.announced = "1";
    line.setAttribute("aria-live", "polite");
    window.setTimeout(() => line.removeAttribute("aria-live"), 2000);
  }

  /* ---- Top posts (Proof section) ------------------------------------- */

  function renderTopPosts(stats, social) {
    const settings = social.display.topPosts;
    const proof = document.querySelector('[data-section="proof"] .section-inner');
    if (!settings?.show || !proof) return;

    const posts = shownPlatforms(stats, social)
      .flatMap(([name, platform]) => (platform.topPosts || []).map((post) => ({ ...post, platform: name })))
      .filter((post) => isCount(post.views) && safeHref(post.url))
      .sort((a, b) => b.views - a.views)
      .slice(0, Number(settings.limit) || 8);

    let block = proof.querySelector("[data-live-posts]");
    if (!posts.length) {
      block?.remove();
      return;
    }

    if (!block) {
      block = el("div", "proof-block live-posts");
      block.dataset.livePosts = "";
      const head = el("div", "proof-head");
      head.append(el("h3", "proof-heading", settings.heading), el("p", "proof-intro", settings.intro));
      block.append(head, el("ul", "live-posts-list"));
      /* After the analytics screenshots, before the certificates. */
      const firstBlock = proof.querySelector(".proof-block");
      if (firstBlock) firstBlock.after(block);
      else proof.append(block);
    }

    const names = social.display.names || {};
    const items = posts.map((post) => {
      const platformName = names[post.platform] || post.platform;
      const views = fill(settings.views, { n: formatCompact(post.views) });
      const item = el("li", "live-post-item");
      const link = el("a", "live-post");
      link.href = post.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", `${post.title ? `${post.title}. ` : ""}${views}. ${fill(settings.open, { platform: platformName })}`);

      const media = el("span", "live-post-media");
      const src = safeImage(post.thumbnail?.url);
      if (src) {
        const img = el("img");
        img.src = src;
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        img.addEventListener("error", () => { img.remove(); media.classList.add("is-empty"); }, { once: true });
        media.append(img);
      } else {
        media.classList.add("is-empty");
      }
      const badge = el("span", "live-post-views", views);
      badge.title = full(post.views);
      media.append(badge);

      const meta = el("span", "live-post-meta");
      const icon = el("span", "live-icon");
      if (typeof window.socialIcon === "function") icon.innerHTML = window.socialIcon(post.platform);
      meta.append(icon, el("span", "", platformName));

      link.append(media, meta);
      if (post.title) link.append(el("span", "live-post-title", post.title));
      item.append(link);
      return item;
    });
    block.querySelector(".live-posts-list").replaceChildren(...items);
  }

  /* ---- Putting it together --------------------------------------- */

  let lastUpdatedAt = null;

  function apply(block, stats, social, { first }) {
    lastUpdatedAt = stats.updatedAt;
    statusState = {
      kind: !stats.updatedAt ? "documented" : stats.stale ? "cached" : "live",
      updatedAt: stats.updatedAt
    };
    if (block) {
      renderTable(block, stats, social, { first });
      renderMethods(block, stats, social);
      paintStatus(block, social.display);
      if (first) announceOnce(block);
    }
    updateViewsCard(stats, social);
    renderTopPosts(stats, social);
  }

  async function loadSocial() {
    const payload = await window.portfolioContentReady?.catch(() => null);
    if (payload?.data?.social) return payload.data.social;
    try {
      const response = await fetch("data/social.json");
      return response.ok ? await response.json() : null;
    } catch {
      return null;
    }
  }

  async function start() {
    const social = await loadSocial();
    const block = document.querySelector("[data-live-stats]");
    if (!social?.display) {
      resolveReady();
      return;
    }

    if (block) {
      block.classList.add("is-loading");
      statusState = { kind: "loading", updatedAt: null };
      paintStatus(block, social.display);
    }

    try {
      const stats = await firstFetch;
      apply(block, stats, social, { first: true });
    } catch (error) {
      /* Visitors just see the documented figures. */
      console.info(`[live-stats] showing documented figures (${error.name === "AbortError" ? "timed out" : error.message}).`);
      statusState = { kind: "documented", updatedAt: null };
      if (block) paintStatus(block, social.display);
    } finally {
      block?.classList.remove("is-loading");
      resolveReady();
    }

    /* Keep "updated X min ago" honest, and pick up new numbers if the
       tab stays open. Polls only while the tab is visible. */
    window.setInterval(() => { if (block) paintStatus(block, social.display); }, 60_000);
    window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const stats = await fetchStats(POLL_TIMEOUT_MS);
        if (stats.updatedAt !== lastUpdatedAt) apply(block, stats, social, { first: false });
      } catch {
        /* Keep what's shown; try again next time. */
      }
    }, POLL_MS);
  }

  start();
})();
