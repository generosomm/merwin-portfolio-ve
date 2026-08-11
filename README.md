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
| `02-hero.json` | Availability, positioning, headline, intro, CTAs, and documented proof |
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
- Home, Work, Results, About, and Start a project navigation
- Active navbar highlighting based on the current section
- Work dropdown with direct links to Video Editing, Web Projects, and Project Support
- Smooth internal link scrolling
- Scroll position restoration after refreshing
- Responsive mobile, tablet, and desktop layouts
- Mobile horizontal galleries with centered card snapping and stable card widths during browser toolbar resizing
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
- Smooth page-entry curtain and bidirectional scroll reveals
- Lightweight IntersectionObserver scroll reveals using opacity and GPU-friendly transforms
- Subtle glass blur surfaces with reduced mobile blur for smoother scrolling
- Visible frosted-glass gradients and blur-to-sharp scroll entrances
- Shared compact-density tokens for header, sections, panels, controls, and galleries
- Square play controls, flat low-radius edge softness, and high-contrast black-and-white component surfaces
- Compact light footer and a desktop navigation that only shows the menu control on mobile
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
|   `-- motion.css               # Curtain, reveal, and reduced-motion behavior
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
