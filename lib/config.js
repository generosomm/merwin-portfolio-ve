/* =============================================================
   CONFIG — reads data/social.json (public settings) and env vars.

   data/social.json is the same file the page reads, so the server
   and the browser always agree on handles, baselines and refresh
   timing. It is read once per warm function instance and checked
   here, so a typo in the JSON degrades to safe defaults instead of
   crashing /api/stats.

   vercel.json's "includeFiles" ships data/social.json with every
   function; the path below resolves relative to this file, so it
   works the same on Vercel, under `vercel dev` and in tests.
   ============================================================= */

import { readFileSync } from "node:fs";

/* Every platform the backend knows about, in display order. */
export const PLATFORMS = Object.freeze(["tiktok", "youtube", "instagram", "facebook"]);

const SOCIAL_JSON = new URL("../data/social.json", import.meta.url);

/* Sites allowed to read /api/stats from another origin (CORS).
   The portfolio itself is same-origin and needs no CORS at all. */
const DEFAULT_ORIGINS = ["https://generosomm.dev", "https://www.generosomm.dev"];

let cached = null;

/** Trimmed env var, or "" when unset. Never logs or returns secrets elsewhere. */
export function env(name) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

export function allowedOrigins() {
  const list = env("SITE_ORIGINS");
  if (!list) return DEFAULT_ORIGINS;
  return list.split(",").map((origin) => origin.trim()).filter(Boolean);
}

const positive = (value) => (Number.isFinite(value) && value > 0 ? Math.round(value) : null);
const clamp = (value, min, max, fallback) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
const str = (value) => (typeof value === "string" ? value : "");

/* A documented total only counts if it has a real number. "asOf"
   and "source" are passed through so the page can cite them. */
function readDocumented(raw) {
  if (!raw || typeof raw !== "object") return null;
  const views = positive(raw.views);
  if (views === null) return null;
  return { views, window: str(raw.window), asOf: str(raw.asOf), source: str(raw.source) };
}

function normalizeConfig(raw) {
  const platforms = {};
  for (const name of PLATFORMS) {
    const entry = raw?.platforms?.[name] || {};
    platforms[name] = {
      handle: str(entry.handle),
      url: str(entry.url),
      enabled: entry.enabled !== false,
      documented: readDocumented(entry.documented)
    };
  }

  return {
    refreshMinutes: clamp(raw?.refreshMinutes, 15, 1440, 30),
    topPostsPerPlatform: clamp(raw?.topPostsPerPlatform, 3, 6, 6),
    showPlatforms: Array.isArray(raw?.showPlatforms)
      ? raw.showPlatforms.filter((name) => PLATFORMS.includes(name))
      : [...PLATFORMS],
    platforms,
    baseline: {
      totalViews: positive(raw?.baseline?.totalViews) ?? 0,
      note: str(raw?.baseline?.note),
      asOf: str(raw?.baseline?.asOf),
      source: str(raw?.baseline?.source)
    }
  };
}

export function loadConfig() {
  if (cached) return cached;
  try {
    cached = normalizeConfig(JSON.parse(readFileSync(SOCIAL_JSON, "utf8")));
  } catch (error) {
    console.error(`[config] data/social.json could not be read (${error.message}); using defaults.`);
    cached = normalizeConfig({});
  }
  return cached;
}

/* Tests swap the config between cases. */
export function resetConfigCache() {
  cached = null;
}
