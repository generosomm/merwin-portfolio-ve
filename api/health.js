/* =============================================================
   GET /api/health  (admin only)

   A maintenance check: which environment variables Vercel has,
   whether Redis answers, how old the saved snapshot is, and how
   much YouTube quota today's refreshes have used. It reports
   true/false for each variable and NEVER echoes a value, so even a
   leaked response gives nothing away.

   Auth: Authorization: Bearer <ADMIN_SECRET>, or ?key=<ADMIN_SECRET>
   for a quick browser check (query strings can end up in logs, so
   prefer the header).
   ============================================================= */

import { isAdmin } from "../lib/auth.js";
import { env } from "../lib/config.js";
import { getQuotaUnits, getSnapshot, ping, storageConfigured } from "../lib/store.js";

/* Every variable the backend reads, grouped like .env.example. */
const EXPECTED = {
  security: ["ADMIN_SECRET", "CRON_SECRET"],
  tiktok: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REDIRECT_URI"],
  youtube: ["YOUTUBE_API_KEY", "YOUTUBE_CHANNEL_ID"],
  instagram: ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET", "INSTAGRAM_REDIRECT_URI"],
  facebook: ["META_APP_ID", "META_APP_SECRET", "FACEBOOK_REDIRECT_URI", "FACEBOOK_PAGE_ID"]
};

function json(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function storageReport() {
  if (!storageConfigured()) return { configured: false, reachable: false };
  try {
    const reachable = await ping();
    const [snapshot, youtubeUnitsToday] = await Promise.all([getSnapshot(), getQuotaUnits("youtube")]);
    const minutesSince = (iso) => (iso ? Math.round((Date.now() - new Date(iso)) / 60_000) : null);
    const statuses = snapshot
      ? Object.fromEntries(Object.entries(snapshot.platforms || {}).map(([name, p]) => [name, p.status]))
      : null;
    return {
      configured: true,
      reachable,
      snapshot: snapshot
        ? {
            checkedAt: snapshot.checkedAt,
            minutesSinceCheck: minutesSince(snapshot.checkedAt),
            updatedAt: snapshot.updatedAt,
            minutesSinceLiveData: minutesSince(snapshot.updatedAt),
            statuses
          }
        : null,
      quota: { youtubeUnitsToday, youtubeDailyLimit: 10_000 }
    };
  } catch (error) {
    return { configured: true, reachable: false, error: error.message };
  }
}

export default {
  async fetch(request) {
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
    if (!env("ADMIN_SECRET")) return json({ error: "ADMIN_SECRET is not set in Vercel yet" }, 503);
    if (!isAdmin(request)) return json({ error: "Unauthorized" }, 401);

    const vars = {};
    for (const [group, names] of Object.entries(EXPECTED)) {
      vars[group] = Object.fromEntries(names.map((name) => [name, Boolean(env(name))]));
    }

    return json({
      ok: true,
      checkedAt: new Date().toISOString(),
      node: process.version,
      region: env("VERCEL_REGION") || "local",
      env: vars,
      storage: await storageReport()
    });
  }
};
