/* =============================================================
   TIKTOK — Display API v2 (Login Kit + user.info.* + video.list).

   Tokens (from TikTok's docs, checked 2026-10-03):
     access token   24 hours
     refresh token  365 days, and TikTok MAY return a new one on
                    every refresh: the old one must then be replaced,
                    or the next refresh fails. That rotation is why
                    the token lives in Redis, not an env var.

   Calls per refresh:
     1  GET  /v2/user/info/     followers, total likes, video count
     N  POST /v2/video/list/    20 public videos per page (the max)
   Both are limited to 600 requests/minute; one refresh uses a few.

   Views: TikTok has no lifetime "profile views" number, so live
   views are the sum of view_count over the videos the API returns.
   That only covers videos that are public right now (deleted and
   private ones are missing), which is why the documented 57.9M
   from TikTok Studio can stay higher. The site shows the larger.

   Cover images: TikTok's cover_image_url expires after 6 hours, so
   the page loads them through /api/thumb, which fetches the current
   URL from the latest snapshot.
   ============================================================= */

import { env } from "../config.js";
import { ProviderError } from "../errors.js";
import { HttpError, requestJSON } from "../http.js";
import { getToken, saveToken } from "../store.js";

const API = "https://open.tiktokapis.com/v2";
export const TIKTOK_SCOPES = ["user.info.basic", "user.info.profile", "user.info.stats", "video.list"];

const PAGE_SIZE = 20; // video.list maximum
const MAX_PAGES = 50; // 1,000 videos: a cap so a bug can't loop forever
const REFRESH_MARGIN_MS = 10 * 60_000; // refresh when < 10 min left

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
  return {
    accessToken: data.access_token,
    accessExpiresAt: new Date(now + Number(data.expires_in || 0) * 1000).toISOString(),
    refreshToken: data.refresh_token,
    refreshExpiresAt: new Date(now + Number(data.refresh_expires_in || 0) * 1000).toISOString(),
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

    /* 1. Profile and totals. */
    const info = await requestJSON(`${API}/user/info/?fields=${USER_FIELDS}`, { headers: auth, label: "tiktok", classify });
    const user = info?.data?.user || {};

    /* 2. Every public video, newest first, 20 at a time. The cursor
          TikTok returns is a timestamp; passing it back gets the next
          (older) page. */
    const videos = [];
    let cursor;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const result = await requestJSON(`${API}/video/list/?fields=${VIDEO_FIELDS}`, {
        method: "POST",
        headers: auth,
        body: cursor === undefined ? { max_count: PAGE_SIZE } : { max_count: PAGE_SIZE, cursor },
        label: "tiktok",
        classify
      });
      videos.push(...(result?.data?.videos || []));
      if (!result?.data?.has_more) break;
      cursor = result.data.cursor;
      if (page === MAX_PAGES - 1) console.warn(`[tiktok] stopped after ${MAX_PAGES * PAGE_SIZE} videos; raise MAX_PAGES if needed.`);
    }

    let views = 0;
    for (const video of videos) views += Number(video.view_count) || 0;

    const username = user.username || "";
    return {
      result: {
        handle: username ? `@${username}` : "",
        followers: user.follower_count,
        views: videos.length ? views : null,
        viewsMethod: `sum of view_count across ${videos.length} public videos`,
        likes: user.likes_count,
        likesMethod: "total likes on the profile (TikTok's likes_count)",
        posts: user.video_count,
        topPosts: videos.map((video) => ({
          id: video.id,
          title: video.title || video.video_description || "",
          views: video.view_count,
          /* A clean permalink instead of share_url, which carries
             tracking parameters. */
          url: username ? `https://www.tiktok.com/@${encodeURIComponent(username)}/video/${encodeURIComponent(video.id)}` : "",
          /* proxied: the public snapshot links /api/thumb instead,
             because this URL dies after 6 hours. */
          thumbnail: video.cover_image_url ? { url: video.cover_image_url, proxied: true } : null
        }))
      },
      meta: { videos: videos.length }
    };
  } catch (error) {
    throw explain(error);
  }
}
