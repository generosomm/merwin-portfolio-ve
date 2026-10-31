# Merwin Generoso | Portfolio

Live site: [generosomm.dev](https://generosomm.dev/).

A framework-free portfolio featuring website projects, video edits, experience, proof, services and contact details. Public copy comes from JSON files under `data/`.

## Architecture

- `index.html` provides section mounts, static crawler metadata and a generated initial hero. Essential work/contact links remain available without JavaScript or when content fails to load.
- `js/content.js` owns `CONTENT_FILES`, fetches content and renders the page. Localhost reads the individual JSON files; production prefers the generated `data/site.json` bundle and falls back to individual sources.
- Stylesheets load directly from `index.html`. `css/hero.css` controls the layered portrait/name layout; `css/studio.css` styles the navigation, website deck and Experience disclosures.
- `js/site.js` handles core navigation, scrolling and hero behavior. `js/interactions.js` handles galleries, media, disclosures, GitHub activity and the project-brief form.
- `js/studio.js` enhances the project deck, thumbnails, cursor cue, Experience details and navigation visibility. `js/studio-motion.js` adds finite Web Animations entrances. `js/motion.js` uses locally hosted GSAP/ScrollTrigger alongside optional Lenis scrolling, with reduced-motion and missing-library fallbacks.
- `api/` and `lib/` implement Vercel serverless integrations for social stats, visits and moderated visitor notes. They are separate from the static renderer.

## Current page order

Hero, Selected websites, Selected Edits, About, Track Record, Services, Proof, Experience, Stack, Visitor Notes, Contact, footer.

The desktop social rail has six links. Below 1100px they appear inside the hero. Desktop navigation sits at the top; phone navigation sits above the bottom safe area and browser keyboard. Navigation tucks while scrolling down and returns after a short upward scroll, while an open menu or focused navigation stays visible. The hero links to the author's Universal Web Dev repository; an AI work navigation item leads to its dedicated feature within Work.

Website projects use a three-preview deck with arrows, thumbnails, keyboard navigation and horizontal swipe. One active project has its description and live-site link below. Systems without a live link remain in a text-only archive. Traffic-light window dots are decorative. Experience supports hover, focus, tap pinning and Escape.

Selected projects offer native case-study disclosures. The separate Universal Web Dev feature explains original authorship, workflow design and Python tooling while crediting upstream specialist authors. Stack shows four tools from each primary group, with the complete catalog in an accessible disclosure. The site guide is tap-to-speak on touch devices and stays quiet automatically around Contact. Proof carousels enhance only near the viewport.

## Content map

| File | Purpose |
| --- | --- |
| `data/00-meta.json` | Title, description, canonical, social preview and structured data |
| `data/01-chrome.json` | Navigation, social links and section headings |
| `data/02-hero.json` | Name, portrait sources, short intro and work/CV actions |
| `data/03-about.json` | About copy |
| `data/04-numbers.json` | Track Record configuration |
| `data/05-experience.json` | Real roles, organizations and details |
| `data/06-practice.json` | Services and inquiry actions |
| `data/07-work.json` | Website projects, live destinations and viewer labels |
| `data/08-edits.json` | Selected video work |
| `data/09-proof.json` | Analytics and certification proof |
| `data/10-stack.json` | Tools and GitHub graph configuration |
| `data/11-contact.json` | Contact form, email links and footer |
| `data/12-ui.json` | Shared interface text |
| `data/social.json`, `data/notes.json` | Social-stat baselines and Visitor Notes UI |
| `data/github-contributions.json` | Saved contribution snapshot, refreshed by GitHub Actions |
| `data/site.json` | Generated production content bundle; do not edit manually |

Legacy source files may still exist, but the active content map is `CONTENT_FILES` in `js/content.js`. Preserve the distinction between documented analytics snapshots and live provider totals.

## Local preview

Use Node.js 24 for project scripts and Python 3 for a static preview:

```sh
python -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173/`. A static Python server cannot execute Vercel APIs or Vercel Analytics. API/analytics requests may return 404 locally; content rendering should still work. Use `vercel dev` with the project's authorized environment configuration to test those integrations.

The project-brief form submits directly to Web3Forms using its public form access key in `data/11-contact.json`. It shows loading, accepted-submission and failure feedback without navigating away. A failed or timed-out request preserves the inquiry for retry; only an explicit successful API response resets the form. Separate email links still use the email app on phones and Gmail compose on desktop. Actual inbox delivery requires separate verification.

## Editing and checks

After changing JSON content:

```sh
npm run build
npm run validate
npm test
```

- `build` regenerates `data/site.json`, the initial hero/access markup and content-derived asset version hashes. Do not hand-edit generated regions in index.html.
- `validate` checks wired JSON, referenced assets, bundle freshness and exact initial-markup parity with the renderer.
- `test` runs current rendering, studio features, motion startup/fallbacks, navigation visibility, discovery metadata and mocked backend behavior.

The rendering/motion tests target the active architecture. Mock tests do not prove live credentials, provider availability or production delivery. Browser-check the changed flow at desktop, tablet and small-phone widths, with keyboard, touch and reduced motion. Physical-device and cross-browser checks remain separate.

Static title/description/social tags and JSON-LD also live in `index.html` for crawlers. When changing metadata in `data/00-meta.json`, update those static copies. The discovery test checks JSON-LD parity. `robots.txt` advertises `sitemap.xml`, which includes only the home, privacy and terms pages. Crawler exclusions for `/api/` and `/notes-admin.html` are not access control.

`404.html` provides branded recovery navigation. Verify both its content and the actual HTTP 404 status after deployment; a basic Python preview does not automatically serve this file for unknown paths.

## Deployment and credentials

Vercel serves the root directory and automatically deploys authorized pushes to `main`. `vercel.json` disables automatic build-command detection because deployment uses the committed content bundle and excludes local scripts. `npm run build` is a local pre-push step. Rebuild and validate the bundle before a push. Enable the optional commit hook with `git config core.hooksPath .githooks`; it rebuilds/stages the bundle and validates content.

Keep credentials in Vercel environment variables or ignored local environment files. `.env.example` documents names only. Do not commit secrets, unredacted certificates or provider tokens. `.vercelignore` excludes original video masters and repository tooling from CLI deployment. Original video masters stay in Git; the browser plays compressed files under `assets/videos/web/`.

Before publishing, inspect the diff, run checks and verify the deployed domain. Production APIs, physical devices, accessibility coverage and performance must be reported according to what was actually tested.
