/* =============================================================
   STORE — Upstash Redis over its REST API, with plain fetch.

   Why Redis at all: the stats snapshot must survive between
   function invocations, and some tokens (TikTok, Instagram) are
   replaced on every refresh, which env vars can't hold.

   Why REST instead of a Redis client: serverless functions start
   cold and die often. One HTTPS request per command needs no open
   connection and no npm package. Upstash takes a command as a JSON
   array: POST <url>  ["SET","key","value"]  →  {"result":"OK"}.

   Every key is prefixed "stats:v1:" so a future format change can
   move to v2 without clashing with old data.
   ============================================================= */

import { randomUUID } from "node:crypto";
import { env } from "./config.js";

const PREFIX = "stats:v1:";

export const KEYS = Object.freeze({
  snapshot: `${PREFIX}snapshot`,
  lock: (name) => `${PREFIX}lock:${name}`,
  token: (provider) => `${PREFIX}token:${provider}`,
  oauthState: (state) => `${PREFIX}oauth:${state}`,
  index: (name) => `${PREFIX}index:${name}`,
  quota: (api, day) => `${PREFIX}quota:${api}:${day}`,

  /* Visit counter (api/visit.js) */
  visitsTotal: `${PREFIX}visits:total`,
  visitsSince: `${PREFIX}visits:since`,
  visitsDay: (day) => `${PREFIX}visits:day:${day}`,
  visitsSeen: (day) => `${PREFIX}visits:seen:${day}`, // today's hashed visitors, 2-day expiry
  salt: (day) => `${PREFIX}salt:${day}`, // today's random salt for those hashes, 2-day expiry

  /* Visitor notes (api/feedback.js) */
  notes: `${PREFIX}notes`, // hash: note id -> note JSON
  notesRate: (day, visitor) => `${PREFIX}notes:rate:${day}:${visitor}`
});

export class StoreError extends Error {
  constructor(message) {
    super(message);
    this.name = "StoreError";
  }
}

/* Vercel's Marketplace may name the pair either way; accept both. */
function credentials() {
  const url = env("KV_REST_API_URL") || env("UPSTASH_REDIS_REST_URL");
  const token = env("KV_REST_API_TOKEN") || env("UPSTASH_REDIS_REST_TOKEN");
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

export function storageConfigured() {
  return credentials() !== null;
}

async function post(path, payload) {
  const creds = credentials();
  if (!creds) throw new StoreError("Redis is not configured (KV_REST_API_URL / KV_REST_API_TOKEN missing)");

  let response;
  try {
    response = await fetch(`${creds.url}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${creds.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5_000)
    });
  } catch (error) {
    throw new StoreError(`Redis unreachable: ${error.name === "TimeoutError" ? "timeout" : error.message}`);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) throw new StoreError(`Redis HTTP ${response.status}${data?.error ? `: ${data.error}` : ""}`);
  return data;
}

/** Run one Redis command, e.g. command("GET", key). Arguments are sent as strings. */
export async function command(...args) {
  const data = await post("", args.map(String));
  if (data?.error) throw new StoreError(`Redis ${args[0]}: ${data.error}`);
  return data?.result ?? null;
}

/** Run several commands in one round trip. Returns each result, in order. */
export async function pipeline(commands) {
  const data = await post("/pipeline", commands.map((args) => args.map(String)));
  return (Array.isArray(data) ? data : []).map((item) => {
    if (item?.error) throw new StoreError(`Redis pipeline: ${item.error}`);
    return item?.result ?? null;
  });
}

export async function ping() {
  return (await command("PING")) === "PONG";
}

export async function getJSON(key) {
  const raw = await command("GET", key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    console.error(`[store] ${key} holds invalid JSON; ignoring it.`);
    return null;
  }
}

export async function setJSON(key, value, ttlSeconds) {
  const args = ["SET", key, JSON.stringify(value)];
  if (ttlSeconds) args.push("EX", ttlSeconds);
  await command(...args);
}

/* ---- Snapshot ------------------------------------------------
   Stored without an expiry on purpose: if every platform fails for
   a week, the site keeps serving the last good numbers. */

export const getSnapshot = () => getJSON(KEYS.snapshot);
export const saveSnapshot = (snapshot) => setJSON(KEYS.snapshot, snapshot);

/* ---- Lock ----------------------------------------------------
   Stops two simultaneous requests from both refreshing (and both
   spending API quota). SET NX only succeeds if the key is absent;
   EX makes it expire on its own if the function dies mid-refresh.
   The random token makes sure we only release our own lock. */

export async function acquireLock(name, seconds) {
  const token = randomUUID();
  const result = await command("SET", KEYS.lock(name), token, "NX", "EX", seconds);
  return result === "OK" ? token : null;
}

const RELEASE_IF_OWNER =
  'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end';

export async function releaseLock(name, token) {
  if (!token) return;
  try {
    await command("EVAL", RELEASE_IF_OWNER, 1, KEYS.lock(name), token);
  } catch (error) {
    /* Not fatal: the lock expires on its own. */
    console.warn(`[store] could not release lock ${name}: ${error.message}`);
  }
}

/* ---- OAuth tokens ----------------------------------------------
   One record per platform: { accessToken, accessExpiresAt,
   refreshToken, refreshExpiresAt, ... }. No expiry on the key:
   the provider decides when a token is too old and refreshes it.
   These records are the reason Redis must stay private: nothing
   here is ever copied into the public snapshot. */

export const getToken = (provider) => getJSON(KEYS.token(provider));
export const saveToken = (provider, record) => setJSON(KEYS.token(provider), record);

/* ---- OAuth state (CSRF protection) ------------------------------
   /start saves a random state for 10 minutes; /callback must find
   it. GETDEL reads and deletes in one step, so a state can only be
   used once (a replayed callback finds nothing). */

export async function saveOAuthState(state, data, ttlSeconds = 600) {
  await setJSON(KEYS.oauthState(state), data, ttlSeconds);
}

export async function takeOAuthState(state) {
  const raw = await command("GETDEL", KEYS.oauthState(state));
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* ---- API quota counter ---------------------------------------
   One counter per API per UTC day (YouTube's quota resets at
   midnight Pacific; UTC is close enough for a warning). Kept for
   three days so /api/health can show today's and yesterday's. */

export function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function addQuotaUnits(api, units, date = new Date()) {
  const key = KEYS.quota(api, utcDay(date));
  const [total] = await pipeline([
    ["INCRBY", key, units],
    ["EXPIRE", key, 3 * 24 * 60 * 60]
  ]);
  return Number(total) || 0;
}

export async function getQuotaUnits(api, date = new Date()) {
  return Number(await command("GET", KEYS.quota(api, utcDay(date)))) || 0;
}
