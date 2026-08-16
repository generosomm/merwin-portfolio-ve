# Merwin Generoso - Remote Work Portfolio

A proof-first portfolio for Merwin Generoso, featuring short-form video editing, shipped web projects, creative and e-commerce support, verified analytics, and professional credentials.

[View the live site](https://generosomm.vercel.app/) | [Email Merwin](mailto:generosomerwin10@gmail.com)

## Content source of truth

All portfolio copy and user-visible interface text is stored in `data/*.json`.

This means resume-related information can be reviewed and revised without searching through HTML, CSS, or JavaScript. The renderer in `js/content.js` only turns the JSON content into page sections.

| File | Content |
| --- | --- |
| `00-meta.json` | Page title, search description, canonical URL, and social preview metadata |
| `01-nav.json` | Brand, Home link, Work dropdown, Results, About, and contact CTA |
| `02-hero.json` | Positioning, headline, intro, CTAs, and documented proof |
| `04-work.json` | Video editing work, ERO Visuals, council role, social links, results, and project descriptions |
| `05-dev.json` | Web development role, project descriptions, technologies, live links, and repositories |
| `06-operations.json` | Creative VA, e-commerce, admin, and content workflow samples |
| `07-stats.json` | TikTok and YouTube analytics evidence |
| `08-testimonials.json` | Optional verified client feedback |
| `09-about.json` | About summary, languages, and availability |
| `10-credentials.json` | Certifications and LinkedIn verification |
| `11-contact.json` | Contact copy, email template, social links, CV, location, and footer |
| `12-ui.json` | Shared interface text, accessibility labels, gallery labels, dialog text, and section numbers |

When revising resume content, start with `04-work.json`, `05-dev.json`, `06-operations.json`, `07-stats.json`, `09-about.json`, and `10-credentials.json`.

## Current features

- Fixed desktop and mobile navbar
- Compact opaque mobile navigation with accessible tap targets and a clear menu-to-close control
- Home, Work, Results, About, and Start a project navigation
- Active navbar highlighting based on the current section
- Work dropdown with direct links to Video Editing, Web Projects, and Project Support
- Smooth internal link scrolling
- Scroll position restoration after refreshing
- Responsive density tiers for small phones, regular phones, tablets, and desktop layouts
- Mobile horizontal galleries with centered card snapping and stable card widths during browser toolbar resizing
- Overflow-aware gallery arrows that stay hidden when there is nothing left to browse
- Slow seamless desktop carousels with Editing Work moving left and Web Projects moving right
- Compact mobile Editing Work and Web Project carousels with centered snapping, manual swipe, and left/right arrow controls
- Consistent mobile carousel side gutters so navigation controls do not touch project cards
- Arrow-free Editing Work and Web Project galleries with smooth glow-free edge fades
- Hidden Video, Web Project, and Workflow scrollbars while preserving mouse drag, touch swipe, links, and keyboard access
- Mouse drag, touch swipe, keyboard access, and gallery controls
- Expandable council work and project details
- Native video and image dialogs
- Clear original-post links separated from local video previews
- Verified analytics and certification evidence
- Prefilled email inquiry
- Reduced-motion support
- Reusable square-edge UI primitives for cards, actions, chips, and icon buttons
- Black-and-white interface system that keeps portfolio media in full color
- Compact page rhythm with consistent spacing between headings, cards, and sections
- Single-line responsive credentials heading with tighter card spacing
- Bidirectional scroll reveals for downward and upward scrolling
- Session-only ERO | VISUALS “Finalizing the cut” loader with a sub-1.2-second timeline and reduced-motion fade
- Critical loader fallback that keeps its text hidden if imported motion styles are stale or delayed
- Lightweight IntersectionObserver scroll reveals using opacity and GPU-friendly transforms
- Desktop glass blur with lightweight matching mobile surfaces for smoother scrolling
- Mobile performance mode replaces live backdrop blur with matching solid glass surfaces and debounces scroll persistence
- Visible frosted-glass gradients and blur-to-sharp scroll entrances
- Shared compact-density tokens for header, sections, panels, controls, and galleries
- Shared content wrappers, heading measures, wrapping rules, and work-card sizing across every section
- Simple compact panels and consistent spacing across roles, projects, supporting information, and responsive layouts
- Scoped liquid-glass surfaces that preserve the compact layout and can be disabled from one root class
- Blinking green availability indicators with a reduced-motion fallback
- Minimal divider footer with always-visible copyright, build note, and back-to-top link
- Shared minimal hover and keyboard-focus feedback across Video, Web Project, and Workflow cards
- Square play controls, flat low-radius edge softness, and high-contrast black-and-white component surfaces
- Compact light footer and a desktop navigation that only shows the menu control on mobile
- Compact contact email action instead of a full-width promotional banner
- Lazy-loaded images and portfolio evidence
- Open Graph metadata
- No framework and no runtime dependencies

## Project structure

```text
merwin-portfolio-ve/
|-- assets/
|   |-- images/                  # Project covers, analytics, certificates, and social preview
|   |-- videos/                  # Local portfolio video previews
|   `-- Merwin_Generoso_CV.pdf   # Downloadable CV
|-- css/
|   |-- styles.css               # Ordered stylesheet entry point
|   |-- layout.css               # Structural layouts and section-specific responsive rules
|   |-- design-system.css        # Color, spacing, type, border, and easing tokens
|   |-- components.css           # Reusable cards, actions, chips, controls, and section themes
|   |-- consistency.css          # Final wrapper, typography, card, and responsive consistency layer
|   |-- motion.css               # Session loader, reveal, and reduced-motion behavior
|   `-- liquid-glass.css         # Scoped glass surfaces, mobile tuning, and transparency fallbacks
|-- data/
|   |-- 00-meta.json
|   |-- 01-nav.json
|   |-- 02-hero.json
|   |-- 04-work.json
|   |-- 05-dev.json
|   |-- 06-operations.json
|   |-- 07-stats.json
|   |-- 08-testimonials.json
|   |-- 09-about.json
|   |-- 10-credentials.json
|   |-- 11-contact.json
|   `-- 12-ui.json
|-- js/
|   |-- content.js               # Loads JSON and renders every section
|   `-- app.js                   # Navigation, refresh restoration, dialogs, details, and galleries
|-- scripts/
|   |-- validate-content.mjs      # Validates JSON, assets, containers, and JSON-only visible text
|   `-- test-rendering.mjs        # Tests normal, revised, added, removed, and optional content
|-- index.html                    # Semantic containers with no hardcoded page copy
|-- README.md
`-- .gitignore
```

## Run locally

There are no dependencies or build steps. Start a local server from the project folder:

```bash
python -m http.server 5500
```

Open `http://127.0.0.1:5500/`.

Run both checks before publishing:

```bash
node scripts/validate-content.mjs
node scripts/test-rendering.mjs
```

## Updating portfolio or resume content

1. Open the matching file in `data/`.
2. Update the copy, dates, metrics, links, or project entries.
3. Keep valid JSON syntax with double quotes and no trailing comma.
4. Add new images to `assets/images/` and videos to `assets/videos/`.
5. Run the validation and rendering checks.
6. Refresh the local page.

Adding or removing entries inside an existing JSON array automatically updates its gallery or list. A completely new section type still needs a semantic container, renderer, and styles.

`08-testimonials.json` remains hidden while `enabled` is `false`. Publish testimonials only when the feedback is real and you have permission to show it.

## Built with

HTML5, modular CSS3, vanilla JavaScript, Manrope, and DM Mono.

Copyright 2026 Merwin Generoso. Designed and built from scratch.
