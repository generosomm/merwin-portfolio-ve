/* =============================================================
   GET /api/stats — the only public endpoint. Read-only, no secrets.

   How freshness works (Vercel Hobby only allows a daily cron):

     visitor ──► Vercel CDN ──► this function ──► Redis snapshot
                  │                    │
                  │                    └─ snapshot older than
                  │                       refreshMinutes? take a lock,
                  │                       call the platforms, save.
                  └─ caches each answer for 15 min (s-maxage), then
                     keeps serving it for up to an hour while it asks
                     this function for a new one in the background
                     (stale-while-revalidate).

   So visitors almost never wait on TikTok/YouTube/Meta, and the
   platforms are called at most once per refreshMinutes no matter
   how much traffic arrives. The CDN cache, the Redis lock and the
   refresh interval together are the rate limit: extra requests
   (even with ?cache-busting params) only ever read Redis.

   Failure ladder, best first:
     fresh snapshot → last saved snapshot (marked stale)
     → documented-only numbers from data/social.json
   The page has its own last resort too: if this endpoint fails or
   takes over 3 s, it shows the fallback numbers from social.json.
   ============================================================= */

import { allowedOrigins, loadConfig } from "../lib/config.js";
import { fallbackSnapshot, publicSnapshot } from "../lib/normalize.js";
import { refreshSnapshot } from "../lib/refresh.js";
import { acquireLock, getSnapshot, releaseLock, saveSnapshot, storageConfigured } from "../lib/store.js";

const CACHE_OK = "public, max-age=0, s-maxage=900, stale-while-revalidate=3600";
/* Degraded answers (storage down, nothing saved yet) are cached
   briefly so the site recovers within a minute. */
const CACHE_DEGRADED = "public, max-age=0, s-maxage=60, stale-while-revalidate=60";
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

/* Returns { snapshot, degraded }. Never throws. */
async function loadOrRefresh(config, now) {
  /* No storage configured (e.g. local dev before linking Redis):
     fetch live every time. The CDN cache still limits how often. */
  if (!storageConfigured()) {
    try {
      return { snapshot: await refreshSnapshot(config, null, now), degraded: true };
    } catch (error) {
      console.error(`[stats] live refresh without storage failed: ${error.message}`);
      return { snapshot: fallbackSnapshot(config, now), degraded: true };
    }
  }

  let snapshot = null;
  try {
    snapshot = await getSnapshot();
    if (!isDue(snapshot, config, now)) return { snapshot, degraded: false };

    /* Due for a refresh. Only the request holding the lock refreshes;
       any others arriving at the same moment serve what we have. */
    const lock = await acquireLock("refresh", LOCK_SECONDS);
    if (!lock) {
      return snapshot ? { snapshot, degraded: false } : { snapshot: fallbackSnapshot(config, now), degraded: true };
    }
    try {
      const next = await refreshSnapshot(config, snapshot, now);
      await saveSnapshot(next);
      return { snapshot: next, degraded: false };
    } finally {
      await releaseLock("refresh", lock);
    }
  } catch (error) {
    console.error(`[stats] ${error.message}`);
    return snapshot ? { snapshot, degraded: true } : { snapshot: fallbackSnapshot(config, now), degraded: true };
  }
}

export default {
  async fetch(request) {
    const cors = corsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { ...cors, "Access-Control-Max-Age": "86400" } });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return Response.json({ error: "Method not allowed" }, { status: 405, headers: { ...cors, Allow: "GET, HEAD, OPTIONS" } });
    }

    const config = loadConfig();
    const now = new Date();
    const { snapshot, degraded } = await loadOrRefresh(config, now);
    const body = publicSnapshot(snapshot, config, now);

    const headers = {
      ...cors,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": degraded ? CACHE_DEGRADED : CACHE_OK,
      "X-Content-Type-Options": "nosniff"
    };
    return new Response(request.method === "HEAD" ? null : JSON.stringify(body), { status: 200, headers });
  }
};
