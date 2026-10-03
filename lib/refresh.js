/* =============================================================
   REFRESH — asks every enabled platform for fresh numbers at the
   same time and builds the next snapshot from whatever comes back.

   Promise.allSettled is the key line: one platform failing (bad
   token, outage, timeout) can never stop the others. Each failure
   becomes a per-platform status in the snapshot instead.

   Used by /api/stats (when the snapshot is due) and, from Phase 5,
   by /api/refresh (the daily cron).
   ============================================================= */

import { PLATFORMS } from "./config.js";
import { ProviderError } from "./errors.js";
import { buildSnapshot } from "./normalize.js";
import { fetchTikTok } from "./providers/tiktok.js";
import { fetchYouTube } from "./providers/youtube.js";
import { acquireLock, addQuotaUnits, getSnapshot, releaseLock, saveSnapshot, storageConfigured } from "./store.js";

/* Platforms without a provider yet show their documented numbers.
   Phase 4 adds instagram and facebook. */
const PROVIDERS = {
  tiktok: fetchTikTok,
  youtube: fetchYouTube
};

/* Hard cap per provider, so the whole refresh fits well inside the
   function's 60 s limit even if an API hangs through every retry. */
const PROVIDER_TIMEOUT_MS = 25_000;

function withTimeout(promise, ms, name) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new ProviderError("unavailable", `${name}: refresh took longer than ${ms / 1000} s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function recordQuota(name, units) {
  if (!units || name !== "youtube" || !storageConfigured()) return;
  try {
    const today = await addQuotaUnits("youtube", units);
    if (today > 8000) console.warn(`[youtube] ${today} of 10,000 daily quota units used today.`);
  } catch (error) {
    console.warn(`[stats] could not record YouTube quota: ${error.message}`);
  }
}

/**
 * @param {object} config        loadConfig()
 * @param {object|null} previous the last stored snapshot
 * @returns {Promise<object>}    the new snapshot (not yet saved)
 */
export async function refreshSnapshot(config, previous, now = new Date()) {
  const names = PLATFORMS.filter((name) => config.platforms[name].enabled && PROVIDERS[name]);

  const settled = await Promise.allSettled(
    names.map((name) => withTimeout(PROVIDERS[name]({ config, previous }), PROVIDER_TIMEOUT_MS, name))
  );

  const outcomes = {};
  for (const name of PLATFORMS) {
    if (!config.platforms[name].enabled) outcomes[name] = { skipped: "disabled" };
    else if (!PROVIDERS[name]) outcomes[name] = { skipped: "no provider" };
  }

  await Promise.all(
    settled.map(async (result, index) => {
      const name = names[index];
      if (result.status === "fulfilled") {
        outcomes[name] = { result: result.value.result };
        await recordQuota(name, result.value.meta?.quotaUnits);
        return;
      }
      const error = result.reason instanceof ProviderError
        ? result.reason
        : new ProviderError("unavailable", `${name}: ${result.reason?.message || result.reason}`);
      /* One clear line per failure in Vercel's function logs. */
      const log = error.kind === "config" ? console.warn : console.error;
      log(`[stats] ${name} ${error.kind}: ${error.message}`);
      outcomes[name] = { error };
      await recordQuota(name, error.quotaUnits);
    })
  );

  return buildSnapshot(config, outcomes, previous, now);
}

/**
 * Refresh right now and save, under the same lock /api/stats uses.
 * Called after connecting an account (and, from Phase 5, by the
 * cron) so new numbers appear without waiting for refreshMinutes.
 * @returns {Promise<{ snapshot: object|null, locked: boolean }>}
 *          locked: true if another refresh was already running.
 */
export async function refreshNow(config, lockSeconds = 60) {
  const lock = await acquireLock("refresh", lockSeconds);
  if (!lock) return { snapshot: null, locked: true };
  try {
    const previous = await getSnapshot();
    const snapshot = await refreshSnapshot(config, previous);
    await saveSnapshot(snapshot);
    return { snapshot, locked: false };
  } finally {
    await releaseLock("refresh", lock);
  }
}
