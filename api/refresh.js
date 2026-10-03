/* =============================================================
   /api/refresh — refresh every platform now and save the snapshot.

   Two callers:
   - Vercel's daily cron (vercel.json). Vercel sends
     "Authorization: Bearer <CRON_SECRET>" and uses GET.
   - You, by hand, after changing a key or connecting an account:
       curl -X POST -H "Authorization: Bearer ADMIN_SECRET" https://generosomm.dev/api/refresh
     or in a browser: /api/refresh?key=ADMIN_SECRET
   Anyone else gets 401, so nobody can make the site burn API quota.

   It shares /api/stats' Redis lock, so it never runs at the same
   time as a visitor-triggered refresh. The answer lists each
   platform's status only: no numbers, tokens or error details
   (those are in the function logs).

   Phase 5 adds the daily history point here.
   ============================================================= */

import { isAdmin, isCron } from "../lib/auth.js";
import { env, loadConfig } from "../lib/config.js";
import { refreshNow } from "../lib/refresh.js";
import { storageConfigured } from "../lib/store.js";

function json(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export default {
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }
    if (!env("ADMIN_SECRET") && !env("CRON_SECRET")) return json({ error: "Secrets are not set in Vercel yet" }, 503);
    if (!isCron(request) && !isAdmin(request)) return json({ error: "Unauthorized" }, 401);
    if (!storageConfigured()) return json({ error: "Redis is not connected" }, 503);

    const started = Date.now();
    const { snapshot, locked } = await refreshNow(loadConfig());
    if (locked) return json({ ok: false, reason: "A refresh is already running; try again in a minute." }, 409);

    return json({
      ok: true,
      tookMs: Date.now() - started,
      updatedAt: snapshot.updatedAt,
      statuses: Object.fromEntries(Object.entries(snapshot.platforms).map(([name, p]) => [name, p.status]))
    });
  }
};
