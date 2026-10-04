/* =============================================================
   INSTAGRAM — Instagram API with Instagram Login (graph.instagram.com).
   Needs a Professional account (Creator or Business); no Facebook
   Page required. Scopes: instagram_business_basic +
   instagram_business_manage_insights. (Docs checked 2026-10-04.)

   Tokens: Instagram Login gives a 1-hour token, which the connect
   flow swaps for a LONG-LIVED one (60 days). A long-lived token can
   be renewed once it's 24 h old; this provider renews it when it's
   older than a week, so with any traffic (or the daily cron) it
   never gets near expiry. A token left unrenewed for 60 days dies,
   and then you reconnect.

   What the API gives (and doesn't):
   - followers_count and media_count on the profile.
   - Per post: like_count, permalink, thumbnail. NOT the caption
     (Instagram Login doesn't expose it) and NOT a view count field.
   - Views only through insights, one request per post
     (GET /{media}/insights?metric=views), kept by Meta for 2 years,
     and not available for posts inside carousels.
   So, like TikTok, the posts live in an INDEX in Redis that a few
   refreshes fill in: each refresh lists new posts and fetches views
   for up to VIEWS_PER_RUN posts (those never fetched first, then the
   least recently fetched). Live views = the sum of indexed views,
   marked partial until every post has been fetched once.
   ============================================================= */

import { env } from "../config.js";
import { ProviderError } from "../errors.js";
import { HttpError, requestJSON } from "../http.js";
import { KEYS, getJSON, getToken, saveToken, setJSON } from "../store.js";

export const IG_GRAPH = "https://graph.instagram.com/v26.0";
export const INSTAGRAM_SCOPES = ["instagram_business_basic", "instagram_business_manage_insights"];

export const instagramLimits = {
  pageSize: 50, // media per list call
  pagesPerRun: 3, // older list pages walked per refresh, after the newest one
  viewsPerRun: 24, // insights calls per refresh
  concurrency: 4, // insights calls in flight at once
  timeBudgetMs: 15_000,
  renewAfterMs: 7 * 24 * 60 * 60_000 // renew the 60-day token weekly
};

const RECONNECT = "re-run /api/auth/instagram/start?key=ADMIN_SECRET";
const MEDIA_FIELDS = "id,media_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count";

/* Meta's errors: { error: { message, type, code, error_subcode } }.
   190 = token invalid/expired, 10/200-299 = permission missing,
   4/17/32/613 = rate limited. */
function classify(status, body) {
  const code = Number(body?.error?.code);
  const reason = code ? `code ${code}` : "";
  if (code === 190 || code === 10 || (code >= 200 && code < 300)) return { reason, auth: true, retryable: false };
  if ([4, 17, 32, 613].includes(code)) return { reason, auth: false, retryable: false };
  return { reason };
}

function explain(error) {
  if (error instanceof ProviderError) return error;
  if (error instanceof HttpError) {
    if (error.auth) return new ProviderError("auth", `Instagram rejected the token (${error.reason || error.status}): ${RECONNECT}`, { cause: error });
    if (/code (4|17|32|613)\b/.test(error.reason)) return new ProviderError("rate_limit", "Instagram rate limited the refresh.", { cause: error });
    return new ProviderError("unavailable", `Instagram unavailable: ${error.message}`, { cause: error });
  }
  return new ProviderError("unavailable", `Instagram: ${error?.message || error}`, { cause: error });
}

const get = (url, token) => requestJSON(url, {
  headers: { Authorization: `Bearer ${token}` },
  label: "instagram",
  classify,
  retries: 1
});

/* ---- Tokens ---------------------------------------------------------- */

/** The record we store after the connect flow or a renewal. */
export function instagramTokenRecord(data, extra = {}, now = Date.now()) {
  const seconds = Number(data.expires_in) || 60 * 24 * 60 * 60;
  return {
    accessToken: data.access_token,
    accessExpiresAt: new Date(now + seconds * 1000).toISOString(),
    renewedAt: new Date(now).toISOString(),
    ...extra
  };
}

async function validToken() {
  const record = await getToken("instagram");
  if (!record?.accessToken) throw new ProviderError("config", `Instagram not connected yet: ${RECONNECT}`);

  const now = Date.now();
  if (new Date(record.accessExpiresAt) <= now) throw new ProviderError("auth", `Instagram token expired: ${RECONNECT}`);

  const age = now - new Date(record.renewedAt || record.connectedAt || 0);
  if (age < instagramLimits.renewAfterMs) return record;

  /* Renew: same token in, fresh 60 days out. Failing here isn't fatal
     while the current token still works; we'll try again next time. */
  try {
    const data = await requestJSON(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(record.accessToken)}`, { label: "instagram", classify, retries: 1 });
    if (data?.access_token) {
      const next = { ...record, ...instagramTokenRecord(data, {}, now) };
      await saveToken("instagram", next);
      return next;
    }
  } catch (error) {
    console.warn(`[instagram] token renewal failed (${error.message}); the current token is still valid until ${record.accessExpiresAt}.`);
  }
  return record;
}

/* ---- The post index ---------------------------------------------------
   { pass, cursor, lastFullPassAt, media: { id: { v, l, c, p, t, at, x, s } } }
   v views (null until fetched) · l likes · c thumbnail URL · p permalink
   t media type · at when views were last fetched · x views unavailable
   s the list pass it was last seen in (to drop deleted posts) */

function newIndex() {
  return { pass: 1, cursor: null, lastFullPassAt: null, media: {} };
}

/* The list walk reached the oldest post: drop posts not seen during
   this pass (deleted or archived) and start the next pass. */
function finishPass(index) {
  for (const [id, entry] of Object.entries(index.media)) {
    if ((entry.s || 0) < index.pass) delete index.media[id];
  }
  index.pass = (index.pass || 1) + 1;
  index.cursor = null;
  index.lastFullPassAt = new Date().toISOString();
}

function upsert(index, items) {
  for (const item of items || []) {
    if (!item?.id) continue;
    const previous = index.media[item.id] || {};
    index.media[item.id] = {
      v: previous.v ?? null,
      at: previous.at ?? null,
      x: previous.x ?? false,
      l: Number(item.like_count) || 0,
      c: item.thumbnail_url || item.media_url || "",
      p: item.permalink || "",
      t: item.media_type || "",
      s: index.pass
    };
  }
}

async function walkList(index, token, deadline) {
  const list = (after) => {
    const params = new URLSearchParams({ fields: MEDIA_FIELDS, limit: String(instagramLimits.pageSize) });
    if (after) params.set("after", after);
    return get(`${IG_GRAPH}/me/media?${params}`, token);
  };

  try {
    /* Newest page every time (new posts appear here first). */
    const first = await list(null);
    upsert(index, first?.data);
    let after = index.cursor ?? first?.paging?.cursors?.after ?? null;
    if (!first?.paging?.next) {
      finishPass(index);
      return;
    }

    for (let walked = 0; walked < instagramLimits.pagesPerRun && Date.now() < deadline; walked += 1) {
      const page = await list(after);
      upsert(index, page?.data);
      if (!page?.paging?.next) {
        finishPass(index);
        return;
      }
      after = page.paging.cursors?.after ?? null;
      index.cursor = after;
    }
  } catch (error) {
    if (error instanceof HttpError && error.auth) throw error;
    if (!Object.keys(index.media).length) throw error;
    console.warn(`[instagram] post list paused (${error.message}); continuing next refresh.`);
  }
}

/* Views for one post. Returns a number, or null if Meta has none for
   it (too old, inside a carousel, etc.). */
async function viewsFor(id, token) {
  try {
    const body = await get(`${IG_GRAPH}/${encodeURIComponent(id)}/insights?metric=views`, token);
    const metric = body?.data?.[0];
    const value = metric?.total_value?.value ?? metric?.values?.[0]?.value;
    return Number.isFinite(Number(value)) ? Number(value) : null;
  } catch (error) {
    if (error instanceof HttpError && error.auth) throw error;
    if (error instanceof HttpError && error.status === 400) return null; // metric not supported for this post
    throw error;
  }
}

async function fetchViews(index, token, deadline) {
  const entries = Object.entries(index.media);
  /* Never-fetched first, then the least recently fetched. */
  const queue = entries
    .filter(([, m]) => !m.x) // posts Meta has no views for aren't asked again
    .sort(([, a], [, b]) => {
      if (a.at === b.at) return 0;
      if (a.at === null) return -1;
      if (b.at === null) return 1;
      return String(a.at).localeCompare(String(b.at));
    })
    .slice(0, instagramLimits.viewsPerRun)
    .map(([id]) => id);

  let next = 0;
  const worker = async () => {
    while (next < queue.length && Date.now() < deadline) {
      const id = queue[next++];
      try {
        const views = await viewsFor(id, token);
        const entry = index.media[id];
        entry.at = new Date().toISOString();
        if (views === null) entry.x = true;
        else {
          entry.v = views;
          entry.x = false;
        }
      } catch (error) {
        if (error instanceof HttpError && error.auth) throw error;
        return; // rate limit or outage: stop this worker, keep what we have
      }
    }
  };
  await Promise.all(Array.from({ length: instagramLimits.concurrency }, worker));
}

export async function fetchInstagram() {
  try {
    const token = (await validToken()).accessToken;
    const deadline = Date.now() + instagramLimits.timeBudgetMs;

    const profileBody = await get(`${IG_GRAPH}/me?fields=user_id,username,followers_count,media_count`, token);
    const profile = profileBody?.data?.[0] || profileBody || {};

    const index = (await getJSON(KEYS.index("instagram"))) || newIndex();
    await walkList(index, token, deadline);
    await fetchViews(index, token, deadline);
    await setJSON(KEYS.index("instagram"), index);

    const media = Object.entries(index.media);
    const withViews = media.filter(([, m]) => m.v !== null);
    const views = withViews.reduce((sum, [, m]) => sum + m.v, 0);
    const pending = media.filter(([, m]) => m.v === null && !m.x).length;
    const total = Number(profile.media_count) || media.length;
    const partial = pending > 0 || !index.lastFullPassAt;

    return {
      result: {
        handle: profile.username ? `@${profile.username}` : "",
        followers: profile.followers_count,
        views: withViews.length ? views : null,
        viewsMethod: partial
          ? `partial: sum of post views across ${withViews.length} of ${total} posts fetched so far`
          : `sum of post views across ${withViews.length} posts (Meta keeps 2 years; carousels excluded)`,
        likes: media.reduce((sum, [, m]) => sum + (m.l || 0), 0),
        likesMethod: `sum of like_count across ${media.length} posts`,
        posts: profile.media_count,
        topPosts: withViews.map(([id, m]) => ({
          id,
          title: "", // Instagram Login doesn't expose captions
          views: m.v,
          url: m.p,
          /* Instagram's CDN links expire too: served through /api/thumb. */
          thumbnail: m.c ? { url: m.c, proxied: true } : null
        }))
      },
      meta: { indexed: media.length }
    };
  } catch (error) {
    throw explain(error);
  }
}
