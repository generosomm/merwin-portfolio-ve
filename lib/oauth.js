/* =============================================================
   OAUTH — the one-time "connect my account" flow, for every
   platform that needs a user token: TikTok, Instagram and a
   Facebook Page. Served by api/auth/[provider]/[action].js:

     /api/auth/tiktok/start?key=ADMIN_SECRET
        1. checks the admin secret (so no visitor can connect THEIR
           account to your site)
        2. makes a random one-time `state`, stores it in Redis for
           10 minutes AND in an HttpOnly cookie
        3. redirects to the platform's consent screen

     /api/auth/tiktok/callback?code=…&state=…
        4. the state must match the cookie AND exist in Redis (it is
           deleted on first use). This is the CSRF check: a forged or
           replayed callback can't plant someone else's account.
        5. swaps the code for tokens, stores them in Redis
        6. refreshes the stats right away and shows a short summary

   PKCE: TikTok only uses it for mobile/desktop apps, and Meta's
   Instagram and Facebook web logins for server apps work with the
   app secret + state, so all three flows are state-protected.

   Pages here are plain HTML for you, never cached, never indexed,
   and never show a token or code.
   ============================================================= */

import { randomBytes } from "node:crypto";
import { isAdmin, sameSecret } from "./auth.js";
import { env, loadConfig } from "./config.js";
import { HttpError, requestJSON } from "./http.js";
import { FACEBOOK_SCOPES, FB_GRAPH } from "./providers/facebook.js";
import { INSTAGRAM_SCOPES, instagramTokenRecord } from "./providers/instagram.js";
import { TIKTOK_SCOPES, requestTikTokToken, tokenRecord } from "./providers/tiktok.js";
import { refreshNow } from "./refresh.js";
import { saveOAuthState, saveToken, storageConfigured, takeOAuthState } from "./store.js";

const COOKIE = "oauth_state";
const STATE_TTL_SECONDS = 600;

/* ---- Per-platform settings ------------------------------------- */

const FLOWS = {
  tiktok: {
    label: "TikTok",
    env: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REDIRECT_URI"],
    authorizeUrl(state) {
      const params = new URLSearchParams({
        client_key: env("TIKTOK_CLIENT_KEY"),
        scope: TIKTOK_SCOPES.join(","),
        response_type: "code",
        redirect_uri: env("TIKTOK_REDIRECT_URI"),
        state,
        disable_auto_auth: "1" // always show the consent screen, so you see which account you're connecting
      });
      return `https://www.tiktok.com/v2/auth/authorize/?${params}`;
    },
    async exchange(code) {
      const data = await requestTikTokToken({
        code,
        grant_type: "authorization_code",
        redirect_uri: env("TIKTOK_REDIRECT_URI")
      });
      const granted = String(data.scope || "").split(",").map((s) => s.trim());
      return {
        record: tokenRecord(data),
        missingScopes: TIKTOK_SCOPES.filter((scope) => !granted.includes(scope))
      };
    }
  },

  /* Instagram API with Instagram Login: code -> 1-hour token ->
     60-day token (renewed weekly by the provider). */
  instagram: {
    label: "Instagram",
    env: ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET", "INSTAGRAM_REDIRECT_URI"],
    authorizeUrl(state) {
      const params = new URLSearchParams({
        client_id: env("INSTAGRAM_APP_ID"),
        redirect_uri: env("INSTAGRAM_REDIRECT_URI"),
        response_type: "code",
        scope: INSTAGRAM_SCOPES.join(","),
        state,
        force_reauth: "true" // show the login, so you see which account you're connecting
      });
      return `https://www.instagram.com/oauth/authorize?${params}`;
    },
    async exchange(code) {
      /* Instagram appends "#_" to the code; it isn't part of it. */
      const clean = code.replace(/#_$/, "");
      const short = await requestJSON("https://api.instagram.com/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env("INSTAGRAM_APP_ID"),
          client_secret: env("INSTAGRAM_APP_SECRET"),
          grant_type: "authorization_code",
          redirect_uri: env("INSTAGRAM_REDIRECT_URI"),
          code: clean
        }),
        label: "instagram",
        retries: 1
      });
      const first = short?.data?.[0] || short; // documented as { data: [ {...} ] }
      if (!first?.access_token) {
        throw new HttpError("instagram: code exchange returned no token", { status: 200, reason: short?.error_type || "no_access_token" });
      }

      const longParams = new URLSearchParams({
        grant_type: "ig_exchange_token",
        client_secret: env("INSTAGRAM_APP_SECRET"),
        access_token: first.access_token
      });
      const long = await requestJSON(`https://graph.instagram.com/access_token?${longParams}`, { label: "instagram", retries: 1 });
      if (!long?.access_token) throw new HttpError("instagram: long-lived token exchange failed", { status: 200, reason: "no_long_lived_token" });

      const granted = (Array.isArray(first.permissions) ? first.permissions : String(first.permissions || "").split(","))
        .map((scope) => String(scope).trim());
      return {
        record: instagramTokenRecord(long, { userId: String(first.user_id || ""), scope: granted.join(",") }),
        missingScopes: INSTAGRAM_SCOPES.filter((scope) => !granted.includes(scope))
      };
    }
  },

  /* Facebook Page: code -> user token -> long-lived user token ->
     the Page's own token from /me/accounts (doesn't expire). */
  facebook: {
    label: "Facebook",
    env: ["META_APP_ID", "META_APP_SECRET", "FACEBOOK_REDIRECT_URI", "FACEBOOK_PAGE_ID"],
    authorizeUrl(state) {
      const params = new URLSearchParams({
        client_id: env("META_APP_ID"),
        redirect_uri: env("FACEBOOK_REDIRECT_URI"),
        response_type: "code",
        scope: FACEBOOK_SCOPES.join(","),
        state
      });
      return `https://www.facebook.com/v26.0/dialog/oauth?${params}`;
    },
    async exchange(code) {
      const app = { client_id: env("META_APP_ID"), client_secret: env("META_APP_SECRET") };
      const short = await requestJSON(`${FB_GRAPH}/oauth/access_token?${new URLSearchParams({ ...app, redirect_uri: env("FACEBOOK_REDIRECT_URI"), code })}`, { label: "facebook", retries: 1 });
      if (!short?.access_token) throw new HttpError("facebook: code exchange returned no token", { status: 200, reason: "no_access_token" });

      const long = await requestJSON(`${FB_GRAPH}/oauth/access_token?${new URLSearchParams({ ...app, grant_type: "fb_exchange_token", fb_exchange_token: short.access_token })}`, { label: "facebook", retries: 1 });
      const userToken = long?.access_token || short.access_token;
      const auth = { headers: { Authorization: `Bearer ${userToken}` }, label: "facebook", retries: 1 };

      const accounts = await requestJSON(`${FB_GRAPH}/me/accounts?fields=id,name,access_token&limit=100`, auth);
      const page = (accounts?.data || []).find((item) => String(item.id) === env("FACEBOOK_PAGE_ID"));
      if (!page?.access_token) {
        /* Logged in with an account that doesn't manage that Page, or
           didn't tick it on Meta's "choose Pages" screen. */
        throw new HttpError("facebook: FACEBOOK_PAGE_ID not among the Pages this login manages", { status: 200, reason: "page_not_managed" });
      }

      const permissions = await requestJSON(`${FB_GRAPH}/me/permissions`, auth).catch(() => null);
      const granted = (permissions?.data || []).filter((item) => item.status === "granted").map((item) => item.permission);
      return {
        record: { pageId: String(page.id), pageName: page.name || "", pageToken: page.access_token, scope: granted.join(",") },
        missingScopes: permissions ? FACEBOOK_SCOPES.filter((scope) => !granted.includes(scope)) : []
      };
    }
  }
};

/* ---- Small helpers ----------------------------------------------- */

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function readCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

function stateCookie(value, maxAge) {
  return `${COOKIE}=${value}; Path=/api/auth/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

const NO_STORE = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer", // the start URL holds ?key=; never pass it on
  "X-Robots-Tag": "noindex"
};

/* A plain page in the site's colours, for you only. */
function page(title, lines, { status = 200, headers = {} } = {}) {
  const body = lines.map((line) => `<p>${line}</p>`).join("\n");
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${escapeHtml(title)}</title>
<style>
  body{margin:0;background:#0a0a0a;color:#f2f2f0;font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
  main{max-width:40rem;margin:0 auto;padding:4rem 1.25rem}
  h1{font-size:1.5rem;margin:0 0 1rem}p{color:#8c8c88;margin:.5rem 0}
  strong{color:#f2f2f0;font-weight:500}code{font-family:ui-monospace,monospace;color:#2bd47d}
  a{color:#f2f2f0}
</style></head>
<body><main><h1>${escapeHtml(title)}</h1>
${body}
</main></body></html>`;
  return new Response(html, { status, headers: { ...NO_STORE, "Content-Type": "text/html; charset=utf-8", ...headers } });
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const fmt = (n) => (Number.isFinite(n) ? `${compact.format(n)} (${n.toLocaleString("en")})` : "–");

/* ---- start --------------------------------------------------------- */

async function start(request, name, flow) {
  if (!env("ADMIN_SECRET")) return page("Not set up", ["ADMIN_SECRET is not set in Vercel yet."], { status: 503 });
  if (!isAdmin(request)) {
    return page("Not allowed", ["This link connects an account to the site and needs the admin key."], { status: 401 });
  }

  const missing = flow.env.filter((key) => !env(key));
  if (missing.length || !storageConfigured()) {
    return page(`${flow.label}: setup incomplete`, [
      ...missing.map((key) => `Missing environment variable: <code>${escapeHtml(key)}</code>`),
      ...(storageConfigured() ? [] : ["Redis is not connected to this project (KV_REST_API_URL / KV_REST_API_TOKEN)."]),
      "Add them in Vercel → Settings → Environment Variables, redeploy, then try again."
    ], { status: 500 });
  }

  const state = randomBytes(32).toString("base64url");
  await saveOAuthState(state, { provider: name, createdAt: new Date().toISOString() }, STATE_TTL_SECONDS);

  return new Response(null, {
    status: 302,
    headers: { ...NO_STORE, Location: flow.authorizeUrl(state), "Set-Cookie": stateCookie(state, STATE_TTL_SECONDS) }
  });
}

/* ---- callback ------------------------------------------------------ */

async function callback(request, name, flow) {
  const url = new URL(request.url);
  const clearCookie = { "Set-Cookie": stateCookie("", 0) };

  /* The user pressed "Cancel", or the platform refused. */
  const denied = url.searchParams.get("error");
  if (denied) {
    return page(`${flow.label} not connected`, [
      `${flow.label} answered: <code>${escapeHtml(denied)}</code> ${escapeHtml(url.searchParams.get("error_description") || "")}`,
      "Nothing was saved. Start again from the connect link if you want to retry."
    ], { status: 400, headers: clearCookie });
  }

  /* CSRF check: cookie, query and Redis must all agree, once. */
  const state = url.searchParams.get("state") || "";
  const fromCookie = readCookie(request, COOKIE);
  const saved = state ? await takeOAuthState(state) : null;
  if (!state || !sameSecret(state, fromCookie) || saved?.provider !== name) {
    return page("Link expired or invalid", [
      "This sign-in didn't start from your connect link, has already been used, or is older than 10 minutes.",
      "Open the connect link again to start over."
    ], { status: 400, headers: clearCookie });
  }

  const code = url.searchParams.get("code");
  if (!code) return page("No authorization code", [`${flow.label} didn't send a code back.`], { status: 400, headers: clearCookie });

  let exchanged;
  try {
    exchanged = await flow.exchange(code);
  } catch (error) {
    const reason = error instanceof HttpError ? error.reason || `HTTP ${error.status}` : "unexpected error";
    console.error(`[oauth] ${name} code exchange failed: ${error.message}`);
    const hint = reason === "page_not_managed"
      ? "The Facebook account you logged in with doesn't manage the Page in FACEBOOK_PAGE_ID, or that Page wasn't ticked on Meta's \"choose Pages\" screen. Connect again and select it."
      : "Check the app ID/key and secret, and that the redirect URI in Vercel matches the one registered with the platform exactly.";
    return page(`${flow.label} not connected`, [
      `Swapping the code for a token failed (<code>${escapeHtml(reason)}</code>).`,
      escapeHtml(hint)
    ], { status: 502, headers: clearCookie });
  }

  const now = new Date().toISOString();
  await saveToken(name, { ...exchanged.record, connectedAt: now });
  console.log(`[oauth] ${name} connected; scopes: ${exchanged.record.scope || "(none reported)"}`);

  /* Fetch fresh numbers now so the site updates immediately. */
  let summary = ["Saved. The stats will refresh on the next request to /api/stats."];
  try {
    const { snapshot, locked } = await refreshNow(loadConfig());
    const platform = snapshot?.platforms?.[name];
    if (!locked && platform) {
      summary = [
        `Status: <strong>${escapeHtml(platform.status)}</strong>${platform.note ? ` (${escapeHtml(platform.note)})` : ""}`,
        `Account: <strong>${escapeHtml(platform.handle || "–")}</strong>`,
        `Followers: <strong>${fmt(platform.followers)}</strong> · Posts: <strong>${fmt(platform.posts)}</strong>`,
        `Views shown on the site: <strong>${fmt(platform.views)}</strong> (${escapeHtml(platform.viewsMethod)})`
      ];
    }
  } catch (error) {
    console.error(`[oauth] refresh after ${name} connect failed: ${error.message}`);
  }

  return page(`${flow.label} connected`, [
    ...summary,
    ...(exchanged.missingScopes.length
      ? [`Warning: these permissions were not granted: <code>${escapeHtml(exchanged.missingScopes.join(", "))}</code>. Connect again and allow all of them.`]
      : []),
    `Check the result at <a href="/api/stats">/api/stats</a>.`
  ], { headers: clearCookie });
}

/* ---- Router ---------------------------------------------------------- */

export async function handleOAuth(request) {
  const match = /^\/api\/auth\/([a-z]+)\/(start|callback)\/?$/.exec(new URL(request.url).pathname);
  const flow = match && FLOWS[match[1]];
  if (!flow) return page("Not found", ["Unknown connect link."], { status: 404 });
  if (request.method !== "GET") return page("Method not allowed", ["Use GET."], { status: 405, headers: { Allow: "GET" } });

  try {
    return match[2] === "start" ? await start(request, match[1], flow) : await callback(request, match[1], flow);
  } catch (error) {
    console.error(`[oauth] ${match[1]} ${match[2]} failed: ${error.message}`);
    return page("Something went wrong", ["Check the function logs in Vercel for details."], { status: 500 });
  }
}
