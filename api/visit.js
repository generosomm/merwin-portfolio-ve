/* =============================================================
   /api/visit — the public visit counter in the footer.

   POST  counts this visit (once per visitor per day) and returns
         the total. js/visits.js sends it after 3 s on the page.
   GET   returns the total without counting (cached a minute).

   What "a visit" means, so the number stays honest:
   - one per visitor per UTC day (a reload or a second tab the same
     day doesn't count again; see lib/visitor.js for how visitors
     are told apart without storing IP addresses),
   - only from a real page on this site (Origin check), not from
     bots or link previews (user-agent check),
   - only after 3 s on the page (the browser side), so instant
     bounces and most scrapers don't count.
   Everything is counted from launch day ("since"); nothing is
   seeded or imported.

   Redis: one total, one counter per day (kept 400 days, for a
   history chart later), today's set of hashed visitors (2 days).
   ============================================================= */

import { KEYS, pipeline, storageConfigured, utcDay } from "../lib/store.js";
import { TWO_DAYS, fromOwnSite, isBot, visitorHash } from "../lib/visitor.js";

const DAY_HISTORY_SECONDS = 400 * 24 * 60 * 60;

function json(body, status, cache) {
  return Response.json(body, { status, headers: { "Cache-Control": cache, "X-Content-Type-Options": "nosniff" } });
}

async function readTotal() {
  const [total, since] = await pipeline([["GET", KEYS.visitsTotal], ["GET", KEYS.visitsSince]]);
  return { total: Number(total) || 0, since: since || null };
}

export default {
  async fetch(request) {
    if (!storageConfigured()) return json({ error: "Storage not connected" }, 503, "no-store");

    if (request.method === "GET") {
      try {
        return json(await readTotal(), 200, "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
      } catch (error) {
        console.error(`[visit] read failed: ${error.message}`);
        return json({ error: "Unavailable" }, 503, "no-store");
      }
    }

    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, "no-store");
    if (!fromOwnSite(request)) return json({ error: "Forbidden" }, 403, "no-store");

    try {
      if (isBot(request)) return json({ ...(await readTotal()), counted: false }, 200, "no-store");

      const now = new Date();
      const day = utcDay(now);
      const visitor = await visitorHash(request, now);

      /* SADD answers 1 only the first time this visitor is added today. */
      const [added] = await pipeline([
        ["SADD", KEYS.visitsSeen(day), visitor],
        ["EXPIRE", KEYS.visitsSeen(day), TWO_DAYS]
      ]);

      if (Number(added) === 1) {
        await pipeline([
          ["INCR", KEYS.visitsTotal],
          ["INCR", KEYS.visitsDay(day)],
          ["EXPIRE", KEYS.visitsDay(day), DAY_HISTORY_SECONDS],
          ["SET", KEYS.visitsSince, day, "NX"] // the first day anything was counted
        ]);
      }
      return json({ ...(await readTotal()), counted: Number(added) === 1 }, 200, "no-store");
    } catch (error) {
      console.error(`[visit] count failed: ${error.message}`);
      return json({ error: "Unavailable" }, 503, "no-store");
    }
  }
};
