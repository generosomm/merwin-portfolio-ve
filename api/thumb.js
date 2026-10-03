/* =============================================================
   GET /api/thumb?p=tiktok&id=<postId>

   Stable image links for platforms whose thumbnail URLs expire
   (TikTok covers die after 6 hours; Instagram's CDN links also
   rotate). The page links here; this looks the post up in the
   latest snapshot and streams its current image.

   Safety:
   - It never takes a URL from the visitor. It only serves images
     of posts already in the snapshot, by platform + post ID, so it
     can't be used to fetch arbitrary addresses (SSRF).
   - The stored image URL must be https on a known image CDN.
   - Only image/* responses under 2 MB are passed through.
   - Cached for at most 6 hours, matching TikTok's TTL for covers.
   ============================================================= */

import { getSnapshot, storageConfigured } from "../lib/store.js";

const PLATFORMS = new Set(["tiktok", "instagram", "facebook"]);
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_BYTES = 2 * 1024 * 1024;

/* Image hosts each platform serves covers from. A URL in the
   snapshot on any other host is refused. */
const ALLOWED_HOSTS = [
  /\.tiktokcdn\.com$/,
  /\.tiktokcdn-us\.com$/,
  /\.tiktokcdn-eu\.com$/,
  /\.ibyteimg\.com$/,
  /\.cdninstagram\.com$/,
  /\.fbcdn\.net$/
];

const CACHE_OK = "public, max-age=3600, s-maxage=21600";
const CACHE_MISS = "public, max-age=60, s-maxage=300";

function notFound(reason) {
  return new Response(null, {
    status: 404,
    headers: { "Cache-Control": CACHE_MISS, "X-Thumb-Reason": reason }
  });
}

function allowed(source) {
  try {
    const url = new URL(source);
    return url.protocol === "https:" && ALLOWED_HOSTS.some((pattern) => pattern.test(url.hostname));
  } catch {
    return false;
  }
}

export default {
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
    }

    const params = new URL(request.url).searchParams;
    const platform = params.get("p") || "";
    const id = params.get("id") || "";
    if (!PLATFORMS.has(platform) || !SAFE_ID.test(id)) return notFound("bad-params");
    if (!storageConfigured()) return notFound("no-storage");

    let source = "";
    try {
      const snapshot = await getSnapshot();
      const post = snapshot?.platforms?.[platform]?.topPosts?.find((p) => p.id === id);
      source = post?._thumbSource || "";
    } catch (error) {
      console.error(`[thumb] snapshot read failed: ${error.message}`);
      return notFound("storage-error");
    }
    if (!source) return notFound("unknown-post");
    if (!allowed(source)) {
      console.warn(`[thumb] refused ${platform}/${id}: host not on the image CDN allow-list`);
      return notFound("host-not-allowed");
    }

    let upstream;
    try {
      /* redirect: "error" so a redirect can't lead off the allow-list. */
      upstream = await fetch(source, { signal: AbortSignal.timeout(8_000), redirect: "error" });
    } catch {
      return notFound("upstream-unreachable");
    }

    const type = upstream.headers.get("content-type") || "";
    const length = Number(upstream.headers.get("content-length") || 0);
    if (!upstream.ok || !type.startsWith("image/") || length > MAX_BYTES) {
      return notFound(upstream.ok ? "not-an-image" : `upstream-${upstream.status}`);
    }

    const bytes = await upstream.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) return notFound("too-large");

    return new Response(request.method === "HEAD" ? null : bytes, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Cache-Control": CACHE_OK,
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-site"
      }
    });
  }
};
