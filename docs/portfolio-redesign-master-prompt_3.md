# MASTER PROMPT: generosomm.dev Redesign (2026), v2 with Minimal 3D

Paste everything below into Claude in VS Code, with your portfolio repo open as the workspace.

---

## ROLE

You are a senior creative front-end developer, UI/UX designer, and real-time 3D web developer who builds award-level personal portfolios (Awwwards / Godly / Minimal Gallery quality). You write clean, framework-free, performant code, and you care about motion, typography, 3D craft, and accessibility in equal measure. You know how to make WebGL feel quiet and premium instead of flashy.

## CONTEXT

I'm Merwin Generoso, a 4th year BS Information Technology student (NU Laguna x Asia Pacific College) in the Philippines. My portfolio lives at generosomm.dev and is in this repo. It's built with plain HTML5, CSS3, and JavaScript, deployed on GitHub Pages / Vercel, and its content is driven by JSON files in a `/data` folder.

I'm two things at once, and the site must show both clearly:

1. Systems & backend developer: Node.js, Express, PHP, MySQL, REST APIs, EDI integrations, technical documentation, project leadership.
2. Creative technologist / video editor: ERO | VISUALS, short-form edits with 70M+ documented organic views, AI-generated product media.

The current site works, but the UI/UX feels cluttered and template-like: too many boxed cards, too many monospace labels, too much competing for attention. I want it to feel premium, calm, confident, and editorial, with a layer of minimal 3D that makes it memorable.

## DESIGN DIRECTION

I'm inspired by the feel of a minimal dark editorial portfolio (reference: seanpaul.is-a.dev). Do NOT copy it. Do not reuse its layout one-to-one, its copy, its section names, its 3D objects (keyboard, laptop, globe), or its orange accent. Take the principles and make something that is clearly mine.

### Principles to adopt

- Near-black canvas (`#0A0A0A` range), lots of negative space, few elements per screen.
- Giant display typography as the main visual. Big confident headings with tight tracking and a clear type scale.
- One accent color, used sparingly to highlight key words only.
- Minimal fixed chrome around the viewport edges instead of a heavy navbar.
- Motion that rewards scrolling: scroll-linked text reveals, smooth scrolling, stacked/sticky cards, hover previews. Smooth and purposeful, never gimmicky.
- Full-width hairline dividers instead of boxed cards wherever possible.

### What makes it MINE (required differentiators)

- **Accent color:** keep my green from the current brand (around `#2BD47D`; tune it for contrast on near-black). No orange.
- **Signature motif: "the editor's timeline."** I'm a video editor, so borrow the language of an editing timeline:
  - A thin playhead / scrub bar fixed at the top or side that shows scroll progress, with a running timecode (e.g. `00:01:24:12`) that updates as you scroll.
  - Section labels written like clip markers (e.g. `CLIP 03 · SYSTEMS`).
  - The experience section shown as timeline tracks (horizontal rows like video tracks) instead of a plain list.
  - Keep it subtle and elegant. It should be a theme, not a costume.
- **Secondary motif: systems.** One small, tasteful nod to my backend side, such as a single line of animated "request → response" text or a status indicator (`● system online`) in the fixed chrome. Only one, not a terminal theme everywhere.
- **Typography:** pick a distinctive pairing that is NOT the reference's font. Suggestion: a grotesk display face (e.g. "Clash Display", "General Sans", "Satoshi", or "Space Grotesk") + a clean body sans + a monospace used ONLY for timecodes and small labels. Load via Fontshare or Google Fonts.

## MINIMAL 3D LAYER (new)

I want 3D that feels like a premium product render, not a tech demo. Think matte objects, soft studio light, slow motion, lots of empty space around it. The 3D must extend my timeline motif, not introduce a new theme.

### 3D art direction

- **Style:** minimal, monochrome, matte. Dark graphite and off-white materials only, with my green appearing ONLY as a thin rim light, an edge glow, or one emissive detail. No rainbow gradients, no chrome-everything, no neon overload, no busy particle fields.
- **Geometry:** simple primitives with soft beveled edges (rounded boxes, thin slabs, cylinders, a torus at most). Low poly count. No imported character models, devices, or globes.
- **Lighting:** one soft key light, one subtle green rim light, soft contact shadow on an invisible floor. Light film grain or very soft fog is OK if it stays cheap.
- **Motion:** slow, weighted, eased. Idle float/rotation is almost imperceptible. Cursor parallax is gentle (a few degrees max). Scroll drives the main changes through GSAP ScrollTrigger, so 3D and typography move as one system.

### The hero 3D object: "the clip stack" (my signature)

- 5 to 7 thin rounded slabs floating in a gentle arc, like video clips or frames pulled out of an editing timeline into 3D space.
- Each slab has a matte face. One or two faces can show a very low-res, desaturated frame from my edits (texture from `/data`, lazy-loaded), the rest are plain.
- A thin green "playhead" plane or line passes through the stack. As the page scrolls, the playhead moves through the clips and the clip it touches lifts slightly and catches the green rim light. This connects the 3D directly to the fixed timecode/scrub bar in the chrome.
- Cursor movement tilts the whole stack a few degrees (desktop only).
- Layering in the hero: 3D scene at the back, then my giant name, then my cutout portrait, with part of the name in front of the portrait. The 3D must never compete with my name for attention. If it does, push it back (smaller, darker, more blur/fog).

### Where else 3D (or 3D-feel) appears

Keep it limited. Real WebGL lives in at most TWO places; everything else uses CSS 3D transforms.

1. **Hero:** the clip stack (WebGL).
2. **Section transition or closing CTA (WebGL, reusing the same scene and canvas):** the clip stack reassembles into one single clean frame / slab as I reach the closing statement, like an edit being "rendered" into the final export. Reuse the same renderer instead of creating a second WebGL context.
3. **CSS 3D only (no WebGL):**
   - Project preview image that follows the cursor gets a subtle perspective tilt based on cursor velocity.
   - "What I do" stacked cards get a slight `rotateX` and depth as they stack.
   - Certification cards in Proof get a gentle tilt-on-hover with a soft green specular sheen.
   - Experience timeline tracks can have a very slight perspective so they read like a real NLE timeline viewed at an angle, flattening on hover.

### 3D performance and fallback rules (non-negotiable)

- Use **Three.js** (ES module via CDN, import only what's needed). Lazy-load it after the hero text and portrait have painted. The site must be fully readable and look finished before any 3D loads.
- Cap device pixel ratio at 1.5, use `antialias` only if performance allows, keep draw calls and triangles low, use compressed/small textures (WebP or KTX2), and dispose of resources properly.
- Pause the render loop when the canvas is offscreen (IntersectionObserver) and when the tab is hidden.
- Target a steady 60fps on a mid-range laptop. Total 3D JS + assets budget: aim for roughly 200KB gzipped or less. Tell me the actual size.
- **Fallback:** if WebGL isn't available, on low-power/mobile devices (use a simple capability check), or with `prefers-reduced-motion`, show a pre-rendered static image of the clip stack (AVIF/WebP with a fixed aspect ratio so there's zero layout shift). Tell me how to generate this poster image (e.g. a one-click "export poster" debug helper that saves a PNG from the canvas).
- The canvas is decorative: `aria-hidden="true"`, no focusable content, and never blocks clicks on text or CTAs.

## PAGE STRUCTURE

1. **Preloader:** a short loading screen designed as a timeline render (a progress bar filling like an export bar with a timecode counter), then it reveals the hero. Must finish fast (under ~1.5s), must NOT wait for Three.js to load, and must be skippable or disabled for `prefers-reduced-motion`. Optional: the export bar hands off to the 3D playhead line in the hero as a single continuous motion.
2. **Hero:** my name huge on screen, with a cutout portrait of me layered with the type (part in front, part behind) and the 3D clip stack behind everything. Short line under it: "Systems developer & creative technologist from the Philippines." Two CTAs: "View work" and "View CV". Fixed chrome: logo/name top-left, compact nav top-right, social icons along one edge, playhead/timecode as described.
   - If no cutout photo exists in the repo yet, build it with a placeholder slot and tell me the exact image specs I need (transparent PNG/WebP, dimensions, crop).
3. **About (scroll-reveal statement):** a large paragraph where words go from dim gray to white as you scroll, with my key words in the accent color (e.g. systems, integrations, stories, 70M+ views). Write it in first person, honest, no hype.
4. **Numbers:** 3 or 4 stat blocks with count-up animation. Use ONLY real numbers from my data: 70M+ documented views, number of shipped projects (count them from my data), years creating (since 2022), certifications (3). No invented stats.
5. **Experience (timeline tracks):** each role is a full-width row like a video track: year range on the left, role + organization, and a thin "clip" bar showing duration. Hover shows a small preview or detail. Optional subtle CSS perspective as described above. Roles: Web Development Lead (MSC NU Laguna, Jun 2025 to Jul 2026), Capstone Project Lead (City Government of Sto. Tomas, 2025 to 2026), Video Production Officer (NU Laguna SCS Council, 2025 to present), Creator & Video Editor (ERO | VISUALS, personal content brand, 2022 to present). Never use "Founder", "CEO", or "Owner" for ERO | VISUALS, since it is not a DTI-registered business.
6. **What I do (stacked sticky cards):** 3 cards that stack with slight 3D depth as you scroll: Systems & Backend, Video Editing & Content, AI-Generated Media. Each has a short honest description and an image/video.
7. **Selected work:** projects list with big project names as full-width rows. On hover (desktop), a preview image follows the cursor with a subtle 3D tilt and a circular "View" cursor. On mobile, show the image inline instead. Projects: MSC NU Laguna website, Document Tracking & Analytics System, Goodness Gracious (Hotel EDI Integration), Nexus Pass, plus any others in my data.
8. **Selected edits:** a grid/carousel of my top videos with view counts as small badges. Videos only load or autoplay on hover/in view (lazy).
9. **Proof:** my analytics screenshots and 3 certifications (ITS Network Security, ITS Databases, Salesforce Agentblazer Champion), presented cleanly with tilt-on-hover, with lightbox on click. Use ONLY the redacted certificate images (signatures blurred directly in the image file, not with CSS), so no original unredacted file is ever served.
10. **Stack + GitHub activity:** tech stack as minimal pills, and my GitHub contribution graph (username: `generosomm`) styled in my accent color.
11. **Closing CTA:** the 3D clip stack resolves into one final frame behind one big statement line (write something original, not "let's build the future"), email button, socials, "Open to internships & remote work," location + GMT+8. Footer with "Designed & built from scratch."

## TECH REQUIREMENTS

- Stay framework-free (HTML/CSS/vanilla JS). Allowed libraries via CDN: **GSAP + ScrollTrigger, Lenis (smooth scroll), and Three.js** (core + only the addons actually needed, e.g. `RoundedBoxGeometry`). Nothing else without asking me. No Spline runtime, no React Three Fiber.
- Keep the JSON-driven architecture. All content stays in `/data/*.json`. Restructure the JSON if needed, but I must be able to update content by editing JSON only. 3D settings that I might tweak (number of slabs, which edit frames to use as textures, accent intensity, enable/disable 3D) go in a small `/data/scene.json`.
- Keep 3D code isolated in its own module (e.g. `/js/scene/`) so the site still works if I delete it.
- CSS: use custom properties for all colors, spacing, and type scale. Use fluid type with `clamp()`. The 3D scene should read its colors from the same tokens (pass them from CSS into JS) so everything stays in sync.
- Responsive: mobile-first, no horizontal scroll, fixed chrome must collapse into a clean mobile menu. Test at 375px, 768px, 1280px, 1920px.
- Accessibility: semantic HTML, proper heading order, alt text, focus states, keyboard navigable, color contrast AA, and a full `prefers-reduced-motion` fallback (no preloader, no smooth scroll, instant reveals, static 3D poster image, no tilt effects).
- Performance: target Lighthouse 90+ on mobile (with the 3D fallback active on mobile). Lazy-load images, videos, and Three.js. Use WebP/AVIF, `font-display: swap`, no layout shift.
- SEO: title, meta description, Open Graph image (can be a nice render of the clip stack with my name), favicon.

## RULES

- Do not invent anything: no fake clients, testimonials, metrics, or job titles. If content is missing, leave a clearly marked `TODO` and tell me.
- Do not copy text, layout code, 3D concepts, or assets from the reference site.
- Preserve my existing links (GitHub, LinkedIn, TikTok, YouTube, Instagram, Facebook, CV link, email).
- 3D is seasoning, not the meal. If a 3D effect hurts readability, performance, or accessibility, cut it and tell me why.

## HOW TO WORK

1. **Audit first:** list the files, the JSON structure, the assets I have, and what's missing (especially the cutout portrait and any frames I could use as 3D textures). Do not write code yet.
2. **Propose a plan:** design tokens (colors, fonts, type scale, spacing), the section-by-section layout, the motion list, and the 3D plan (scene composition, materials, lighting, scroll choreography, performance budget, fallback). Include 2 short alternative takes on the clip stack (e.g. arc vs. fanned depth stack) so I can choose. Wait for my "go."
3. **Build in phases,** one phase per message, and stop after each so I can check it in the browser:
   - Phase 1: tokens, fonts, layout shell, fixed chrome, playhead/timecode
   - Phase 2: preloader + hero (typography + portrait layering, with the static 3D poster as a placeholder)
   - Phase 3: 3D clip stack in the hero (Three.js scene, lighting, cursor parallax, scroll-linked playhead, fallbacks, render-loop pausing)
   - Phase 4: about reveal + numbers + experience tracks
   - Phase 5: stacked cards + projects hover list + edits grid (with CSS 3D tilt touches)
   - Phase 6: proof, stack, GitHub graph, closing CTA with the 3D "final render" moment, footer
   - Phase 7: responsive pass, accessibility pass, reduced motion, performance pass (report 3D bundle size, fps on desktop, and Lighthouse mobile score)
4. **After each phase,** tell me what changed and what to test.
