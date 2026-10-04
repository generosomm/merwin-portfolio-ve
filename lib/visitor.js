/* =============================================================
   VISITOR — how the visit counter and the notes rate limit tell
   visitors apart without storing who they are.

   A visitor is reduced to a short one-way hash of
     today's random salt + IP address + browser user-agent.
   - The IP is never stored, only this hash.
   - The salt is random, changes every UTC day, and expires after
     two days, so a hash can't be reversed, and the same visitor
     gets an unrelated hash tomorrow: nobody (me included) can
     follow a visitor across days.
   - Hashes themselves expire with the day's records (2 days).
   ============================================================= */

import { createHash, randomBytes } from "node:crypto";
import { allowedOrigins } from "./config.js";
import { KEYS, command, utcDay } from "./store.js";

const TWO_DAYS = 2 * 24 * 60 * 60;

/* Vercel puts the real client address first in x-forwarded-for. */
export function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}

async function dailySalt(day) {
  const key = KEYS.salt(day);
  const existing = await command("GET", key);
  if (existing) return existing;
  /* NX: if two requests race, both end up using whichever was saved first. */
  await command("SET", key, randomBytes(16).toString("hex"), "NX", "EX", TWO_DAYS);
  return command("GET", key);
}

/** A short, salted, one-way id for this visitor, valid for today only. */
export async function visitorHash(request, now = new Date()) {
  const salt = await dailySalt(utcDay(now));
  const userAgent = request.headers.get("user-agent") || "";
  return createHash("sha256").update(`${salt}|${clientIp(request)}|${userAgent}`).digest("base64url").slice(0, 22);
}

/* Crawlers, link previews and monitoring tools aren't visitors. */
const BOT = /bot|crawl|spider|slurp|preview|scan|monitor|headless|lighthouse|pagespeed|facebookexternalhit|whatsapp|telegram|discord|curl|wget|python|node-fetch|axios|go-http/i;

export function isBot(request) {
  const userAgent = request.headers.get("user-agent") || "";
  return !userAgent || BOT.test(userAgent);
}

/* Writes must come from the site itself (or its Vercel preview URLs).
   Browsers always send Origin on POST, so a missing one means the
   request didn't come from a page. */
export function fromOwnSite(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  if (origin === new URL(request.url).origin) return true;
  return allowedOrigins().includes(origin);
}

export { TWO_DAYS };
