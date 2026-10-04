/* =============================================================
   FACEBOOK — a Facebook PAGE via the Graph API (v26.0).
   Personal profiles (including professional mode) have no insights
   API, so with FACEBOOK_PAGE_ID empty this provider does nothing
   and the platform shows as disabled, without calling Meta.

   Token: the connect flow trades your login for a long-lived user
   token, then asks /me/accounts for the Page's own token. A Page
   token made from a long-lived user token doesn't expire; it stops
   working only if you remove the app, lose the Page role or change
   your Facebook password. Then: reconnect.

   What it reads (docs checked 2026-10-04):
   - followers_count on the Page itself (a field, not an insights
     metric, so it survived Meta's 2025 metric cleanup).
   - The newest posts with post_media_view (the replacement for
     post_impressions), summed for live views. Meta has been retiring
     Page metrics through 2025-26: if this one is refused, the Page
     still shows followers and views fall back to "unavailable"
     instead of failing the whole platform.
   ============================================================= */

import { env } from "../config.js";
import { ProviderError } from "../errors.js";
import { HttpError, requestJSON } from "../http.js";
import { getToken } from "../store.js";

export const FB_GRAPH = "https://graph.facebook.com/v26.0";
export const FACEBOOK_SCOPES = ["pages_show_list", "pages_read_engagement", "read_insights"];

export const facebookLimits = {
  pageSize: 50,
  maxPages: 4 // newest 200 posts
};

const RECONNECT = "re-run /api/auth/facebook/start?key=ADMIN_SECRET";

function classify(status, body) {
  const code = Number(body?.error?.code);
  const reason = code ? `code ${code}` : "";
  if (code === 190 || code === 10 || (code >= 200 && code < 300)) return { reason, auth: true, retryable: false };
  if ([4, 17, 32, 613, 80001].includes(code)) return { reason, auth: false, retryable: false };
  if (code === 100) return { reason: "code 100", auth: false, retryable: false }; // invalid field/metric
  return { reason };
}

function explain(error) {
  if (error instanceof ProviderError) return error;
  if (error instanceof HttpError) {
    if (error.auth) return new ProviderError("auth", `Facebook rejected the Page token (${error.reason || error.status}): ${RECONNECT}`, { cause: error });
    if (/code (4|17|32|613|80001)\b/.test(error.reason)) return new ProviderError("rate_limit", "Facebook rate limited the refresh.", { cause: error });
    return new ProviderError("unavailable", `Facebook unavailable: ${error.message}`, { cause: error });
  }
  return new ProviderError("unavailable", `Facebook: ${error?.message || error}`, { cause: error });
}

const get = (url, token) => requestJSON(url, {
  headers: { Authorization: `Bearer ${token}` },
  label: "facebook",
  classify,
  retries: 1
});

async function postsWithViews(pageId, token) {
  const posts = [];
  const fields = "id,message,permalink_url,created_time,full_picture,insights.metric(post_media_view)";
  let url = `${FB_GRAPH}/${encodeURIComponent(pageId)}/posts?${new URLSearchParams({ fields, limit: String(facebookLimits.pageSize) })}`;
  for (let page = 0; page < facebookLimits.maxPages && url; page += 1) {
    const body = await get(url, token);
    posts.push(...(body?.data || []));
    const after = body?.paging?.cursors?.after;
    url = body?.paging?.next && after
      ? `${FB_GRAPH}/${encodeURIComponent(pageId)}/posts?${new URLSearchParams({ fields, limit: String(facebookLimits.pageSize), after })}`
      : "";
  }
  return posts;
}

const viewsOf = (post) => {
  const metric = post?.insights?.data?.find((item) => item.name === "post_media_view") || post?.insights?.data?.[0];
  const value = metric?.values?.[0]?.value ?? metric?.total_value?.value;
  return Number.isFinite(Number(value)) ? Number(value) : null;
};

export async function fetchFacebook() {
  const pageId = env("FACEBOOK_PAGE_ID");
  if (!pageId) throw new ProviderError("config", "Facebook disabled: FACEBOOK_PAGE_ID is empty (only Pages have an insights API).");

  try {
    const record = await getToken("facebook");
    if (!record?.pageToken) throw new ProviderError("config", `Facebook Page not connected yet: ${RECONNECT}`);
    if (record.pageId !== pageId) {
      throw new ProviderError("config", `Facebook: connected Page ${record.pageId} differs from FACEBOOK_PAGE_ID; ${RECONNECT}`);
    }
    const token = record.pageToken;

    const page = await get(`${FB_GRAPH}/${encodeURIComponent(pageId)}?fields=name,username,link,followers_count`, token);

    /* Views are best effort: a retired metric (code 100) mustn't
       hide the followers we already have. */
    let posts = [];
    let viewsNote = "";
    try {
      posts = await postsWithViews(pageId, token);
    } catch (error) {
      if (error instanceof HttpError && error.auth) throw error;
      viewsNote = error instanceof HttpError ? error.reason || `HTTP ${error.status}` : "error";
      console.warn(`[facebook] post views unavailable (${viewsNote}); showing followers only.`);
    }

    const withViews = posts.map((post) => [post, viewsOf(post)]).filter(([, views]) => views !== null);
    const views = withViews.reduce((sum, [, v]) => sum + v, 0);

    return {
      result: {
        handle: page.username ? `@${page.username}` : page.name || "",
        followers: page.followers_count,
        views: withViews.length ? views : null,
        viewsMethod: withViews.length
          ? `sum of post_media_view across the newest ${withViews.length} Page posts`
          : "post views unavailable from Meta right now",
        likes: null,
        likesMethod: "",
        posts: null, // the Graph API has no total post count for a Page
        topPosts: withViews.map(([post, v]) => ({
          id: String(post.id).replace(/[^A-Za-z0-9_-]/g, "_"),
          title: post.message || "",
          views: v,
          url: post.permalink_url,
          thumbnail: post.full_picture ? { url: post.full_picture, proxied: true } : null
        }))
      },
      meta: { posts: posts.length }
    };
  } catch (error) {
    throw explain(error);
  }
}
