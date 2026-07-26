# Merwin Generoso — Remote Work Portfolio

A proof-first portfolio featuring high-performing video work, shipped software, and the research and digital support services available to remote teams.

[View the live site](https://generosomm.github.io/merwin-portfolio-ve/) · [Email me](mailto:generosomerwin10@gmail.com)

## Why this portfolio is different

The site is designed as a compact work index instead of a long CV. It leads with outcomes, explains concrete deliverables, and lets visitors inspect original videos, analytics screenshots, live products, source repositories, and verified certifications.

## Project structure

```text
merwin-portfolio-ve/
├── assets/
│   ├── images/                 # Project covers, analytics, certificates, and social preview
│   ├── videos/                 # Local portfolio video previews
│   └── Merwin_Generoso_CV.pdf  # Downloadable CV
├── css/
│   └── styles.css              # Design tokens, components, and breakpoints
├── data/
│   ├── 00-meta.json            # Page title, search description, and social metadata
│   ├── 01-nav.json             # Header brand, navigation, and CTA
│   ├── 02-hero.json            # Hero copy, actions, services, and headline proof
│   ├── 03-services.json        # Ways I can help
│   ├── 04-work.json            # Video projects and results
│   ├── 05-dev.json             # Software projects and repository links
│   ├── 06-operations.json      # Research and remote-support scope
│   ├── 07-stats.json           # Analytics proof
│   ├── 08-testimonials.json    # Optional verified client feedback
│   ├── 09-about.json           # About copy and facts
│   ├── 10-credentials.json     # Certificates and verification link
│   └── 11-contact.json         # Contact copy, links, location, and footer
├── js/
│   ├── content.js              # JSON loading and section rendering
│   └── app.js                  # Navigation, dialogs, dragging, and scroll reveals
├── .gitignore
├── index.html                  # Semantic page content and metadata
└── README.md
```

## Run locally

There are no dependencies or build steps. Run a local server so the browser can load the JSON files:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Main features

- Semantic, accessible HTML
- Responsive layouts for mobile, tablet, and desktop
- Keyboard-friendly native video and image dialogs
- Horizontal project galleries with mouse drag, keyboard, buttons, and touch navigation
- Recruiter-focused service menu with concrete remote deliverables
- Explicit project scope and feature details
- Prefilled email inquiry for faster client conversations
- Reduced-motion support
- Lazy-loaded portfolio evidence
- Open Graph metadata for link previews
- No framework and no runtime dependencies

## Updating content

- Edit copy, links, project entries, and section items in `data/*.json`.
- Add or remove an item from its JSON array; the corresponding gallery or list updates automatically.
- `08-testimonials.json` stays hidden while `enabled` is `false`; publish only real feedback you have permission to show.
- Keep valid JSON syntax: double-quoted keys and strings, commas between entries, and no trailing comma after the last entry.
- `index.html` contains matching fallback content for search engines and direct file opening. The JSON data becomes the visible source when served locally or through GitHub Pages.
- Edit colors and spacing through the custom properties at the top of `css/styles.css`.
- Add preview images to `assets/images/` and videos to `assets/videos/`.
- Keep large source footage out of the repository; use compressed portfolio previews.

## Built with

HTML5, CSS3, vanilla JavaScript, Manrope, and DM Mono.

© 2026 Merwin Generoso. Designed and built from scratch.
