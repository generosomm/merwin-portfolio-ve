/* =============================================================
   TIKTOK — Display API v2 (Login Kit + user.info.* + video.list).

   Tokens (from TikTok's docs, checked 2026-10-03):
     access token   24 hours
     refresh token  365 days, and TikTok MAY return a new one on
                    every refresh: the old one must then be replaced,
                    or the next refresh fails. That rotation is why
                    the token lives in Redis, not an env var.

   Views: TikTok has no lifetime "profile views" number, so live
   views are the sum of view_count over the account's public videos
   (deleted and private ones are missing, which is why the documented
   57.9M from TikTok Studio can stay higher; the site shows the larger).

   Big accounts: video.list returns 20 videos per call, so hundreds
   of videos means dozens of calls, too slow for one function run and
   enough to trip the sandbox's rate limit (seen on 2026-10-03). So
   the videos live in an INDEX in Redis, updated a little each refresh:

     every refresh   newest page (20 videos: these change fastest)
                     + up to pagesPerRun more pages, continuing
                       from where the last refresh stopped
                     + one video/query for the top posts, to renew
                       their cover URLs (TikTok expires them after 6 h)
     end of a pass   when the walk reaches the oldest video, videos
                     not seen during that pass (deleted or made
                     private) are dropped and the walk starts over

   A rate limit or slow response mid-walk keeps whatever was fetched;
   the next refresh carries on. Until the first full pass finishes,
   the sum is marked partial (the documented number usually wins then).

   Calls per refresh: 1 user/info + 1..7 video/list + 1 video/query,
   far below TikTok's 600 requests/minute.

   Cover images: the page loads them through /api/thumb, which
   fetches the current URL from the latest snapshot.
   ============================================================= */

import { env } from "../config.js";
import { ProviderError } from "../errors.js";
import { HttpError, requestJSON } from "../http.js";
import { KEYS, getJSON, getToken, saveToken, setJSON } from "../store.js";

const API = "https://open.tiktokapis.com/v2";
export const TIKTOK_SCOPES = ["user.info.basic", "user.info.profile", "user.info.stats", "video.list"];

/* Tunable, and exported so the tests can shrink them. */
export const tiktokLimits = {
  pageSize: 20, // video.list maximum
  pagesPerRun: 6, // older pages walked per refresh, after the newest one
  timeBudgetMs: 15_000, // stop walking after this, well inside the 25 s provider cap
  topQuery: 6 // top posts whose covers and views are renewed each run
};

const REFRESH_MARGIN_MS = 10 * 60_000; // refresh the access token when < 10 min left
const DEFAULT_REFRESH_LIFETIME_S = 365 * 24 * 60 * 60; // documented, used if TikTok omits it

const USER_FIELDS = "open_id,username,display_name,follower_count,likes_count,video_count";
const VIDEO_FIELDS = "id,title,video_description,cover_image_url,view_count,like_count,create_time";

const RECONNECT = "re-run /api/auth/tiktok/start?key=ADMIN_SECRET";

/* TikTok wraps every API answer in { data, error: { code, message } }
   where code is "ok" on success. Errors arrive with the matching HTTP
   status (401 access_token_invalid / scope_not_authorized, 429
   rate_limit_exceeded, 500 internal_error). */
function classify(status, body) {
  const reason = body?.error?.code || body?.error || "";
  if (reason === "access_token_invalid" || reason === "scope_not_authorized" || reason === "invalid_grant") {
    return { reason, auth: true, retryable: false };
  }
  if (reason === "rate_limit_exceeded") return { reason, auth: false, retryable: true };
  return { reason };
}

function credentials() {
  const clientKey = env("TIKTOK_CLIENT_KEY");
  const clientSecret = env("TIKTOK_CLIENT_SECRET");
  if (!clientKey || !clientSecret) {
    throw new ProviderError("config", "TikTok not configured: set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in Vercel.");
  }
  return { clientKey, clientSecret };
}

/** The token endpoint, for both grant types. Form-encoded, as TikTok requires. */
export async function requestTikTokToken(params) {
  const { clientKey, clientSecret } = credentials();
  const body = new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, ...params });
  const data = await requestJSON(`${API}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body,
    label: "tiktok",
    classify,
    retries: 1
  });
  /* Token errors can come back with HTTP 200 and an "error" field. */
  if (!data?.access_token) {
    const reason = data?.error || "no_access_token";
    throw new HttpError(`tiktok: token request failed (${reason})`, { status: 200, reason, auth: reason === "invalid_grant", body: data });
  }
  return data;
}

/** Turn a token response into the record we store. */
export function tokenRecord(data, now = Date.now()) {
  const accessSeconds = Number(data.expires_in) || 24 * 60 * 60;
  const refreshSeconds = Number(data.refresh_expires_in) || DEFAULT_REFRESH_LIFETIME_S;
  return {
    accessToken: data.access_token,
    accessExpiresAt: new Date(now + accessSeconds * 1000).toISOString(),
    refreshToken: data.refresh_token,
    refreshExpiresAt: new Date(now + refreshSeconds * 1000).toISOString(),
    openId: data.open_id || "",
    scope: String(data.scope || ""),
    savedAt: new Date(now).toISOString()
  };
}

/* Load the stored token and refresh it if it's about to expire. */
async function validToken() {
  const record = await getToken("tiktok");
  if (!record?.refreshToken) {
    throw new ProviderError("config", `TikTok not connected yet: ${RECONNECT}`);
  }

  const now = Date.now();
  if (new Date(record.refreshExpiresAt) <= now) {
    throw new ProviderError("auth", `TikTok refresh token expired: ${RECONNECT}`);
  }
  if (new Date(record.accessExpiresAt) - now > REFRESH_MARGIN_MS) return record;

  /* Access token (nearly) expired: swap the refresh token for a new pair. */
  let data;
  try {
    data = await requestTikTokToken({ grant_type: "refresh_token", refresh_token: record.refreshToken });
  } catch (error) {
    if (error instanceof HttpError && (error.auth || error.status === 400)) {
      throw new ProviderError("auth", `TikTok token refresh rejected (${error.reason || error.status}): ${RECONNECT}`, { cause: error });
    }
    throw error;
  }
  const next = { ...tokenRecord(data, now), connectedAt: record.connectedAt || record.savedAt };
  await saveToken("tiktok", next); // save BEFORE using it: the old refresh token may now be dead
  return next;
}

function explain(error) {
  if (error instanceof ProviderError) return error;
  if (error instanceof HttpError) {
    if (error.auth) return new ProviderError("auth", `TikTok rejected the access token (${error.reason || error.status}): ${RECONNECT}`, { cause: error });
    if (error.status === 429) return new ProviderError("rate_limit", "TikTok rate limited the refresh.", { cause: error });
    return new ProviderError("unavailable", `TikTok unavailable: ${error.message}`, { cause: error });
  }
  return new ProviderError("unavailable", `TikTok: ${error?.message || error}`, { cause: error });
}

export async function fetchTikTok() {
  try {
    const token = await validToken();
    const auth = { Authorization: `Bearer ${token.accessToken}` };
    const deadline = Date.now() + tiktokLimits.timeBudgetMs;

    /* 1. Profile and totals. If this fails, the whole refresh fails. */
    const info = await requestJSON(`${API}/user/info/?fields=${USER_FIELDS}`, { headers: auth, label: "tiktok", classify });
    const user = info?.data?.user || {};
    const username = user.username || "";

    /* 2. Update the video index, then renew the top posts. */
    const index = (await getJSON(KEYS.index("tiktok"))) || newIndex();
    const walk = await updateIndex(index, auth, deadline);
    await refreshTop(index, auth, deadline);
    await setJSON(KEYS.index("tiktok"), index);

    const entries = Object.entries(index.videos);
    let views = 0;
    for (const [, video] of entries) views += video.v || 0;
    const total = Number(user.video_count) || entries.length;
    const partial = !index.lastFullPassAt;

    if (walk.stoppedEarly) {
      console.warn(`[tiktok] index walk paused (${walk.reason}); ${entries.length} videos indexed, continuing next refresh.`);
    }

    return {
      result: {
        handle: username ? `@${username}` : "",
        followers: user.follower_count,
        views: entries.length ? views : null,
        viewsMethod: partial
          ? `partial: sum of view_count across the first ${entries.length} of ${total} public videos indexed so far`
          : `sum of view_count across ${entries.length} public videos`,
        likes: user.likes_count,
        likesMethod: "total likes on the profile (TikTok's likes_count)",
        posts: user.video_count,
        topPosts: entries.map(([id, video]) => ({
          id,
          title: video.t,
          views: video.v,
          /* A clean permalink instead of share_url, which carries
             tracking parameters. */
          url: username ? `https://www.tiktok.com/@${encodeURIComponent(username)}/video/${encodeURIComponent(id)}` : "",
          /* proxied: the public snapshot links /api/thumb instead,
             because this URL dies after 6 hours. */
          thumbnail: video.c ? { url: video.c, proxied: true } : null
        }))
      },
      meta: { indexed: entries.length, pagesFetched: walk.pages }
    };
  } catch (error) {
    throw explain(error);
  }
}

/* ---- The video index --------------------------------------------------
   { pass, cursor, lastFullPassAt, videos: { id: { v, t, c, s } } }
   v views · t title · c cover URL · s the pass it was last seen in.
   Short keys because the whole index is one Redis value. */

function newIndex() {
  return { pass: 1, cursor: null, lastFullPassAt: null, videos: {} };
}

/* Videos from the walk (video.list): add or update, and mark them as
   seen in this pass. */
function upsert(index, videos) {
  for (const video of videos || []) {
    if (!video?.id) continue;
    index.videos[video.id] = {
      v: Number(video.view_count) || 0,
      t: String(video.title || video.video_description || "").slice(0, 150),
      c: video.cover_image_url || "",
      s: index.pass
    };
  }
}

/* Videos from the top-post query: update views and cover only. They
   don't count as "seen", so a deleted top video still drops out at
   the end of the pass instead of being kept alive by this query. */
function renew(index, videos) {
  for (const video of videos || []) {
    const entry = index.videos[video?.id];
    if (!entry) continue;
    entry.v = Number(video.view_count) || entry.v;
    entry.c = video.cover_image_url || entry.c;
  }
}

/* A pass reached the oldest video: forget videos that weren't seen
   in it (deleted or made private), and start the next pass. */
function finishPass(index) {
  for (const [id, video] of Object.entries(index.videos)) {
    if (video.s < index.pass) delete index.videos[id];
  }
  index.pass += 1;
  index.cursor = null;
  index.lastFullPassAt = new Date().toISOString();
}

async function listPage(auth, cursor) {
  const body = cursor === null || cursor === undefined
    ? { max_count: tiktokLimits.pageSize }
    : { max_count: tiktokLimits.pageSize, cursor };
  const result = await requestJSON(`${API}/video/list/?fields=${VIDEO_FIELDS}`, {
    method: "POST",
    headers: auth,
    body,
    label: "tiktok",
    classify,
    retries: 0 // a rate limit mid-walk just ends this run's walk
  });
  return { videos: result?.data?.videos || [], cursor: result?.data?.cursor, hasMore: Boolean(result?.data?.has_more) };
}

async function updateIndex(index, auth, deadline) {
  let pages = 0;
  try {
    /* Newest page every time: recent videos gain views fastest. */
    const first = await listPage(auth, null);
    pages += 1;
    upsert(index, first.videos);
    if (!first.hasMore) {
      finishPass(index); // the whole account fits in one page
      return { pages, stoppedEarly: false };
    }

    /* Continue the walk where the last refresh stopped. */
    let cursor = index.cursor ?? first.cursor;
    for (let walked = 0; walked < tiktokLimits.pagesPerRun; walked += 1) {
      if (Date.now() > deadline) return { pages, stoppedEarly: true, reason: "time budget" };
      const page = await listPage(auth, cursor);
      pages += 1;
      upsert(index, page.videos);
      if (!page.hasMore) {
        finishPass(index);
        return { pages, stoppedEarly: false };
      }
      cursor = page.cursor;
      index.cursor = cursor;
    }
    return { pages, stoppedEarly: false };
  } catch (error) {
    /* Auth errors must surface. Anything else just pauses the walk,
       unless we have nothing at all to show yet. */
    if (error instanceof HttpError && error.auth) throw error;
    if (!Object.keys(index.videos).length) throw error;
    return { pages, stoppedEarly: true, reason: error instanceof HttpError ? error.reason || `HTTP ${error.status}` : "error" };
  }
}

async function refreshTop(index, auth, deadline) {
  const ids = Object.entries(index.videos)
    .sort(([, a], [, b]) => b.v - a.v)
    .slice(0, tiktokLimits.topQuery)
    .map(([id]) => id);
  if (!ids.length || Date.now() > deadline) return;
  try {
    const result = await requestJSON(`${API}/video/query/?fields=${VIDEO_FIELDS}`, {
      method: "POST",
      headers: auth,
      body: { filters: { video_ids: ids } },
      label: "tiktok",
      classify,
      retries: 0
    });
    renew(index, result?.data?.videos);
  } catch (error) {
    if (error instanceof HttpError && error.auth) throw error;
    console.warn(`[tiktok] couldn't renew top post covers this time (${error.message}).`);
  }
}
