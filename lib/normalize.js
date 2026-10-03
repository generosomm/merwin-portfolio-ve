/* =============================================================
   NORMALIZE — turns each provider's output into one shared shape,
   merges it with the last good snapshot, and computes totals.

   The two honesty rules live here, in one place:

   1. Per platform, the views shown are max(live, documented).
      "documented" is a total proven by a screenshot (data/
      social.json). Taking the larger of two lower bounds is still
      a lower bound, so this never overstates and never double
      counts: a platform's documented number only ever competes
      with that same platform's live number.

   2. Every number says how it was counted (viewsMethod), so the
      page can show its working.

   Nothing here touches the network; it is pure data in, data out,
   which makes it easy to test and to explain.
   ============================================================= */

import { PLATFORMS } from "./config.js";

export const STATUS = Object.freeze({
  ok: "ok", // fresh from the API
  stale: "stale", // API failed for a temporary reason; last good data
  error: "error", // credentials rejected; last good data, needs reconnecting
  manual: "manual", // no live connection; documented numbers only
  disabled: "disabled" // switched off, or nothing to show
});

/* ---- Small, defensive converters ------------------------------ */

/** A non-negative whole number, or null. APIs send counts as strings sometimes. */
export function toCount(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}

/** Plain, single-line text, cut at a word boundary. The page renders it with textContent. */
export function trimText(value, max = 90) {
  const clean = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ") // control characters and newlines
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Only https URLs survive; anything else (javascript:, data:, http:) becomes "". */
export function safeUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const short = (n) => compact.format(n);

/** Top posts by views, in the public shape. */
export function pickTopPosts(posts, limit) {
  return (Array.isArray(posts) ? posts : [])
    .map((post) => ({
      id: String(post.id ?? ""),
      title: trimText(post.title),
      views: toCount(post.views),
      url: safeUrl(post.url),
      thumbnail: post.thumbnail?.url
        ? {
            url: safeUrl(post.thumbnail.url),
            width: toCount(post.thumbnail.width),
            height: toCount(post.thumbnail.height)
          }
        : null
    }))
    .filter((post) => post.id && post.url && post.views !== null)
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}

/* ---- One platform --------------------------------------------- */

function hasLiveData(platform) {
  return Boolean(platform) && (platform.liveViews !== null || platform.followers !== null);
}

/* Explain which number won. Examples:
     "lifetime channel viewCount (live)"
     "documented 57.9M (last 365 days); live sum of public videos is 41.2M" */
function describeViews(liveViews, liveMethod, documented) {
  if (documented && (liveViews === null || documented.views > liveViews)) {
    const window = documented.window ? ` (${documented.window})` : "";
    const live = liveViews === null ? "no live figure yet" : `live ${liveMethod} is ${short(liveViews)}`;
    return `documented ${short(documented.views)}${window}; ${live}`;
  }
  return liveViews === null ? "" : `${liveMethod} (live)`;
}

function withViews(platform, documented) {
  const live = platform.liveViews;
  const views = documented ? Math.max(live ?? 0, documented.views) : live;
  return {
    ...platform,
    views,
    documented: documented || null,
    viewsMethod: describeViews(live, platform.liveViewsMethod, documented)
  };
}

function base(settings) {
  return {
    status: STATUS.disabled,
    handle: settings.handle,
    url: settings.url,
    followers: null,
    followersLabel: "followers",
    liveViews: null,
    liveViewsMethod: "",
    likes: null,
    likesMethod: "",
    posts: null,
    topPosts: [],
    fetchedAt: null,
    note: ""
  };
}

/**
 * Decide what one platform shows after a refresh attempt.
 * @param {string} name
 * @param {object} settings      config.platforms[name]
 * @param {object} outcome       { result } on success, { error } on failure,
 *                               or { skipped: "reason" } when not attempted
 * @param {object|null} previous the same platform from the last snapshot
 * @param {Date} now
 * @param {number} topLimit
 */
export function mergePlatform(name, settings, outcome, previous, now, topLimit) {
  const documented = settings.documented;
  const empty = base(settings);

  /* Fresh data. */
  if (outcome.result) {
    const r = outcome.result;
    return withViews(
      {
        ...empty,
        status: STATUS.ok,
        handle: r.handle || settings.handle,
        followers: toCount(r.followers),
        followersLabel: r.followersLabel || "followers",
        liveViews: toCount(r.views),
        liveViewsMethod: r.viewsMethod || "",
        likes: toCount(r.likes),
        likesMethod: r.likesMethod || "",
        posts: toCount(r.posts),
        topPosts: pickTopPosts(r.topPosts, topLimit),
        fetchedAt: now.toISOString()
      },
      documented
    );
  }

  /* The refresh failed: keep the last good numbers if we have them. */
  if (outcome.error) {
    const auth = outcome.error.kind === "auth";
    const status = auth ? STATUS.error : STATUS.stale;
    const note = auth ? "Connection needs renewing; showing the last good numbers." : "Temporarily unavailable; showing the last good numbers.";
    if (hasLiveData(previous)) {
      return withViews({ ...empty, ...previous, status, note }, documented);
    }
    if (outcome.error.kind !== "config") {
      return withViews({ ...empty, status: STATUS.error, note: "No live numbers yet." }, documented);
    }
    /* "config" (keys not set yet) falls through to the manual case. */
  }

  /* Not connected (yet): documented numbers if there are any. */
  if (documented) {
    return withViews({ ...empty, status: STATUS.manual, note: "Documented numbers; live connection not set up." }, documented);
  }
  return { ...withViews(empty, null), status: STATUS.disabled, note: outcome.skipped === "disabled" ? "Not shown." : "Not connected yet." };
}

/* ---- Totals ---------------------------------------------------- */

const COUNTED = new Set([STATUS.ok, STATUS.stale, STATUS.error, STATUS.manual]);

function sum(platforms, field) {
  let total = null;
  const from = [];
  for (const [name, platform] of Object.entries(platforms)) {
    if (!COUNTED.has(platform.status) || platform[field] === null) continue;
    total = (total ?? 0) + platform[field];
    from.push(name);
  }
  return { total, from };
}

export function computeTotals(platforms, baseline) {
  const views = sum(platforms, "views");
  const followers = sum(platforms, "followers");
  const likes = sum(platforms, "likes");
  const posts = sum(platforms, "posts");

  const floor = baseline.totalViews || 0;
  const usesFloor = floor > (views.total ?? 0);

  return {
    followers: followers.total,
    followersFrom: followers.from,
    views: usesFloor ? floor : views.total,
    viewsFrom: views.from,
    viewsMethod: usesFloor
      ? `documented baseline ${short(floor)} (higher than the per-platform sum of ${short(views.total ?? 0)})`
      : "sum of each platform's max(live, documented)",
    likes: likes.total,
    likesFrom: likes.from,
    posts: posts.total,
    postsFrom: posts.from
  };
}

/* ---- Whole snapshot -------------------------------------------- */

/**
 * @param {object} config     loadConfig()
 * @param {object} outcomes   { youtube: {result}|{error}|{skipped}, ... }
 * @param {object|null} previous last stored snapshot
 * @param {Date} now
 */
export function buildSnapshot(config, outcomes, previous, now = new Date()) {
  const platforms = {};
  for (const name of PLATFORMS) {
    platforms[name] = mergePlatform(
      name,
      config.platforms[name],
      outcomes[name] || { skipped: "unknown" },
      previous?.platforms?.[name] || null,
      now,
      config.topPostsPerPlatform
    );
  }

  /* Two clocks, on purpose:
     checkedAt  when we last tried; decides when to try again.
     updatedAt  when any platform last returned live numbers; this
                is what "Updated 12 min ago" shows. Documented-only
                numbers never move it, so the page can't claim
                freshness it doesn't have. */
  const anyLive = Object.values(platforms).some((p) => p.status === STATUS.ok);
  return {
    version: 1,
    checkedAt: now.toISOString(),
    updatedAt: anyLive ? now.toISOString() : previous?.updatedAt ?? null,
    totals: computeTotals(platforms, config.baseline),
    platforms,
    history: Array.isArray(previous?.history) ? previous.history : []
  };
}

/** Documented numbers only: for when storage is empty or down. */
export function fallbackSnapshot(config, now = new Date()) {
  const snapshot = buildSnapshot(config, {}, null, now);
  snapshot.checkedAt = null; // nothing was attempted
  return snapshot;
}

/* ---- What the public sees --------------------------------------
   An explicit allow-list: anything not copied here (internal
   fields, future debug data) can never leak into /api/stats. */

const PUBLIC_PLATFORM_FIELDS = [
  "status", "handle", "url", "followers", "followersLabel", "views", "viewsMethod",
  "liveViews", "documented", "likes", "likesMethod", "posts", "topPosts", "fetchedAt", "note"
];

export function publicSnapshot(snapshot, config, now = new Date()) {
  const platforms = {};
  for (const name of PLATFORMS) {
    const source = snapshot.platforms?.[name];
    if (!source) continue;
    platforms[name] = Object.fromEntries(PUBLIC_PLATFORM_FIELDS.map((field) => [field, source[field] ?? null]));
  }

  const anyDegraded = Object.values(platforms).some((p) => p.status === STATUS.stale || p.status === STATUS.error);
  const overdue = snapshot.updatedAt
    ? now - new Date(snapshot.updatedAt) > config.refreshMinutes * 2 * 60_000
    : false; // never had live data: "documented", not "stale"

  return {
    updatedAt: snapshot.updatedAt ?? null,
    /* Stale: live numbers are overdue, or a platform is serving old data. */
    stale: overdue || anyDegraded,
    refreshMinutes: config.refreshMinutes,
    totals: snapshot.totals,
    platforms,
    baseline: { totalViews: config.baseline.totalViews, note: config.baseline.note, asOf: config.baseline.asOf, source: config.baseline.source },
    history: Array.isArray(snapshot.history) ? snapshot.history : []
  };
}
