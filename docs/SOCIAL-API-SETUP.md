# Live social stats: setup guide

Everything you do by hand to get the live stats running: accounts,
developer apps, keys, hosting and storage. Work through it top to bottom.
The order matters: the domain has to be on Vercel before the platform apps,
because their redirect URLs and the TikTok domain check point at
`generosomm.dev`.

Docs checked on 2026-10-03. Platform dashboards change their labels often.
If a button is named slightly differently, look for the closest match. If a
whole step is missing, tell me before you work around it.

| # | Step | Time | Needed for |
|---|------|------|------------|
| 1 | [Generate two secrets](#1-generate-two-secrets) | 2 min | everything |
| 2 | [Create the Vercel project](#2-create-the-vercel-project) | 10 min | everything |
| 3 | [Add Upstash Redis storage](#3-add-upstash-redis-storage) | 5 min | Phase 2+ |
| 4 | [Add the first env vars and test](#4-add-the-first-env-vars-and-test) | 5 min | Phase 1 test |
| 5 | [Move generosomm.dev to Vercel](#5-move-generosommdev-to-vercel) | 15 min + DNS wait | Phases 3–4 |
| 6 | [YouTube API key](#6-youtube-api-key) | 10 min | Phase 2 |
| 7 | [TikTok developer app (Sandbox)](#7-tiktok-developer-app-sandbox) | 30 min | Phase 3 |
| 8 | [Meta app for Instagram](#8-meta-app-for-instagram) | 20 min | Phase 4 |
| 9 | [Facebook Page (only if you have one)](#9-facebook-page-only-if-you-have-one) | 10 min | Phase 4 |
| 10 | [Full env var checklist](#10-full-env-var-checklist) | 5 min | — |
| 11 | [Local development](#11-local-development-optional) | 10 min | optional |

You don't connect any accounts in this phase. The "connect" clicks (OAuth)
happen in Phase 3 (TikTok) and Phase 4 (Instagram, Facebook), once the code
that receives them exists. Here you only create the apps and collect keys.

---

## 1. Generate two secrets

You need two different long random strings. Run this twice in a terminal and
keep both results somewhere private (a password manager, not a file in this
repo):

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

- First result → `ADMIN_SECRET`. It protects the "connect my account" links,
  manual refresh and `/api/health`.
- Second result → `CRON_SECRET`. Vercel sends it with the daily cron so only
  Vercel can trigger a refresh.

---

## 2. Create the Vercel project

1. Go to <https://vercel.com/signup> and sign up **with GitHub** (the
   `generosomm` account). The **Hobby** plan is free and enough. It is meant
   for personal, non-commercial projects, which a personal portfolio is.
2. On the dashboard, click **Add New… → Project**.
3. Under **Import Git Repository**, find `merwin-portfolio-ve` and click
   **Import**. If it isn't listed, click **Adjust GitHub App Permissions** and
   give Vercel access to that repo.
4. On the **Configure Project** screen:
   - **Framework Preset:** `Other`
   - **Root Directory:** `./` (leave as is)
   - **Build and Output Settings:** leave every override **off**. There is no
     build step, and Vercel serves the files as they are, like GitHub Pages does.
   - **Environment Variables:** skip for now.
5. Click **Deploy**. When it finishes, click the preview image to open your
   site at `https://generosomm.vercel.app` (your project is named `generosomm`; note it
   down as **your vercel.app URL**).
6. Check the site looks exactly like generosomm.dev does today. Nothing about
   the frontend changes.

> **Why some files are missing on Vercel:** `.vercelignore` keeps four
> unused original videos (~69 MB) and the repo tooling out of the deploy.
> Git deploys of the full ~133 MB repo work (the 100 MB Hobby cap applies to
> `vercel` CLI uploads), but leaving the masters out makes deploys faster and
> keeps CLI deploys under the cap. They stay in Git; the site plays the
> compressed copies in `assets/videos/web/`.

From now on, every `git push` to `main` deploys to production automatically,
and every other branch gets its own preview URL.

---

## 3. Add Upstash Redis storage

Redis holds the latest stats snapshot, the daily history points, and the
TikTok and Instagram tokens. Those tokens change on every refresh, so they
can't live in environment variables.

1. Open your project on Vercel → **Storage** tab → **Create Database**.
2. Under **Marketplace Database Providers**, choose **Upstash** → **Upstash for
   Redis** → **Continue**.
3. **Plan:** `Free` (256 MB, 500K commands/month; this project uses a few
   thousand a month).
4. **Primary region:** `Washington, D.C., USA (us-east-1)`. Vercel runs Hobby
   functions in Washington (`iad1`) by default, and keeping the database next
   to them makes every read faster.
5. **Name:** `generosomm-stats` → **Create**.
6. When asked to connect it to a project, pick `generosomm` and tick
   **all environments** (Production, Preview, Development). Leave the custom
   prefix empty if it is offered.
7. Open **Settings → Environment Variables** and confirm you now see either
   `KV_REST_API_URL` + `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL` +
   `UPSTASH_REDIS_REST_TOKEN`. The code accepts either pair. You never type
   these yourself.

---

## 4. Add the first env vars and test

1. Project → **Settings → Environment Variables**.
2. Add `ADMIN_SECRET` (value from step 1). **Environments:** Production and
   Development. Turn on **Sensitive** if offered: Vercel then never shows the
   value again, not even to you.
3. Add `CRON_SECRET` the same way.
4. Env vars only reach new deployments, so go to **Deployments**, open the
   latest one's **⋯** menu → **Redeploy**.
5. Test the setup check (replace both placeholders):

   ```sh
   curl -H "Authorization: Bearer YOUR_ADMIN_SECRET" https://YOUR-VERCEL-APP-URL/api/health
   ```

   or open `https://YOUR-VERCEL-APP-URL/api/health?key=YOUR_ADMIN_SECRET` in a
   browser. Expected:

   ```json
   {
     "ok": true,
     "env": { "security": { "ADMIN_SECRET": true, "CRON_SECRET": true }, "tiktok": { ... false ... } },
     "storage": { "configured": true, "reachable": true }
   }
   ```

   - `401 Unauthorized` → the key doesn't match. Check for a stray space, and
     make sure you redeployed after adding it.
   - `"reachable": false` → the Redis env vars are missing or the database is
     not connected to this project (step 3.6).

   The response only says **whether** each variable is set, never its value.
   Come back to it after each later step: every value you add should flip to
   `true`.

---

## 5. Move generosomm.dev to Vercel

Your DNS is at **Name.com** and currently points at GitHub Pages. You're
swapping three records. Expect a few minutes, up to an hour, while DNS
updates. The site keeps working throughout, because both hosts serve the
same files.

### 5a. Add the domain in Vercel

1. Project → **Settings → Domains** → **Add Domain**.
2. Enter `generosomm.dev` → **Add**. When asked, choose to **redirect
   `www.generosomm.dev` → `generosomm.dev`**. The direction matters: the
   canonical URL and every OAuth redirect URL use the bare domain, and a
   redirect in the middle of a login breaks it.
   If Vercel set it up the other way (`generosomm.dev` showing
   `308 → www.generosomm.dev`), flip it:
   - **www.generosomm.dev → Edit →** Redirect to `generosomm.dev` (308) → Save.
   - **generosomm.dev → Edit →** connect to **Production**, no redirect → Save.
3. Vercel shows both domains as **Invalid Configuration** with the records it
   wants. **Use the exact values Vercel shows.** It may give your project its
   own values instead of the generic ones below.

### 5b. Change the records at Name.com

1. Log in at <https://www.name.com> → **My Domains** → `generosomm.dev` →
   **Manage DNS Records**.
2. **Delete** the four `A` records for the root (`@` / blank host) pointing to
   `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
   If there are `AAAA` records pointing to `2606:50c0:…` (GitHub), delete them too.
3. **Add** an `A` record: Host = blank (or `@`), Answer = **the IP Vercel
   showed** (for this project: `216.198.79.1`; the older `76.76.21.21` still works), TTL = 300.
4. **Edit** the `CNAME` for host `www`: change the answer from
   `generosomm.github.io` to **the CNAME target Vercel showed** (for this project: `cd353398edfc19f4.vercel-dns-017.com`; generic form
   `xxxxxxxx.vercel-dns-017.com`; generic fallback `cname.vercel-dns.com`).
5. Leave every other record alone, especially `MX` and `TXT` (email and
   verification).
6. If there is a `CAA` record, make sure one allows `letsencrypt.org`.
   Otherwise Vercel can't issue the HTTPS certificate. No `CAA` record at all
   is also fine.

### 5c. Wait, verify, then retire GitHub Pages

1. Back on Vercel → **Settings → Domains**, both domains turn to **Valid
   Configuration** and get a certificate automatically. `.dev` domains are
   HTTPS-only in every browser, so wait for the certificate before testing.
2. Check `https://generosomm.dev` and `https://www.generosomm.dev` (the second
   should redirect to the first). Then run
   `https://generosomm.dev/api/health?key=…` again. The `/api` route only
   exists on Vercel, so a JSON answer proves you're on Vercel and not GitHub
   Pages.
3. Only after that: GitHub → repo **Settings → Pages** → under **Build and
   deployment**, set **Source** to **None** (unpublish). Leave the `CNAME`
   file in the repo for now; Phase 7 removes it.

**Rollback** (if anything goes wrong): put the four GitHub `A` records and the
`www → generosomm.github.io` CNAME back at Name.com, and re-enable Pages.

---

## 6. YouTube API key

Public channel stats only need an API key: no OAuth and no app review.

1. Go to <https://console.cloud.google.com> and sign in with any Google account
   (it doesn't have to own the channel).
2. Project dropdown (top bar) → **New Project** → name `generosomm-stats` →
   **Create**, then make sure it is selected.
3. ☰ menu → **APIs & Services → Library** → search **YouTube Data API v3** →
   open it → **Enable**.
4. **APIs & Services → Credentials** → **+ Create credentials → API key**.
   Copy the key → this is `YOUTUBE_API_KEY`.
5. Click the new key (or **Edit API key**) to restrict it:
   - **Name:** `generosomm-stats-server`
   - **Application restrictions:** `None`. The calls come from Vercel's
     servers, whose IP addresses change, and website restrictions only apply
     to browser calls. The key never reaches a browser.
   - **API restrictions:** **Restrict key** → tick only **YouTube Data API
     v3** → **Save**.
6. Find your channel ID: sign in to YouTube as the channel → open
   <https://www.youtube.com/account_advanced>, or **YouTube Studio → Settings
   → Channel → Advanced settings**. It starts with `UC`. That's
   `YOUTUBE_CHANNEL_ID`.
7. Add both to Vercel (Production + Development), redeploy, and check
   `/api/health` shows `youtube` as `true`.

**Quota:** 10,000 units/day free. Every call this project makes costs 1 unit,
and a full refresh is about `1 + 2 × (videos ÷ 50)` units. With a refresh
every 30 minutes that's roughly 1,000 units a day even with 500 videos. You
can watch usage in **APIs & Services → YouTube Data API v3 → Quotas & system
limits**.

---

## 7. TikTok developer app (Sandbox)

> **Read this first.** TikTok's App Review Guidelines say *"Apps must not be
> for private or personal use."* An app that only shows your own stats on
> your own portfolio is exactly that, so a production review would very
> likely be rejected. Don't describe the app as something it isn't to get
> through review.
>
> The plan is to **stay in Sandbox mode**, which needs no review. You add
> @eroedtx as a sandbox **target user** (up to 10 accounts). Phase 3's first
> job is to confirm that Sandbox returns your real stats. If it doesn't,
> TikTok falls back to your documented numbers with `status: "manual"`.

### 7a. Developer account

1. Go to <https://developers.tiktok.com/signup> → sign up with your email →
   verify it → log in.
2. When asked about an organization, you can register as an **individual**.
   TikTok recommends organizations for production apps, which this won't be.

### 7b. Create the app

1. Profile icon (top right) → **Manage apps** → **Connect an app** → choose
   your individual account → **Confirm**.
2. **App details:**
   - **App icon:** 1024 × 1024 px PNG/JPG, at most 5 MB. Your own mark, not
     TikTok's logo. A square crop of `assets/images/pfp.png` works.
   - **App name:** `generosomm.dev`. Names that mention TikTok or other
     platforms, or that describe the feature ("Stats Viewer"), get flagged.
   - **Category:** the closest fit to a personal portfolio.
   - **Description:** shown on the login screen when you connect, so keep it
     honest: *"Shows Merwin Generoso's own TikTok follower and view counts on
     his portfolio, generosomm.dev."*
   - **Terms of Service URL:** `https://generosomm.dev/terms.html`
   - **Privacy Policy URL:** `https://generosomm.dev/privacy.html`

     Both pages now exist in this repo and the footer links to them. Review
     their text first (each file has a `TODO(Merwin)` comment at the top).
   - **Platforms:** tick **Web** → **Website URL:** `https://generosomm.dev`
3. **Save** (don't submit for review).

### 7c. Verify you own generosomm.dev

TikTok asks you to prove you own every URL you entered.

1. At the top of the app page, make sure you're on **Production**, then click
   **URL properties** → **Verify properties**.
2. Choose **Domain** → enter `generosomm.dev` → TikTok shows a `TXT` record
   value (`tiktok-developers-site-verification=…`).
3. At Name.com → **Manage DNS Records** → **Add** a `TXT` record: Host = blank
   (or `@`), Answer = the value TikTok gave you.
4. Wait a few minutes, then click **Verify** in TikTok. One domain check
   covers every URL under `generosomm.dev`.

(Alternative: **URL prefix** verification gives you a signature file to
upload. If you prefer that, send it to me and I'll commit it to the site root.)

### 7d. Create the sandbox

1. On the app page, switch the **Production / Sandbox** toggle (top left) to
   **Sandbox** → **Create Sandbox** → name it `live-stats`.
2. Inside the sandbox, under **Products** → **Add products**: add **Login
   Kit** and **Display API**.
3. **Login Kit → Redirect URI → Web:** add
   `https://generosomm.dev/api/auth/tiktok/callback`. It must be HTTPS and
   static (no `?` parameters).
4. **Scopes:** make sure these are added: `user.info.basic`,
   `user.info.profile`, `user.info.stats`, `video.list`. Nothing else: asking
   for scopes you don't use is a classic red flag.
5. **Target users** (sandbox sidebar or section) → **Add account** → log in as
   **@eroedtx**. The account you'll connect in Phase 3 must be listed here.
6. **Credentials:** the sandbox has its own **Client key** and **Client secret**
   (in the sandbox's app details or credentials section). Copy them →
   `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET`. If your portal only shows one
   pair for the whole app, use that pair.
7. Add to Vercel (Production + Development):
   - `TIKTOK_CLIENT_KEY`
   - `TIKTOK_CLIENT_SECRET`
   - `TIKTOK_REDIRECT_URI` = `https://generosomm.dev/api/auth/tiktok/callback`

### What production review would need

You asked what to submit for review. For the record, here is what TikTok
requires. Again, I don't recommend submitting, given the personal-use rule.

- A detailed explanation of how each product (Login Kit, Display API) and each
  scope is used.
- 1–5 demo videos (each ≤ 50 MB) showing the full flow **on the same domain**
  as the website URL: open the site → TikTok login → consent screen → the
  stats appearing.
- Live Privacy Policy and Terms links, visible on the site without opening
  any menu (the new footer links cover this).
- A finished, public website, and an app description that doesn't call
  itself a test or beta.

---

## 8. Meta app for Instagram

**Before you start:** @eroedtx must be an Instagram **Professional** account
(Creator or Business). Check in the Instagram app: **Settings → Account type
and tools**. If it offers *"Switch to professional account"*, do that and
choose **Creator**.

This uses **Instagram API with Instagram Login**. It needs no Facebook Page,
and because you're only reading your own account, the app **stays in
Development mode for good**. No App Review and no Business Verification.

1. Go to <https://developers.facebook.com> → log in with Facebook → if
   prompted, **Get started** to register as a developer (verify phone/email).
2. **My Apps → Create App**.
   - **App name:** `generosomm.dev` · **Contact email:** your email → **Next**.
   - **Use cases:** pick **Manage messaging & content on Instagram** → **Next**.
   - **Business portfolio:** choose *I don't want to connect a business
     portfolio yet* → **Next** → **Create app**.
3. In the app: **Use cases** (left sidebar) → **Manage messaging & content on
   Instagram** → **Customize** → **API setup with Instagram login**.
4. **1. Add required permissions:** make sure **`instagram_business_basic`**
   and **`instagram_business_manage_insights`** are added. Don't add publishing
   or messaging permissions; we don't use them.
5. **Give @eroedtx a role on the app** (required in Development mode):
   - Sidebar **App roles → Roles** → **Add People** → **Instagram Tester** →
     enter `eroedtx` → **Add**.
   - Accept the invite as @eroedtx: on the web, open
     <https://www.instagram.com/accounts/manage_access/> → **Tester invites**
     → **Accept**. (In the app it's under **Settings → Website permissions →
     Apps and websites**.)
6. Back in **API setup with Instagram login**:
   - **3. Set up Instagram business login** → **Business login settings** →
     **OAuth redirect URIs:** add
     `https://generosomm.dev/api/auth/instagram/callback` → **Save**.
   - On the same screen, copy the **Instagram app ID** and **Instagram app
     secret**. **These are not** the Meta App ID on the dashboard home.
7. **App settings → Basic:** set **Privacy Policy URL** to
   `https://generosomm.dev/privacy.html` and **Terms of Service URL** to
   `https://generosomm.dev/terms.html` → **Save changes**.
8. **Don't switch the app to Live.** Leave the **App Mode** toggle on
   **Development**.
9. Add to Vercel (Production + Development):
   - `INSTAGRAM_APP_ID`
   - `INSTAGRAM_APP_SECRET`
   - `INSTAGRAM_REDIRECT_URI` = `https://generosomm.dev/api/auth/instagram/callback`

What the API can and can't count, so the numbers on the site match what you
expect:

- `impressions` no longer exists (replaced by `views` in April 2025).
- Per-post insights are kept for **2 years**. Older posts count as 0 in the
  live sum, which is why the site keeps a documented baseline.
- Posts inside carousels have no individual insights.
- Numbers can lag up to 48 hours.

---

## 9. Facebook Page (only if you have one)

**First, find out what `facebook.com/eroedtx` is.** Open
<https://www.facebook.com/pages/?category=your_pages> while logged in:

- **eroedtx is listed there** → it's a **Page**. Continue below.
- **It isn't** → it's your personal profile (professional mode counts as a
  profile). Meta has **no API for profile insights**. Skip this section and
  leave `FACEBOOK_PAGE_ID` empty. The site shows Facebook as `disabled`, and
  your Facebook views stay inside the documented baseline.

If it is a Page:

1. In the same Meta app → **Use cases** → **Add use case** → **Manage
   everything on your Page** → **Add**. (If Meta says it can't be combined
   with the Instagram use case, create a second app with only this use case.)
2. **Customize** that use case → make sure **`pages_show_list`**,
   **`pages_read_engagement`** and **`read_insights`** are added.
3. **Facebook Login → Settings** → **Valid OAuth Redirect URIs:**
   `https://generosomm.dev/api/auth/facebook/callback` → **Save**.
4. **App settings → Basic:** copy **App ID** → `META_APP_ID` and **App
   secret** (click **Show**) → `META_APP_SECRET`.
5. **Page ID:** on the Page → **About** → **Page transparency** → **Page ID**
   → `FACEBOOK_PAGE_ID`.
6. Add all four to Vercel, plus
   `FACEBOOK_REDIRECT_URI` = `https://generosomm.dev/api/auth/facebook/callback`.

Your Facebook account is the app's admin, so Development mode is enough here
too.

---

## 10. Full env var checklist

All in Vercel → **Settings → Environment Variables**, environments
**Production** and **Development**. `.env.example` has the same list with
comments.

| Variable | From | Step |
|---|---|---|
| `ADMIN_SECRET` | generated | 1 |
| `CRON_SECRET` | generated | 1 |
| `SITE_ORIGINS` | optional; leave empty | — |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_*`) | added by Vercel | 3 |
| `YOUTUBE_API_KEY` | Google Cloud | 6 |
| `YOUTUBE_CHANNEL_ID` | YouTube | 6 |
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | TikTok sandbox | 7 |
| `TIKTOK_REDIRECT_URI` | `https://generosomm.dev/api/auth/tiktok/callback` | 7 |
| `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` | Meta → Instagram business login | 8 |
| `INSTAGRAM_REDIRECT_URI` | `https://generosomm.dev/api/auth/instagram/callback` | 8 |
| `META_APP_ID` / `META_APP_SECRET` | Meta → App settings → Basic (Page only) | 9 |
| `FACEBOOK_REDIRECT_URI` | `https://generosomm.dev/api/auth/facebook/callback` (Page only) | 9 |
| `FACEBOOK_PAGE_ID` | Page transparency, **or empty** | 9 |

After adding variables, always **Redeploy**: existing deployments keep the
values they were built with.

**Never** paste a real value into `.env.example`, a `data/*.json` file, a
commit message or an issue. If one ever leaks, regenerate it on the
platform's dashboard and update Vercel. The old value stops working.

---

## 11. Local development (optional)

Lets you run the functions on your machine before pushing.

```sh
npm i -g vercel                    # the Vercel CLI (a global tool, not a project dependency)
vercel login
vercel link                        # pick the generosomm project
vercel env pull .env.local         # copies Development env vars into .env.local (git-ignored)
vercel dev                         # site + /api on http://localhost:3000
```

Then open `http://localhost:3000/api/health?key=YOUR_ADMIN_SECRET`.

Limits of local testing:

- **OAuth "connect" flows can't run on localhost.** TikTok only accepts HTTPS
  redirect URLs, and all three are registered for `generosomm.dev`. Do the
  one-time connects on production.
- **Crons don't run under `vercel dev`.** Call the endpoint by hand instead.
  Phase 5 shows how.
