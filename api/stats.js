/* =============================================================
   GET /api/stats — the only public endpoint. Read-only, no secrets.

   How freshness works (Vercel Hobby only allows a daily cron):

     visitor ──► Vercel CDN ──► this function ──► Redis snapshot
                  │                    │
                  │                    └─ snapshot older than
                  │                       refreshMinutes? reply with it
                  │                       NOW, then (one request, under
                  │                       a lock) call the platforms
                  │                       and save, after replying.
                  └─ caches each answer for 15 min (s-maxage), then
                     keeps serving it for up to an hour while it asks
                     this function for a new one in the background
                     (stale-while-revalidate).

   So visitors never wait on TikTok/YouTube/Meta (only the very
   first request ever, with nothing saved yet, does), and the
   platforms are called at most once per refreshMinutes no matter
   how much traffic arrives. The CDN cache, the Redis lock and the
   refresh interval together are the rate limit: extra requests
   (even with ?cache-busting params) only ever read Redis.

   Failure ladder, best first:
     fresh snapshot → last saved snapshot (marked stale)
     → documented-only numbers from data/social.json
   The page has its own last resort too: if this endpoint fails or
   takes over 3 s, it shows the fallback numbers from social.json
   (and still swaps in the live ones if they arrive later).
   ============================================================= */

import { allowedOrigins, loadConfig } from "../lib/config.js";
import { fallbackSnapshot, publicSnapshot } from "../lib/normalize.js";
import { refreshSnapshot } from "../lib/refresh.js";
import { acquireLock, getSnapshot, releaseLock, saveSnapshot, storageConfigured } from "../lib/store.js";

const CACHE_OK = "public, max-age=0, s-maxage=900, stale-while-revalidate=3600";
/* Degraded answers (storage down, nothing saved yet) are cached
   briefly so the site recovers within a minute. */
const CACHE_DEGRADED = "public, max-age=0, s-maxage=60, stale-while-revalidate=60";
/* Served the saved snapshot while a refresh runs in the background:
   cache it only briefly, so the fresh numbers reach visitors soon. */
const CACHE_REFRESHING = "public, max-age=0, s-maxage=30, stale-while-revalidate=60";
const LOCK_SECONDS = 60;

function corsHeaders(request) {
  const origin = request.headers.get("origin");
  const headers = { Vary: "Origin" };
  if (origin && allowedOrigins().includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, HEAD, OPTIONS";
  }
  return headers;
}

/* Due when the last refresh *attempt* is older than refreshMinutes.
   Using checkedAt (not updatedAt) means a platform that is down is
   retried once per interval, not on every request. */
function isDue(snapshot, config, now) {
  const last = snapshot?.checkedAt;
  if (!last) return true;
  return now - new Date(last) >= config.refreshMinutes * 60_000;
}

/* Vercel can keep a function alive after it has replied, via
   waitUntil(promise). It's handed to fetch() as context.waitUntil
   (older API, still supported) or found on Vercel's request context
   (what the @vercel/functions package reads, without installing it).
   Locally neither exists, and the refresh simply runs before replying. */
function backgroundRunner(context) {
  if (typeof context?.waitUntil === "function") return (promise) => context.waitUntil(promise);
  const vercel = globalThis[Symbol.for("@vercel/request-context")]?.get?.();
  if (typeof vercel?.waitUntil === "function") return (promise) => vercel.waitUntil(promise);
  return null;
}

/* Returns { snapshot, cache }. Never throws.
   cache: "ok" | "refreshing" | "degraded" (picks the Cache-Control). */
async function loadOrRefresh(config, now, waitUntil) {
  /* No storage configured (e.g. local dev before linking Redis):
     fetch live every time. The CDN cache still limits how often. */
  if (!storageConfigured()) {
    try {
      return { snapshot: await refreshSnapshot(config, null, now), cache: "degraded" };
    } catch (error) {
      console.error(`[stats] live refresh without storage failed: ${error.message}`);
      return { snapshot: fallbackSnapshot(config, now), cache: "degraded" };
    }
  }

  let snapshot = null;
  try {
    snapshot = await getSnapshot();
    if (!isDue(snapshot, config, now)) return { snapshot, cache: "ok" };

    /* Due for a refresh. Only the request holding the lock refreshes;
       any others arriving at the same moment serve what we have. */
    const lock = await acquireLock("refresh", LOCK_SECONDS);
    if (!lock) {
      return snapshot ? { snapshot, cache: "refreshing" } : { snapshot: fallbackSnapshot(config, now), cache: "degraded" };
    }

    const job = refreshSnapshot(config, snapshot, now)
      .then((next) => saveSnapshot(next).then(() => next))
      .finally(() => releaseLock("refresh", lock));

    /* We have numbers to show: reply with them NOW and finish the
       refresh after replying. A refresh can take several seconds
       (TikTok's video walk), and the page only waits 3 s. */
    if (snapshot && waitUntil) {
      waitUntil(job.catch((error) => console.error(`[stats] background refresh failed: ${error.message}`)));
      return { snapshot, cache: "refreshing" };
    }

    /* Nothing saved yet (first ever request), or no way to work after
       replying (local dev): refresh first. */
    return { snapshot: await job, cache: "ok" };
  } catch (error) {
    console.error(`[stats] ${error.message}`);
    return snapshot ? { snapshot, cache: "degraded" } : { snapshot: fallbackSnapshot(config, now), cache: "degraded" };
  }
}

export default {
  async fetch(request, context) {
    const cors = corsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { ...cors, "Access-Control-Max-Age": "86400" } });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return Response.json({ error: "Method not allowed" }, { status: 405, headers: { ...cors, Allow: "GET, HEAD, OPTIONS" } });
    }

    const config = loadConfig();
    const now = new Date();
    const { snapshot, cache } = await loadOrRefresh(config, now, backgroundRunner(context));
    const body = publicSnapshot(snapshot, config, now);

    const headers = {
      ...cors,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cache === "ok" ? CACHE_OK : cache === "refreshing" ? CACHE_REFRESHING : CACHE_DEGRADED,
      "X-Content-Type-Options": "nosniff"
    };
    return new Response(request.method === "HEAD" ? null : JSON.stringify(body), { status: 200, headers });
  }
};
