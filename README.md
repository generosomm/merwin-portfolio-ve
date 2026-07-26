# Merwin Generoso — Portfolio

A proof-first digital creative portfolio featuring shipped web projects, high-performing video work, and the systems behind both.

[View the live site](https://generosomm.github.io/merwin-portfolio-ve/) · [Email me](mailto:generosomerwin10@gmail.com)

## Why this portfolio is different

The site is designed as a compact studio index instead of a long résumé. It leads with outcomes, keeps each project description short, and lets visitors inspect the original videos, analytics screenshots, live products, and source repositories.

## Project structure

```text
merwin-portfolio-ve/
├── assets/
│   ├── images/                 # Project covers, analytics, and social preview
│   ├── videos/                 # Local portfolio video previews
│   └── Merwin_Generoso_CV.pdf  # Downloadable résumé
├── css/
│   └── styles.css              # Design tokens, components, and breakpoints
├── js/
│   └── app.js                  # Navigation, dialogs, and scroll reveals
├── .gitignore
├── index.html                  # Semantic page content and metadata
└── README.md
```

## Run locally

There are no dependencies or build steps. Open `index.html` directly, or run a local server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Main features

- Semantic, accessible HTML
- Responsive layouts for mobile, tablet, and desktop
- Keyboard-friendly native video and image dialogs
- Reduced-motion support
- Lazy-loaded portfolio evidence
- Open Graph metadata for link previews
- No framework and no runtime dependencies

## Updating content

- Edit copy, links, and project entries in `index.html`.
- Edit colors and spacing through the custom properties at the top of `css/styles.css`.
- Add preview images to `assets/images/` and videos to `assets/videos/`.
- Keep large source footage out of the repository; use compressed portfolio previews.

## Built with

HTML5, CSS3, vanilla JavaScript, Manrope, and DM Mono.

© 2026 Merwin Generoso. Designed and built from scratch.
