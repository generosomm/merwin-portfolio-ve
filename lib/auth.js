/* =============================================================
   AUTH — the two shared secrets that guard the private routes.

   ADMIN_SECRET: you, by hand (connect an account, force a refresh,
                 /api/health). Header or ?key= (OAuth start links
                 have to be clickable, so the query form is allowed).
   CRON_SECRET:  Vercel's daily cron. Vercel sends it as
                 "Authorization: Bearer <CRON_SECRET>"; header only.
   ============================================================= */

import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "./config.js";

/* Constant-time comparison. Hashing first gives two equal-length
   buffers (timingSafeEqual requires that) and hides the secret's
   length from timing measurements. */
export function sameSecret(given, expected) {
  if (!given || !expected) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function bearer(request) {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

export function isAdmin(request) {
  const given = bearer(request) || new URL(request.url).searchParams.get("key") || "";
  return sameSecret(given, env("ADMIN_SECRET"));
}

export function isCron(request) {
  return sameSecret(bearer(request), env("CRON_SECRET"));
}
