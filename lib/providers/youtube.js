/* =============================================================
   YOUTUBE — YouTube Data API v3, public data, API key only.

   Calls per refresh (each costs 1 quota unit; 10,000 free a day):
     1  channels.list        lifetime views, subscribers, video
                             count, and the "uploads" playlist ID
     N  playlistItems.list   every upload's video ID, 50 per page
     N  videos.list          per-video views and likes, 50 IDs per
                             call (the API's maximum)
   So 500 videos ≈ 1 + 10 + 10 = 21 units. Refreshing every 30 min
   is ~1,000 units a day.

   Views come from the channel's own lifetime viewCount, not from
   summing videos: it is YouTube's authoritative total and includes
   deleted and private videos that a sum would miss. Since 30 April
   2025 the API counts a Shorts view every time one starts or
   replays, so this can run ahead of older Studio screenshots.

   search.list is never used: it costs from a separate, much
   smaller quota and isn't needed when the uploads playlist exists.
   ============================================================= */

import { env } from "../config.js";
import { ProviderError } from "../errors.js";
import { HttpError, requestJSON } from "../http.js";

const API = "https://www.googleapis.com/youtube/v3";
const PAGE_SIZE = 50;
const MAX_VIDEOS = 1000; // 20 pages; a sane cap that still covers the whole channel today

/* YouTube answers 403 for both "bad key" and "out of quota", so the
   status code alone can't tell them apart: read the reason. */
const QUOTA_REASONS = new Set(["quotaExceeded", "dailyLimitExceeded"]);
const RATE_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded"]);
const KEY_REASONS = new Set(["keyInvalid", "keyExpired", "API_KEY_INVALID", "accessNotConfigured", "forbidden", "ipRefererBlocked"]);

function classify(status, body) {
  const reason = body?.error?.errors?.[0]?.reason || body?.error?.status || "";
  if (QUOTA_REASONS.has(reason)) return { reason, auth: false, retryable: false };
  if (RATE_REASONS.has(reason)) return { reason, auth: false, retryable: true };
  if (KEY_REASONS.has(reason) || (status === 400 && /api key/i.test(body?.error?.message || ""))) {
    return { reason, auth: true, retryable: false };
  }
  return { reason };
}

/* Turn a low-level HTTP failure into a ProviderError with a log
   message that says what to do about it. */
function explain(error) {
  if (!(error instanceof HttpError)) return error;
  if (error.auth) {
    return new ProviderError("auth", `YouTube API key rejected (${error.reason || error.status}): check YOUTUBE_API_KEY in Vercel and that "YouTube Data API v3" is enabled for it.`, { cause: error });
  }
  if (QUOTA_REASONS.has(error.reason)) {
    return new ProviderError("rate_limit", "YouTube daily quota used up: serving the last good numbers until it resets (midnight Pacific).", { cause: error });
  }
  if (error.status === 429 || RATE_REASONS.has(error.reason)) {
    return new ProviderError("rate_limit", `YouTube rate limited the refresh (${error.message}).`, { cause: error });
  }
  return new ProviderError("unavailable", `YouTube unavailable: ${error.message}`, { cause: error });
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * @returns {Promise<{ result: object, meta: { quotaUnits: number } }>}
 */
export async function fetchYouTube() {
  const key = env("YOUTUBE_API_KEY");
  const channelId = env("YOUTUBE_CHANNEL_ID");
  if (!key || !channelId) {
    throw new ProviderError("config", "YouTube not configured: set YOUTUBE_API_KEY and YOUTUBE_CHANNEL_ID in Vercel.");
  }

  let quotaUnits = 0;
  const get = (resource, params) => {
    quotaUnits += 1;
    const query = new URLSearchParams({ ...params, key });
    return requestJSON(`${API}/${resource}?${query}`, { label: "youtube", classify });
  };

  try {
    /* 1. Channel totals + uploads playlist. "fields" trims the
          response to what we use: smaller and faster. */
    const channels = await get("channels", {
      part: "snippet,statistics,contentDetails",
      id: channelId,
      fields: "items(snippet(title,customUrl),statistics(viewCount,subscriberCount,hiddenSubscriberCount,videoCount),contentDetails/relatedPlaylists/uploads)"
    });
    const channel = channels?.items?.[0];
    if (!channel) {
      throw new ProviderError("config", `YouTube: no channel found for YOUTUBE_CHANNEL_ID "${channelId}" (it should start with "UC").`);
    }
    const stats = channel.statistics || {};
    const uploads = channel.contentDetails?.relatedPlaylists?.uploads;

    /* 2. Every upload's video ID, page by page. */
    const ids = [];
    let pageToken = "";
    while (uploads && ids.length < MAX_VIDEOS) {
      const page = await get("playlistItems", {
        part: "contentDetails",
        playlistId: uploads,
        maxResults: PAGE_SIZE,
        fields: "nextPageToken,items/contentDetails/videoId",
        ...(pageToken ? { pageToken } : {})
      });
      for (const item of page?.items || []) {
        if (item?.contentDetails?.videoId) ids.push(item.contentDetails.videoId);
      }
      pageToken = page?.nextPageToken || "";
      if (!pageToken) break;
    }
    if (ids.length >= MAX_VIDEOS) console.warn(`[youtube] stopped at ${MAX_VIDEOS} videos; raise MAX_VIDEOS if the channel grows past it.`);

    /* 3. Per-video stats, 50 IDs per call. */
    const videos = [];
    for (const group of chunk(ids.slice(0, MAX_VIDEOS), PAGE_SIZE)) {
      const page = await get("videos", {
        part: "snippet,statistics",
        id: group.join(","),
        maxResults: PAGE_SIZE,
        fields: "items(id,snippet(title,thumbnails/medium),statistics(viewCount,likeCount))"
      });
      videos.push(...(page?.items || []));
    }

    /* Likes: only videos that show their like count publicly. */
    let likes = null;
    for (const video of videos) {
      const count = Number(video.statistics?.likeCount);
      if (Number.isFinite(count)) likes = (likes ?? 0) + count;
    }

    return {
      result: {
        handle: channel.snippet?.customUrl || "",
        /* The API rounds public subscriber counts to 3 significant
           figures; hidden counts come back as null. */
        followers: stats.hiddenSubscriberCount ? null : stats.subscriberCount,
        followersLabel: "subscribers",
        views: stats.viewCount,
        viewsMethod: "lifetime channel viewCount",
        likes,
        likesMethod: likes === null ? "" : `sum of public likeCount across ${videos.length} public videos`,
        posts: stats.videoCount,
        /* YouTube's thumbnail URLs are stable, so no proxy needed. */
        topPosts: videos.map((video) => ({
          id: video.id,
          title: video.snippet?.title,
          views: video.statistics?.viewCount,
          url: `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`,
          thumbnail: video.snippet?.thumbnails?.medium || null
        }))
      },
      meta: { quotaUnits }
    };
  } catch (error) {
    /* Attach the units spent before the failure so they are still counted. */
    const wrapped = explain(error);
    wrapped.quotaUnits = quotaUnits;
    throw wrapped;
  }
}
