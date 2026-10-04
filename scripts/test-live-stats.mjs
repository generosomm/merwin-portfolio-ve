import assert from "node:assert/strict";
import process from "node:process";

/* =============================================================
   Live stats backend tests: no network, no keys, no packages.
   Run with:  node scripts/test-live-stats.mjs

   global fetch is replaced by a fake that plays YouTube, TikTok and
   an in-memory Upstash Redis, so every failure case (expired key,
   API down, rate limited, storage empty or down, lock held) can be
   reproduced on demand.
   ============================================================= */

/* ---- Fake Upstash Redis ---------------------------------------- */
const redis = new Map();
let redisDown = false;

function runRedis([name, ...args]) {
  switch (name.toUpperCase()) {
    case "PING": return "PONG";
    case "GET": return redis.get(args[0]) ?? null;
    case "SET": {
      const [key, value, ...flags] = args;
      if (flags.map((f) => f.toUpperCase()).includes("NX") && redis.has(key)) return null;
      redis.set(key, value);
      return "OK";
    }
    case "DEL": return redis.delete(args[0]) ? 1 : 0;
    case "GETDEL": {
      const value = redis.get(args[0]) ?? null;
      redis.delete(args[0]);
      return value;
    }
    case "INCRBY": {
      const next = (Number(redis.get(args[0])) || 0) + Number(args[1]);
      redis.set(args[0], String(next));
      return next;
    }
    case "EXPIRE": return 1;
    case "INCR": {
      const next = (Number(redis.get(args[0])) || 0) + 1;
      redis.set(args[0], String(next));
      return next;
    }
    case "SADD": {
      const set = redis.get(args[0]) instanceof Set ? redis.get(args[0]) : new Set();
      const added = set.has(args[1]) ? 0 : 1;
      set.add(args[1]);
      redis.set(args[0], set);
      return added;
    }
    case "HSET": {
      const hash = redis.get(args[0]) instanceof Map ? redis.get(args[0]) : new Map();
      hash.set(args[1], args[2]);
      redis.set(args[0], hash);
      return 1;
    }
    case "HGETALL": {
      const hash = redis.get(args[0]);
      return hash instanceof Map ? [...hash.entries()].flat() : [];
    }
    case "HDEL": {
      const hash = redis.get(args[0]);
      return hash instanceof Map && hash.delete(args[1]) ? 1 : 0;
    }
    case "EVAL": {
      const [, , key, token] = args; // compare-and-delete script
      if (redis.get(key) === token) { redis.delete(key); return 1; }
      return 0;
    }
    default: throw new Error(`fake redis: ${name} not implemented`);
  }
}

/* ---- Fake YouTube ---------------------------------------------- */
const VIDEO_COUNT = 120;
const videos = Array.from({ length: VIDEO_COUNT }, (_, i) => ({
  id: `vid${String(i).padStart(3, "0")}`,
  title: i === 7 ? "  <b>Bold</b>\nedit\u0007 with a very long caption that keeps going and going well past ninety characters for sure" : `Edit ${i}`,
  views: (i + 1) * 1000,
  likes: i % 10 === 0 ? undefined : 10 // some videos hide their likes
}));

let youtube = { mode: "ok", calls: 0, failuresLeft: 0, lifetimeViews: 18_000_000, hidden: false };

function youtubeResponse(url) {
  youtube.calls += 1;
  if (youtube.mode === "badKey") {
    return json(400, { error: { code: 400, message: "API key not valid. Please pass a valid API key.", errors: [{ reason: "badRequest" }], status: "INVALID_ARGUMENT" } });
  }
  if (youtube.mode === "quota") return json(403, { error: { errors: [{ reason: "quotaExceeded" }] } });
  if (youtube.mode === "down") return json(503, { error: { message: "backend error" } });
  if (youtube.mode === "flaky" && youtube.failuresLeft > 0) {
    youtube.failuresLeft -= 1;
    return json(429, { error: { errors: [{ reason: "rateLimitExceeded" }] } });
  }

  const resource = url.pathname.split("/").pop();
  const q = url.searchParams;
  assert.ok(q.get("key"), "every YouTube call sends the key");
  if (resource === "channels") {
    return json(200, { items: [{
      snippet: { title: "ERO", customUrl: "@eroedtx" },
      statistics: { viewCount: String(youtube.lifetimeViews), subscriberCount: "16700", hiddenSubscriberCount: youtube.hidden, videoCount: String(VIDEO_COUNT) },
      contentDetails: { relatedPlaylists: { uploads: "UUtest" } }
    }] });
  }
  if (resource === "playlistItems") {
    const start = Number(q.get("pageToken") || 0);
    const page = videos.slice(start, start + 50);
    const next = start + 50 < videos.length ? String(start + 50) : undefined;
    return json(200, { items: page.map((v) => ({ contentDetails: { videoId: v.id } })), ...(next ? { nextPageToken: next } : {}) });
  }
  if (resource === "videos") {
    const ids = q.get("id").split(",");
    assert.ok(ids.length <= 50, "videos.list is called with at most 50 IDs");
    return json(200, { items: ids.map((id) => {
      const v = videos.find((x) => x.id === id);
      return {
        id,
        snippet: { title: v.title, thumbnails: { medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, width: 320, height: 180 } } },
        statistics: { viewCount: String(v.views), ...(v.likes === undefined ? {} : { likeCount: String(v.likes) }) }
      };
    }) });
  }
  throw new Error(`fake youtube: ${resource}`);
}

/* ---- Fake TikTok ------------------------------------------------ */
const makeVideos = (count, viewsEach = (i) => (i + 1) * 100_000) => Array.from({ length: count }, (_, i) => ({
  id: `7${String(i).padStart(18, "0")}`,
  title: `TikTok edit ${i}`,
  view_count: viewsEach(i),
  cover_image_url: `https://p16-sign.tiktokcdn.com/obj/cover-${i}.jpeg?x-expires=1`
}));
let TIKTOK_VIDEOS = makeVideos(45); // views sum = 103.5M

let tiktok = { calls: 0, listCalls: 0, listLimit: Infinity, accessToken: "tt-access-1", refreshToken: "tt-refresh-1", refreshMode: "ok", userMode: "ok", scope: "user.info.basic,user.info.profile,user.info.stats,video.list" };

function tiktokResponse(url, init) {
  tiktok.calls += 1;
  if (url.pathname === "/v2/oauth/token/") {
    const form = new URLSearchParams(init.body);
    assert.equal(form.get("client_key"), "tt-client-key");
    assert.equal(form.get("client_secret"), "tt-client-secret");
    if (form.get("grant_type") === "authorization_code") {
      if (form.get("code") !== "good-code") return json(400, { error: "invalid_grant", error_description: "bad code" });
      assert.equal(form.get("redirect_uri"), "https://generosomm.dev/api/auth/tiktok/callback");
    } else {
      if (tiktok.refreshMode === "invalid" || form.get("refresh_token") !== tiktok.refreshToken) {
        return json(400, { error: "invalid_grant", error_description: "refresh token invalid" });
      }
      tiktok.refreshToken = "tt-refresh-2"; // TikTok rotates it
      tiktok.accessToken = "tt-access-2";
    }
    return json(200, { access_token: tiktok.accessToken, expires_in: 86400, refresh_token: tiktok.refreshToken, refresh_expires_in: 31536000, open_id: "open-123", scope: tiktok.scope, token_type: "Bearer" });
  }
  const auth = new Headers(init.headers).get("authorization");
  if (tiktok.userMode === "invalid" || auth !== `Bearer ${tiktok.accessToken}`) {
    return json(401, { data: {}, error: { code: "access_token_invalid", message: "expired", log_id: "x" } });
  }
  if (url.pathname === "/v2/user/info/") {
    return json(200, { data: { user: { open_id: "open-123", username: "eroedtx", display_name: "ERO", follower_count: 250000, likes_count: 4800000, video_count: TIKTOK_VIDEOS.length } }, error: { code: "ok" } });
  }
  if (url.pathname === "/v2/video/query/") {
    const ids = JSON.parse(init.body).filters.video_ids;
    assert.ok(ids.length <= 20, "video.query takes at most 20 IDs");
    return json(200, { data: { videos: TIKTOK_VIDEOS.filter((v) => ids.includes(v.id)) }, error: { code: "ok" } });
  }
  if (url.pathname === "/v2/video/list/") {
    tiktok.listCalls += 1;
    if (tiktok.listCalls > tiktok.listLimit) {
      return json(429, { data: {}, error: { code: "rate_limit_exceeded", message: "slow down", log_id: "x" } });
    }
    const body = JSON.parse(init.body);
    assert.ok(body.max_count <= 20, "video.list max_count is at most 20");
    const start = body.cursor ?? 0;
    const page = TIKTOK_VIDEOS.slice(start, start + body.max_count);
    const next = start + body.max_count;
    return json(200, { data: { videos: page, cursor: next, has_more: next < TIKTOK_VIDEOS.length }, error: { code: "ok" } });
  }
  throw new Error(`fake tiktok: ${url.pathname}`);
}

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  if (url.hostname === "fake-redis.test") {
    if (redisDown) return json(500, { error: "down" });
    const body = JSON.parse(init.body);
    if (url.pathname === "/pipeline") return json(200, body.map((cmd) => ({ result: runRedis(cmd) })));
    return json(200, { result: runRedis(body) });
  }
  if (url.hostname === "www.googleapis.com") return youtubeResponse(url);
  if (url.hostname === "open.tiktokapis.com") return tiktokResponse(url, init);
  if (url.hostname.endsWith(".tiktokcdn.com")) {
    return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), { status: 200, headers: { "Content-Type": "image/jpeg", "Content-Length": "4" } });
  }
  throw new Error(`unexpected fetch: ${url.href}`);
};

/* ---- Environment ------------------------------------------------ */
const SECRET_KEY = "AIzaFAKE-key-that-must-never-leak";
Object.assign(process.env, {
  YOUTUBE_API_KEY: SECRET_KEY,
  YOUTUBE_CHANNEL_ID: "UCtest",
  KV_REST_API_URL: "https://fake-redis.test",
  KV_REST_API_TOKEN: "redis-token-must-never-leak",
  ADMIN_SECRET: "admin-secret",
  TIKTOK_CLIENT_KEY: "tt-client-key",
  TIKTOK_CLIENT_SECRET: "tt-client-secret",
  TIKTOK_REDIRECT_URI: "https://generosomm.dev/api/auth/tiktok/callback"
});

const { httpDefaults } = await import("../lib/http.js");
httpDefaults.backoffBaseMs = 5; // keep retries fast in tests
const stats = (await import("../api/stats.js")).default;
const health = (await import("../api/health.js")).default;
const oauth = (await import("../api/auth/[provider]/[action].js")).default;
const thumb = (await import("../api/thumb.js")).default;
const refreshApi = (await import("../api/refresh.js")).default;
const visitApi = (await import("../api/visit.js")).default;
const feedbackApi = (await import("../api/feedback.js")).default;
const { cleanText } = await import("../lib/notes.js");
const { trimText, safeUrl, toCount } = await import("../lib/normalize.js");
const { KEYS } = await import("../lib/store.js");

/* Silence expected log lines, but keep them for assertions. */
const logs = [];
for (const level of ["log", "warn", "error"]) console[level] = (...args) => logs.push(args.join(" "));

async function get(path = "/api/stats", init) {
  const response = await stats.fetch(new Request(`https://generosomm.dev${path}`, init));
  const text = await response.text();
  return { response, text, body: text ? JSON.parse(text) : null };
}

function makeDue() {
  const snap = JSON.parse(redis.get(KEYS.snapshot));
  const past = new Date(Date.now() - 31 * 60_000).toISOString();
  snap.checkedAt = past;
  snap.updatedAt = past;
  redis.set(KEYS.snapshot, JSON.stringify(snap));
}

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push(`  ok   ${name}`);
  } catch (error) {
    results.push(`  FAIL ${name}\n       ${error.message}`);
    process.exitCode = 1;
  }
}

/* ---- Tests -------------------------------------------------------- */

await test("empty storage: fetches YouTube, saves, returns the public shape", async () => {
  const { response, body, text } = await get();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /s-maxage=900/);
  const yt = body.platforms.youtube;
  assert.equal(yt.status, "ok");
  assert.equal(yt.followers, 16700);
  assert.equal(yt.followersLabel, "subscribers");
  assert.equal(yt.liveViews, 18_000_000);
  assert.equal(yt.views, 18_000_000, "live beats documented 16.4M");
  assert.equal(yt.viewsMethod, "lifetime channel viewCount (live)");
  assert.equal(yt.posts, VIDEO_COUNT);
  assert.ok(redis.has(KEYS.snapshot), "snapshot saved");
  assert.ok(!text.includes(SECRET_KEY) && !text.includes("redis-token"), "no secrets in the response");
});

await test("pagination and quota: 1 channel + 3 playlist pages + 3 video batches = 7 units", async () => {
  const day = new Date().toISOString().slice(0, 10);
  assert.equal(youtube.calls, 7);
  assert.equal(redis.get(KEYS.quota("youtube", day)), "7");
});

await test("top posts: 6, sorted by views, captions cleaned and trimmed", async () => {
  const { body } = await get();
  const top = body.platforms.youtube.topPosts;
  assert.equal(top.length, 6);
  assert.deepEqual(top.map((p) => p.views), [120000, 119000, 118000, 117000, 116000, 115000]);
  assert.match(top[0].url, /^https:\/\/www\.youtube\.com\/watch\?v=vid119$/);
  assert.equal(top[0].thumbnail.width, 320);
  const long = trimText(videos[7].title);
  assert.ok(long.length <= 90 && long.endsWith("…") && !/[\n\u0007]/.test(long));
});

await test("likes: summed only from videos that show them", async () => {
  const { body } = await get();
  assert.equal(body.platforms.youtube.likes, 108 * 10);
});

await test("other platforms: TikTok documented (manual), Instagram not connected, Facebook disabled", async () => {
  const { body } = await get();
  assert.equal(body.platforms.tiktok.status, "manual");
  assert.equal(body.platforms.tiktok.views, 57_900_000);
  assert.match(body.platforms.tiktok.viewsMethod, /^documented 57\.9M \(last 365 days\)/);
  assert.equal(body.platforms.instagram.status, "disabled");
  assert.equal(body.platforms.facebook.status, "disabled");
});

await test("totals: per-platform max(live, documented), summed, never below the baseline", async () => {
  const { body } = await get();
  assert.equal(body.totals.views, 57_900_000 + 18_000_000);
  assert.equal(body.totals.viewsMethod, "sum of each platform's max(live, documented)");
  assert.equal(body.totals.followers, 16700);
  assert.equal(body.stale, false);
});

await test("fresh snapshot: no API calls on the next request", async () => {
  const before = youtube.calls;
  await get();
  await get();
  assert.equal(youtube.calls, before);
});

await test("rate limited twice, then OK: retries with backoff and succeeds", async () => {
  makeDue();
  youtube = { ...youtube, mode: "flaky", failuresLeft: 2, calls: 0, lifetimeViews: 18_500_000 };
  const { body } = await get();
  assert.equal(body.platforms.youtube.status, "ok");
  assert.equal(body.platforms.youtube.views, 18_500_000);
  assert.equal(youtube.calls, 9, "2 retries + 7 normal calls");
});

await test("bad API key: no retry, status error, last good numbers kept, clear log", async () => {
  makeDue();
  youtube = { ...youtube, mode: "badKey", calls: 0 };
  logs.length = 0;
  const { body } = await get();
  assert.equal(youtube.calls, 1, "4xx auth errors are not retried");
  const yt = body.platforms.youtube;
  assert.equal(yt.status, "error");
  assert.equal(yt.views, 18_500_000, "kept the last good data");
  assert.equal(body.stale, true);
  const ageMin = (Date.now() - new Date(body.updatedAt)) / 60_000;
  assert.ok(ageMin > 30, "a failed refresh does not move updatedAt");
  assert.ok(logs.some((l) => l.includes("check YOUTUBE_API_KEY")), "log says what to fix");
  assert.ok(!logs.join("\n").includes(SECRET_KEY), "the key is redacted from logs");
});

await test("API down (503 every time): 3 attempts, then stale with last good data", async () => {
  makeDue();
  youtube = { ...youtube, mode: "down", calls: 0 };
  const { body } = await get();
  assert.equal(youtube.calls, 3);
  assert.equal(body.platforms.youtube.status, "stale");
  assert.equal(body.platforms.youtube.views, 18_500_000);
});

await test("quota exceeded: no retry, stale", async () => {
  makeDue();
  youtube = { ...youtube, mode: "quota", calls: 0 };
  const { body } = await get();
  assert.equal(youtube.calls, 1);
  assert.equal(body.platforms.youtube.status, "stale");
});

await test("recovers on the next due refresh", async () => {
  makeDue();
  youtube = { ...youtube, mode: "ok", calls: 0 };
  const { body } = await get();
  assert.equal(body.platforms.youtube.status, "ok");
  assert.equal(body.stale, false);
});

await test("lock held by another request: serves the saved snapshot, no API calls", async () => {
  makeDue();
  redis.set(KEYS.lock("refresh"), "someone-else");
  youtube.calls = 0;
  const { body } = await get();
  assert.equal(youtube.calls, 0);
  assert.equal(body.platforms.youtube.status, "ok");
  redis.delete(KEYS.lock("refresh"));
});

await test("storage down: documented-only numbers, short cache", async () => {
  redisDown = true;
  const { response, body } = await get();
  redisDown = false;
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /s-maxage=60\b/);
  assert.equal(body.updatedAt, null);
  assert.equal(body.platforms.youtube.status, "manual");
  assert.equal(body.totals.views, 74_300_000, "57.9M + 16.4M documented");
  assert.equal(body.stale, false, "documented-only is not 'stale', it is undated");
});

await test("keys not set yet: YouTube falls back to documented, nothing crashes", async () => {
  redis.clear();
  const saved = process.env.YOUTUBE_API_KEY;
  delete process.env.YOUTUBE_API_KEY;
  youtube.calls = 0;
  const { body } = await get();
  process.env.YOUTUBE_API_KEY = saved;
  assert.equal(youtube.calls, 0);
  assert.equal(body.platforms.youtube.status, "manual");
  assert.equal(body.platforms.youtube.views, 16_400_000);
  assert.equal(body.updatedAt, null, "no live data, so no 'updated X ago'");
});

await test("hidden subscriber count: followers null, totals skip it", async () => {
  redis.clear();
  youtube = { ...youtube, mode: "ok", hidden: true };
  const { body } = await get();
  youtube.hidden = false;
  assert.equal(body.platforms.youtube.followers, null);
  assert.equal(body.totals.followers, null);
});

await test("methods and CORS", async () => {
  const post = await get("/api/stats", { method: "POST" });
  assert.equal(post.response.status, 405);
  const head = await get("/api/stats", { method: "HEAD" });
  assert.equal(head.response.status, 200);
  assert.equal(head.text, "");
  const ours = await get("/api/stats", { headers: { Origin: "https://www.generosomm.dev" } });
  assert.equal(ours.response.headers.get("access-control-allow-origin"), "https://www.generosomm.dev");
  const theirs = await get("/api/stats", { headers: { Origin: "https://evil.example" } });
  assert.equal(theirs.response.headers.get("access-control-allow-origin"), null);
});

await test("health: admin only, booleans only, shows quota and snapshot age", async () => {
  const denied = await health.fetch(new Request("https://generosomm.dev/api/health"));
  assert.equal(denied.status, 401);
  const ok = await health.fetch(new Request("https://generosomm.dev/api/health", { headers: { Authorization: "Bearer admin-secret" } }));
  const text = await ok.text();
  const body = JSON.parse(text);
  assert.equal(body.env.youtube.YOUTUBE_API_KEY, true);
  assert.equal(body.storage.reachable, true);
  assert.equal(typeof body.storage.snapshot.minutesSinceCheck, "number");
  assert.ok(!text.includes(SECRET_KEY) && !text.includes("admin-secret"));
});

await test("helpers: unsafe URLs dropped, counts coerced", async () => {
  assert.equal(safeUrl("javascript:alert(1)"), "");
  assert.equal(safeUrl("http://insecure.example/x"), "");
  assert.equal(safeUrl("https://i.ytimg.com/a.jpg"), "https://i.ytimg.com/a.jpg");
  assert.equal(toCount("1200"), 1200);
  assert.equal(toCount(-5), null);
  assert.equal(toCount(undefined), null);
});

/* ---- TikTok (Phase 3) --------------------------------------------- */

const call = (handler, path, init) => handler.fetch(new Request(`https://generosomm.dev${path}`, init));

await test("TikTok before connecting: documented 57.9M, no API calls", async () => {
  redis.clear();
  tiktok.calls = 0;
  const { body } = await get();
  assert.equal(body.platforms.tiktok.status, "manual");
  assert.equal(body.platforms.tiktok.views, 57_900_000);
  assert.equal(tiktok.calls, 0);
});

let state = "";
let cookie = "";
await test("connect start: admin only; redirects to TikTok with state + cookie", async () => {
  assert.equal((await call(oauth, "/api/auth/tiktok/start")).status, 401);
  assert.equal((await call(oauth, "/api/auth/tiktok/start?key=wrong")).status, 401);
  const response = await call(oauth, "/api/auth/tiktok/start?key=admin-secret");
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  const location = new URL(response.headers.get("location"));
  assert.equal(location.origin + location.pathname, "https://www.tiktok.com/v2/auth/authorize/");
  assert.equal(location.searchParams.get("client_key"), "tt-client-key");
  assert.equal(location.searchParams.get("scope"), "user.info.basic,user.info.profile,user.info.stats,video.list");
  assert.equal(location.searchParams.get("redirect_uri"), "https://generosomm.dev/api/auth/tiktok/callback");
  state = location.searchParams.get("state");
  assert.ok(state.length >= 40);
  const setCookie = response.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  cookie = setCookie.split(";")[0];
  assert.ok(redis.has(KEYS.oauthState(state)));
});

await test("callback: wrong cookie is refused, nothing saved", async () => {
  const bad = await call(oauth, `/api/auth/tiktok/callback?code=good-code&state=${state}`, { headers: { Cookie: "oauth_state=forged" } });
  assert.equal(bad.status, 400);
  assert.equal(redis.has(KEYS.token("tiktok")), false);
  /* The failed attempt used up the state (one use only), so start again. */
  const again = await call(oauth, "/api/auth/tiktok/start?key=admin-secret");
  state = new URL(again.headers.get("location")).searchParams.get("state");
  cookie = again.headers.get("set-cookie").split(";")[0];
});

await test("callback: denied on TikTok's screen is reported, nothing saved", async () => {
  const response = await call(oauth, "/api/auth/tiktok/callback?error=access_denied&error_description=user+cancelled");
  assert.equal(response.status, 400);
  assert.match(await response.text(), /access_denied/);
  assert.equal(redis.has(KEYS.token("tiktok")), false);
});

await test("callback: exchanges the code, stores tokens, refreshes stats at once", async () => {
  tiktok.calls = 0;
  const response = await call(oauth, `/api/auth/tiktok/callback?code=good-code&state=${state}`, { headers: { Cookie: cookie } });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /TikTok connected/);
  assert.match(html, /@eroedtx/);
  assert.ok(!html.includes("tt-access") && !html.includes("tt-refresh"), "tokens never shown");
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/, "state cookie cleared");
  const stored = JSON.parse(redis.get(KEYS.token("tiktok")));
  assert.equal(stored.refreshToken, "tt-refresh-1");
  assert.ok(stored.connectedAt);
  assert.equal(tiktok.calls, 1 + 1 + 3 + 1, "token + user info + 3 pages of 20 + top-post query");
});

await test("replayed callback (same state again) is refused", async () => {
  const replay = await call(oauth, `/api/auth/tiktok/callback?code=good-code&state=${state}`, { headers: { Cookie: cookie } });
  assert.equal(replay.status, 400);
});

await test("TikTok live: followers, likes, posts; views = max(sum of 45 videos, documented)", async () => {
  const { body, text } = await get();
  const tt = body.platforms.tiktok;
  assert.equal(tt.status, "ok");
  assert.equal(tt.handle, "@eroedtx");
  assert.equal(tt.followers, 250000);
  assert.equal(tt.likes, 4_800_000);
  assert.equal(tt.posts, 45);
  assert.equal(tt.liveViews, 103_500_000);
  assert.equal(tt.views, 103_500_000, "live sum beats documented 57.9M here");
  assert.equal(tt.viewsMethod, "sum of view_count across 45 public videos (live)");
  assert.equal(body.totals.followers, 250000 + 16700);
  assert.ok(!text.includes("tt-access") && !text.includes("tiktokcdn"), "no tokens or raw CDN URLs in public JSON");
});

await test("TikTok top posts: 6 by views, clean permalinks, thumbnails via /api/thumb", async () => {
  const { body } = await get();
  const top = body.platforms.tiktok.topPosts;
  assert.equal(top.length, 6);
  assert.equal(top[0].views, 4_500_000);
  assert.equal(top[0].url, `https://www.tiktok.com/@eroedtx/video/${top[0].id}`);
  assert.equal(top[0].thumbnail.url, `/api/thumb?p=tiktok&id=${top[0].id}`);
  assert.equal("_thumbSource" in top[0], false);
});

await test("thumb proxy: serves known posts, refuses everything else", async () => {
  const { body } = await get();
  const id = body.platforms.tiktok.topPosts[0].id;
  const ok = await call(thumb, `/api/thumb?p=tiktok&id=${id}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "image/jpeg");
  assert.match(ok.headers.get("cache-control"), /s-maxage=21600/, "never cached past TikTok's 6 h TTL");
  assert.equal((await call(thumb, "/api/thumb?p=tiktok&id=7000")).status, 404, "post not in snapshot");
  assert.equal((await call(thumb, "/api/thumb?p=tiktok&id=../../etc")).status, 404, "unsafe id");
  assert.equal((await call(thumb, `/api/thumb?p=youtube&id=${id}`)).status, 404, "platform not proxied");
  /* A tampered snapshot pointing at another host is refused. */
  const snap = JSON.parse(redis.get(KEYS.snapshot));
  snap.platforms.tiktok.topPosts[1]._thumbSource = "https://evil.example/x.jpg";
  redis.set(KEYS.snapshot, JSON.stringify(snap));
  assert.equal((await call(thumb, `/api/thumb?p=tiktok&id=${snap.platforms.tiktok.topPosts[1].id}`)).status, 404);
});

await test("access token expiring: refreshed first, rotated refresh token saved", async () => {
  const record = JSON.parse(redis.get(KEYS.token("tiktok")));
  record.accessExpiresAt = new Date(Date.now() + 60_000).toISOString(); // 1 minute left
  redis.set(KEYS.token("tiktok"), JSON.stringify(record));
  makeDue();
  const { body } = await get();
  assert.equal(body.platforms.tiktok.status, "ok");
  const saved = JSON.parse(redis.get(KEYS.token("tiktok")));
  assert.equal(saved.refreshToken, "tt-refresh-2");
  assert.equal(saved.accessToken, "tt-access-2");
  assert.equal(saved.connectedAt, record.connectedAt, "connection date kept");
});

await test("refresh token rejected: status error, last good numbers kept, says how to fix", async () => {
  const record = JSON.parse(redis.get(KEYS.token("tiktok")));
  record.accessExpiresAt = new Date(Date.now() - 1000).toISOString();
  redis.set(KEYS.token("tiktok"), JSON.stringify(record));
  tiktok.refreshMode = "invalid";
  logs.length = 0;
  makeDue();
  const { body } = await get();
  tiktok.refreshMode = "ok";
  assert.equal(body.platforms.tiktok.status, "error");
  assert.equal(body.platforms.tiktok.followers, 250000);
  assert.equal(body.platforms.youtube.status, "ok", "YouTube unaffected");
  assert.ok(logs.some((l) => l.includes("re-run /api/auth/tiktok/start")));
});

await test("access token revoked mid-life: status error, no retries", async () => {
  const record = JSON.parse(redis.get(KEYS.token("tiktok")));
  record.accessExpiresAt = new Date(Date.now() + 86_000_000).toISOString();
  redis.set(KEYS.token("tiktok"), JSON.stringify(record));
  tiktok.userMode = "invalid";
  tiktok.calls = 0;
  makeDue();
  const { body } = await get();
  tiktok.userMode = "ok";
  assert.equal(tiktok.calls, 1);
  assert.equal(body.platforms.tiktok.status, "error");
});

await test("health: TikTok token lifetimes, never the token", async () => {
  const response = await health.fetch(new Request("https://generosomm.dev/api/health", { headers: { Authorization: "Bearer admin-secret" } }));
  const text = await response.text();
  const tokens = JSON.parse(text).storage.tokens.tiktok;
  assert.equal(tokens.connected, true);
  assert.ok(tokens.refreshTokenDaysLeft >= 364);
  assert.ok(!text.includes("tt-access") && !text.includes("tt-refresh"));
});

await test("big account: the index walks a few pages per refresh and finishes in later runs", async () => {
  TIKTOK_VIDEOS = makeVideos(300, () => 10_000); // 300 videos, 3M views in total
  redis.delete(KEYS.index("tiktok"));
  tiktok.listCalls = 0;
  makeDue();
  let { body } = await get();
  assert.equal(body.platforms.tiktok.status, "ok");
  assert.equal(tiktok.listCalls, 7, "newest page + 6 older pages, no more");
  assert.match(body.platforms.tiktok.viewsMethod, /^documented 57\.9M .*partial: sum of view_count across the first 140 of 300/);
  assert.equal(body.platforms.tiktok.views, 57_900_000, "documented wins while the index is partial");

  makeDue();
  ({ body } = await get());
  assert.match(body.platforms.tiktok.viewsMethod, /first 260 of 300/);

  makeDue();
  ({ body } = await get());
  assert.equal(body.platforms.tiktok.liveViews, 3_000_000, "all 300 videos summed after the pass completes");
  assert.match(body.platforms.tiktok.viewsMethod, /sum of view_count across 300 public videos/);
  assert.doesNotMatch(body.platforms.tiktok.viewsMethod, /partial/);
});

await test("rate limited mid-walk: keeps the pages it got, still ok, carries on next time", async () => {
  TIKTOK_VIDEOS = makeVideos(300, () => 10_000);
  redis.delete(KEYS.index("tiktok"));
  tiktok.listCalls = 0;
  tiktok.listLimit = 3; // the 4th video.list call gets a 429
  logs.length = 0;
  makeDue();
  const { body } = await get();
  tiktok.listLimit = Infinity;
  assert.equal(body.platforms.tiktok.status, "ok");
  assert.match(body.platforms.tiktok.viewsMethod, /first 60 of 300/);
  assert.ok(logs.some((l) => l.includes("index walk paused (rate_limit_exceeded)")));
  const index = JSON.parse(redis.get(KEYS.index("tiktok")));
  assert.equal(Object.keys(index.videos).length, 60);
  assert.equal(index.cursor, 60, "next refresh resumes after the last good page");
});

await test("deleted videos drop out of the sum when a pass completes", async () => {
  TIKTOK_VIDEOS = makeVideos(45);
  redis.delete(KEYS.index("tiktok"));
  makeDue();
  await get();
  const removed = TIKTOK_VIDEOS.pop(); // the 4.5M-view video is deleted
  makeDue();
  const { body } = await get();
  assert.equal(body.platforms.tiktok.liveViews, 103_500_000 - removed.view_count);
  assert.equal(body.platforms.tiktok.topPosts.some((p) => p.id === removed.id), false);
});

await test("/api/refresh: cron or admin only, refreshes now, reports statuses only", async () => {
  Object.assign(process.env, { CRON_SECRET: "cron-secret" });
  assert.equal((await call(refreshApi, "/api/refresh")).status, 401);
  assert.equal((await call(refreshApi, "/api/refresh?key=wrong")).status, 401);
  assert.equal((await call(refreshApi, "/api/refresh?key=cron-secret")).status, 401, "cron secret only works as a header");
  const cron = await call(refreshApi, "/api/refresh", { headers: { Authorization: "Bearer cron-secret" } });
  assert.equal(cron.status, 200);
  const body = await cron.json();
  assert.equal(body.statuses.tiktok, "ok");
  assert.equal(body.statuses.youtube, "ok");
  assert.equal(JSON.stringify(body).includes("57"), false, "no numbers in the refresh answer");
  const admin = await call(refreshApi, "/api/refresh", { method: "POST", headers: { Authorization: "Bearer admin-secret" } });
  assert.equal(admin.status, 200);
  redis.set(KEYS.lock("refresh"), "busy");
  assert.equal((await call(refreshApi, "/api/refresh?key=admin-secret")).status, 409, "respects the shared lock");
  redis.delete(KEYS.lock("refresh"));
});

await test("token response without refresh_expires_in: assumes 365 days, not 'expired'", async () => {
  const { tokenRecord } = await import("../lib/providers/tiktok.js");
  const record = tokenRecord({ access_token: "a", refresh_token: "r", expires_in: 86400 });
  const days = (new Date(record.refreshExpiresAt) - Date.now()) / 86_400_000;
  assert.ok(days > 364 && days <= 365);
});

await test("due snapshot + waitUntil: replies instantly with saved numbers, refreshes after", async () => {
  TIKTOK_VIDEOS = makeVideos(45);
  redis.delete(KEYS.lock("refresh"));
  makeDue();
  const before = JSON.parse(redis.get(KEYS.snapshot));
  const pending = [];
  youtube = { ...youtube, mode: "ok", calls: 0, lifetimeViews: 19_000_000 };
  const response = await stats.fetch(new Request("https://generosomm.dev/api/stats"), { waitUntil: (p) => pending.push(p) });
  const body = await response.json();
  assert.equal(pending.length, 1, "refresh handed to waitUntil");
  assert.equal(body.updatedAt, before.updatedAt, "answered with the saved snapshot");
  assert.match(response.headers.get("cache-control"), /s-maxage=30,/, "short cache while refreshing");
  await pending[0];
  assert.ok(youtube.calls > 0, "the background refresh ran");
  assert.equal(redis.has(KEYS.lock("refresh")), false, "lock released");
  const after = await get();
  assert.equal(after.body.platforms.youtube.views, 19_000_000, "next request gets the fresh numbers");
  assert.match(after.response.headers.get("cache-control"), /s-maxage=900/);
});

await test("nothing saved yet: refreshes before replying even with waitUntil", async () => {
  redis.delete(KEYS.snapshot);
  const pending = [];
  const response = await stats.fetch(new Request("https://generosomm.dev/api/stats"), { waitUntil: (p) => pending.push(p) });
  const body = await response.json();
  assert.equal(pending.length, 0);
  assert.equal(body.platforms.youtube.status, "ok");
  assert.ok(redis.has(KEYS.snapshot));
});

await test("background refresh failing doesn't break anything", async () => {
  makeDue();
  const pending = [];
  youtube = { ...youtube, mode: "down", calls: 0 };
  const response = await stats.fetch(new Request("https://generosomm.dev/api/stats"), { waitUntil: (p) => pending.push(p) });
  assert.equal(response.status, 200);
  await pending[0];
  youtube.mode = "ok";
  const after = await get();
  assert.equal(after.body.platforms.youtube.status, "stale", "kept the last good numbers");
  assert.equal(redis.has(KEYS.lock("refresh")), false);
});

/* ---- Visit counter + visitor notes --------------------------------- */

const BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const from = (ip, extra = {}) => ({ Origin: "https://generosomm.dev", "User-Agent": BROWSER, "X-Forwarded-For": ip, ...extra });
const visit = (headers) => visitApi.fetch(new Request("https://generosomm.dev/api/visit", { method: "POST", headers }));
const feedback = (init = {}, path = "/api/feedback") => feedbackApi.fetch(new Request(`https://generosomm.dev${path}`, init));
const note = (ip, fields = {}) => feedback({
  method: "POST",
  headers: { ...from(ip), "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Ana Santos", role: "Recruiter", message: "Clean work and fast replies, great to work with.", website: "", startedAt: Date.now() - 10_000, ...fields })
});

await test("visits: counted once per visitor per day, never from bots or other sites", async () => {
  assert.equal((await visit({ "User-Agent": BROWSER })).status, 403, "no Origin: not from a page");
  assert.equal((await visit(from("1.1.1.1", { Origin: "https://evil.example" }))).status, 403);

  let body = await (await visit(from("203.0.113.7"))).json();
  assert.equal(body.counted, true);
  assert.equal(body.total, 1);
  assert.equal(body.since, new Date().toISOString().slice(0, 10));

  body = await (await visit(from("203.0.113.7"))).json();
  assert.equal(body.counted, false, "same visitor, same day");
  assert.equal(body.total, 1);

  body = await (await visit(from("198.51.100.9"))).json();
  assert.equal(body.total, 2, "a different visitor counts");

  body = await (await visit(from("192.0.2.1", { "User-Agent": "Googlebot/2.1" }))).json();
  assert.equal(body.counted, false);
  assert.equal(body.total, 2);

  const get = await visitApi.fetch(new Request("https://generosomm.dev/api/visit"));
  assert.match(get.headers.get("cache-control"), /s-maxage=60/);
  assert.equal((await get.json()).total, 2);
});

await test("visits: IP addresses are never stored, only salted one-way hashes", async () => {
  const dump = JSON.stringify([...redis.entries()].map(([k, v]) => [k, v instanceof Set ? [...v] : v instanceof Map ? [...v] : v]));
  assert.ok(!dump.includes("203.0.113.7") && !dump.includes("198.51.100.9"));
});

await test("notes: a valid note waits for approval and isn't public", async () => {
  const response = await note("203.0.113.20");
  assert.equal(response.status, 202);
  const stored = [...redis.get(KEYS.notes).values()].map((v) => JSON.parse(v));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].status, "pending");
  const pub = await (await feedback()).json();
  assert.deepEqual(pub.notes, []);
});

await test("notes: spam traps answer 'ok' but store nothing", async () => {
  const before = redis.get(KEYS.notes).size;
  assert.equal((await note("203.0.113.21", { website: "http://spam.example" })).status, 202, "honeypot filled");
  assert.equal((await note("203.0.113.22", { startedAt: Date.now() - 500 })).status, 202, "sent within 3 s");
  assert.equal(redis.get(KEYS.notes).size, before);
});

await test("notes: bad input is refused with a reason", async () => {
  const reason = async (fields) => (await (await note("203.0.113.30", fields)).json()).error;
  assert.equal(await reason({ name: "A" }), "name");
  assert.equal(await reason({ message: "too short" }), "message");
  assert.equal(await reason({ message: "Great work, see my site at www.example.com for more" }), "links");
  assert.equal(await reason({ message: "Hire me https://x.example/offer now please" }), "links");
  const noOrigin = await feedback({ method: "POST", headers: { "Content-Type": "application/json", "User-Agent": BROWSER }, body: "{}" });
  assert.equal(noOrigin.status, 403);
});

await test("notes: at most 3 per visitor per day", async () => {
  for (let i = 0; i < 3; i += 1) assert.equal((await note("203.0.113.40", { message: `Note number ${i} from the same visitor here.` })).status, 202);
  assert.equal((await note("203.0.113.40")).status, 429);
});

await test("notes: invisible characters stripped, text kept as text", async () => {
  assert.equal(cleanText("  Hi\u200B there\u202E <b>x</b>\n\n "), "Hi there <b>x</b>");
});

await test("notes admin: secret required; approve, hide and delete", async () => {
  assert.equal((await feedback({}, "/api/feedback?all=1")).status, 401);
  const admin = { Authorization: "Bearer admin-secret", "Content-Type": "application/json" };
  const all = await (await feedback({ headers: admin }, "/api/feedback?all=1")).json();
  const target = all.notes.find((n) => n.message === "Clean work and fast replies, great to work with.");
  assert.ok(target);

  const denied = await feedback({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve", id: target.id }) });
  assert.equal(denied.status, 401, "moderation needs the secret");

  await feedback({ method: "POST", headers: admin, body: JSON.stringify({ action: "approve", id: target.id }) });
  let pub = await (await feedback()).json();
  assert.equal(pub.notes.length, 1);
  assert.deepEqual(Object.keys(pub.notes[0]).sort(), ["date", "id", "message", "name", "role"], "public fields only");
  assert.equal(pub.notes[0].message, "Clean work and fast replies, great to work with.");

  await feedback({ method: "POST", headers: admin, body: JSON.stringify({ action: "hide", id: target.id }) });
  pub = await (await feedback()).json();
  assert.equal(pub.notes.length, 0, "hidden again");

  await feedback({ method: "POST", headers: admin, body: JSON.stringify({ action: "delete", id: target.id }) });
  const after = await (await feedback({ headers: admin }, "/api/feedback?all=1")).json();
  assert.equal(after.notes.some((n) => n.id === target.id), false);
});

await test("health: shows pending notes and visit totals", async () => {
  const response = await health.fetch(new Request("https://generosomm.dev/api/health", { headers: { Authorization: "Bearer admin-secret" } }));
  const body = await response.json();
  assert.ok(body.storage.notes.pending >= 3);
  assert.equal(body.storage.visits.total, 2);
  assert.equal(body.storage.visits.today, 2);
});

process.stdout.write(`Live stats backend\n${results.join("\n")}\n`);
