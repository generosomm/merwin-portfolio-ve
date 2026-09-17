# Merwin Generoso | Portfolio

**Systems Integrator & Creative Technologist**

Live at [generosomm.vercel.app](https://generosomm.vercel.app/)

---

## Positioning & Copy

All portfolio copy (hero, section headings, about, meta tags) is written for an **enterprise systems integration** audience: "Systems Integrator & Creative Technologist," backend/EDI/AI-media framing, no em dashes in generated copy. The words "student," "intern," "OJT," and "4th year" do not appear anywhere in `data/*.json` or `index.html`. The two organizations that used to be labeled with "Student" in their name are shown under the same short names the rest of the site already uses for them — `data/05-dev.json`'s `roleSpotlight.organization` is "MSC NU Laguna" (matching the `MSC NU Laguna website` project and `mscnulaguna.org` right below it) and `data/04-work.json`'s is "NU Laguna Computer Studies Council" (matching the `NULagunaSCSSC` Facebook handle it links to) — real affiliations, just without the literal word "Student" in the on-page label.

The hero's old "Open to enterprise systems roles" availability badge has been removed from `data/02-hero.json`.

---

## Stack

| Layer | Technology |
|---|---|
| Rendering | Vanilla JS (component functions in `content.js`) |
| Styling | Vanilla CSS (`css/styles.css`) |
| Animations | GSAP 3 + ScrollTrigger (`js/motion.js`) |
| Data | JSON files in `data/` (fetched at runtime) |
| Hosting | Vercel (static) |

---

## Architecture

### Data-Content System

The portfolio is **fully data-driven**. Every section reads from a JSON file in `data/`. The HTML shell (`index.html`) contains only structural anchors via `data-content` attributes. `content.js` fetches all JSON files in parallel, then each renderer injects HTML into the matching mount point.

```
index.html (structure only)
    └── data-content="hero"        → renderHero()        ← data/02-hero.json
    └── data-content="ai-hooks"    → renderAiHooks()     ← data/13-ai-hooks.json
    └── data-content="work"        → renderWork()        ← data/04-work.json
    └── data-content="dev"         → renderDevelopment() ← data/05-dev.json
    └── data-content="stats"       → renderStats()       ← data/07-stats.json
    └── data-content="about"       → renderAbout()       ← data/09-about.json
    └── data-content="credentials" → renderCredentials() ← data/10-credentials.json
    └── data-content="contact"     → renderContact()     ← data/11-contact.json
```

### Section Order

```
Hero
 └─ #work (single section, three subsections)
     01 AI-Generated Media (Google Flow Hooks, auto-scrolls right)
     02 Video Editing (Selected Editing Work, auto-scrolls left)
     03 Web Systems & Backend (View GitHub)
 └─ Scale & Proof
 └─ Credentials
 └─ Contact
```

All three subsections live inside one `<section id="work">`, matching the
site's original structure — `#work > .subsection` divs, not separate
top-level sections. Reordering them is a matter of reordering the
`.subsection` elements in `index.html` (and the matching numbers in
`data/12-ui.json` → `sectionIndexes`); nothing else needs to change since
each subsection is keyed by its own `data-content` attribute, not by
position.

---

## Reusable Components

### Carousel (`renderCarouselSection` + `videoCaseCard`)

**AI-Generated Media** and **Video Editing** render through the *same* carousel component in `content.js`, so they share identical markup and classes:

```js
renderAiHooks(data)  → renderCarouselSection(data, { trackId: "ai-hooks-track", ... })
renderWork(data)     → renderCarouselSection(data, { trackId: "video-track",    ... })
```

`renderCarouselSection(data, { trackId, trackLabel, controlsLabel, watchLabel, galleryLabel })` builds a plain `.gallery-shell > .video-grid.horizontal-track` of `.case-study.liquid-glass-card` items, via `videoCaseCard()`, plus prev/next `galleryControls()` — the exact same DOM every other carousel on the site uses (dev projects, proof, testimonials, certificates).

The auto-scroll, infinite loop, hover/focus/drag pause, and native drag-to-scroll are **not** carousel-specific code — they're the site's existing `.horizontal-track` auto-carousel system in `js/app.js` (the same one `#project-track` on the Web Systems carousel already used). It:

- clones each card once (`[data-carousel-clone]`, `aria-hidden="true"`, interactive descendants get `tabindex="-1"`) so the loop has no visible seam, and redirects a click on a clone to the real card underneath it;
- drives the loop with real `track.scrollLeft` (via `requestAnimationFrame`), not a CSS `transform` animation — so it composes cleanly with native trackpad scroll and pointer-drag, instead of fighting them;
- pauses on `mouseenter`/`focusin`/`pointerdown` and resumes after, respecting `prefers-reduced-motion`.

To add a new auto-scrolling carousel, or reverse one's direction, edit `js/app.js`:

```js
const isAutoCarousel = ["video-track", "project-track", "ai-hooks-track"].includes(track.id) && !reduceMotion;
const carouselDirection = track.id === "project-track" || track.id === "ai-hooks-track" ? -1 : 1;
```

`-1` visually scrolls right (used by AI-Generated Media and the Web Systems project carousel); the default `1` visually scrolls left (Video Editing).

### Liquid Glass card theme (`css/carousel-glass.css`)

A glassmorphism skin scoped **only** to `.liquid-glass-card` (both carousels above) — nothing else on the site is touched. Media is forced to a 1:1 square, cropped with `object-fit: cover` so nothing ever letterboxes regardless of the source image/video's native ratio:

```css
.liquid-glass-card .case-media { aspect-ratio: 1 / 1 !important; }
.liquid-glass-card .case-media img,
.liquid-glass-card .case-media video { object-fit: cover !important; }

.liquid-glass-card {
  background: rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);
  border-radius: 16px;
}
.liquid-glass-card:hover,
.liquid-glass-card:focus-within {
  transform: translateY(-8px) scale(1.02);
  border-color: var(--signal);
  box-shadow: 0 10px 40px rgba(0, 255, 102, 0.15);
}
```

Three things needed a scoped exception rather than a rewrite of the forbidden files:

- **`design-system.css`** forces `* { border-radius: 0 !important; }` sitewide for the flat editorial-cut look. `.liquid-glass-card`'s own `border-radius: 16px` needed `!important` too — a higher-specificity `!important` is the only thing that can beat that rule.
- **`editorial-cut.css`** has three `.case-study` rules (base surface, background, `:hover`/`:focus-within`) that reset cards to a flat white surface. Those three now read `.case-study:not(.liquid-glass-card)`, so these two carousels keep their glass surface and hover glow while every other card site-wide (repo list, operations, certificates, testimonials) is unaffected.
- **`#video-track, #ai-hooks-track`** get scoped `padding-top`/`padding-bottom: 24px` with an equal negative `margin-top`/`margin-bottom` (so the section's outer spacing doesn't shift) — room for the `translateY(-8px) scale(1.02)` hover lift to clear the track's own `overflow-y: hidden` (defined sitewide on `.horizontal-track` in `layout.css`) without its top edge clipping. The same two ids also get `scrollbar-width: none` / a hidden `::-webkit-scrollbar`, since the rest of the site's tracks keep their visible thin themed scrollbar and these two are dense enough that it read as noise.

`layout.css`, `components.css`, and `styles.css` were **not** rewritten — `styles.css` only gained one `@import "carousel-glass.css";` line so the new stylesheet loads, and `js/app.js` only gained the two one-line edits above.

### Other component functions

| Function | Renders | Data file |
|---|---|---|
| `renderHero()` | Hero section with receipt card | `02-hero.json` |
| `renderAiHooks()` | AI-Generated Media carousel (auto-scrolls right) | `13-ai-hooks.json` |
| `renderWork()` | Video Editing carousel (auto-scrolls left) | `04-work.json` |
| `renderDevelopment()` | Web Systems & Backend project carousel | `05-dev.json` |
| `renderStats()` | Analytics proof gallery | `07-stats.json` |
| `renderAbout()` | About + facts | `09-about.json` |
| `renderCredentials()` | Certificate gallery | `10-credentials.json` |
| `renderContact()` + footer | Contact form + footer | `11-contact.json` |

---

## Adding New AI Hook Videos

`data/13-ai-hooks.json`'s top-level `label` ("AI-Generated Media") feeds the `01` subsection badge; `heading`/`description` feed the intro block above the carousel. Every card is cropped to a 1:1 square by `css/carousel-glass.css` regardless of the source image's native ratio, so there's no aspect-ratio field to set.

1. **Drop the video file** into `assets/videos/`. Accepted filename format: `AI Hook [Product Name].mp4`

2. **Generate a thumbnail** and save it to `assets/images/`. Any ratio works — `object-fit: cover` crops it to a square automatically. A roughly square source (e.g. `1080x1080px`) crops the least.

3. **Edit `data/13-ai-hooks.json`** — add a new item object (same shape as `04-work.json` items):

```json
{
  "category": "Product Category Hook",
  "title": "Your Product Name",
  "description": "One line on the hook's angle.",
  "image": "assets/images/your-product-thumb.png",
  "imageAlt": "Alt text describing the frame",
  "video": "assets/videos/AI Hook Your Product Name.mp4"
}
```

4. **Save and refresh.** The carousel updates automatically — no code changes needed.

---

## Adding Video Editing Edits (TikTok/Reels)

Edit `data/04-work.json` → `items` array. Each item supports:

```json
{
  "platform": "TikTok",
  "category": "Film promo",
  "title": "Video Title",
  "result": "2.1M views",
  "image": "assets/images/thumb.jpg",
  "imageAlt": "Alt text",
  "video": "assets/videos/video.mp4",
  "postUrl": "https://tiktok.com/..."
}
```

Same as the AI hooks: `image` is cropped to a 1:1 square automatically, whatever its native ratio.

---

## Design Tokens

The palette is Green / White / Black, defined as CSS custom properties and layered across `design-system.css` → `layout.css` → `editorial-cut.css` (each file only overrides what it needs to; `editorial-cut.css`'s values win since it loads last and is always active — `index.html` adds `.editorial-cut` to `<html>` unconditionally):

```css
html.editorial-cut {
  --paper: #eef0ec;   /* page background (light) */
  --ink: #0a0d0c;     /* body text (near-black) */
  --night: #070a09;   /* dark panels: nav, hero, footer */
  --white: #ffffff;
  --signal: #31c979;  /* the neon green accent */
  --radius: 0px;       /* flat corners sitewide, by design */
}
```

**`--signal` (green) usage rule:** reserved for the accent bar next to eyebrows, active nav underline, key metrics, and hover/focus glows (e.g. `.liquid-glass-card:hover`'s border and shadow). The hero, nav, and footer are intentionally dark (`--night`) panels; the rest of the page uses the light `--paper` background with `--ink` text.

A sitewide `* { border-radius: 0 !important; }` in `design-system.css` enforces the flat "editorial cut" look everywhere. `.liquid-glass-card` (see above) is the one deliberate exception.

---

## Local Development

```bash
npx serve .
# or
npx -y http-server . -p 3000
```

Open `http://localhost:3000`.

---

## Deployment

Push to `main` on GitHub. Vercel auto-deploys from the root directory.

No build step required — this is a static site.

---

## File Map

```
merwin-portfolio-ve/
├── index.html              # HTML shell — structure only
├── css/
│   ├── styles.css          # Import manifest (Green/White/Black design system)
│   └── carousel-glass.css  # Marquee animation + Liquid Glass carousel cards
├── js/
│   ├── content.js          # All renderer functions + data fetch
│   ├── app.js              # Scroll, nav, dialog, carousel logic
│   └── motion.js           # GSAP scroll reveal animations
├── data/
│   ├── 00-meta.json        # SEO / OG tags
│   ├── 01-nav.json         # Navigation links
│   ├── 02-hero.json        # Hero copy + receipt card
│   ├── 04-work.json        # Portrait TikTok edits
│   ├── 05-dev.json         # Web systems projects
│   ├── 06-operations.json  # VA workflow samples (renderer is wired but no longer mounted in index.html)
│   ├── 07-stats.json       # Analytics proof screenshots
│   ├── 09-about.json       # About copy + facts
│   ├── 10-credentials.json # Certiport / Salesforce certs
│   ├── 11-contact.json     # Contact + footer
│   ├── 12-ui.json          # UI labels / strings
│   └── 13-ai-hooks.json    # AI-generated landscape video hooks
└── assets/
    ├── Merwin_Generoso_CV.pdf
    ├── images/             # Thumbnails, certs, analytics screenshots
    └── videos/             # MP4 files (portrait edits + AI hooks)
```
