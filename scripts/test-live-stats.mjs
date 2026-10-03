import assert from "node:assert/strict";
import process from "node:process";

/* =============================================================
   Live stats backend tests: no network, no keys, no packages.
   Run with:  node scripts/test-live-stats.mjs

   global fetch is replaced by a fake that plays YouTube and an
   in-memory Upstash Redis, so every failure case (expired key,
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
    case "INCRBY": {
      const next = (Number(redis.get(args[0])) || 0) + Number(args[1]);
      redis.set(args[0], String(next));
      return next;
    }
    case "EXPIRE": return 1;
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
  throw new Error(`unexpected fetch: ${url.href}`);
};

/* ---- Environment ------------------------------------------------ */
const SECRET_KEY = "AIzaFAKE-key-that-must-never-leak";
Object.assign(process.env, {
  YOUTUBE_API_KEY: SECRET_KEY,
  YOUTUBE_CHANNEL_ID: "UCtest",
  KV_REST_API_URL: "https://fake-redis.test",
  KV_REST_API_TOKEN: "redis-token-must-never-leak",
  ADMIN_SECRET: "admin-secret"
});

const { httpDefaults } = await import("../lib/http.js");
httpDefaults.backoffBaseMs = 5; // keep retries fast in tests
const stats = (await import("../api/stats.js")).default;
const health = (await import("../api/health.js")).default;
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

process.stdout.write(`Live stats backend\n${results.join("\n")}\n`);
