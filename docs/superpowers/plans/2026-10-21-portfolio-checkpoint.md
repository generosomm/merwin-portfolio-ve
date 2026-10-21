# Website-first portfolio checkpoint

Goal: deliver the approved premium minimalist direction as a reviewable hero, navigation and visual website gallery.
Architecture: retain vanilla JS, existing JSON sources and interactions. A focused studio stylesheet and renderer enhancement reuse project media without new dependencies.
Spec: docs/portfolio-creative-direction-2026-10-21.md, amended by the user's website-first request and authorization to build.

## Constraints

- Website work leads. Preserve all project entries, source status, links and supporting sections.
- Glass only on compact navigation and media selector. CSS perspective provides the first checkpoint's 3D frame; live WebGL is the next checkpoint.
- Keep visible copy in JSON. Native controls, readable fallback, reduced motion and touch layouts.
- No push, deployment or commit required for this local visual review.

## Tasks

- [x] Add hero showcase content and rendered Web / Video controls. Verify default website, switch behavior and safe empty media fallback.
- [x] Build responsive sculptural media frame and compact glass navigation. Verify 1440 / 768 / 390 / 375px, reduced motion and keyboard operation.
- [x] Move website work directly after hero and display existing project screenshots inline. Preserve unavailable-link projects as unlinked entries.
- [x] Rebuild content, run validator and targeted rendering checks, inspect browser screenshots, open local preview and record evidence.

## Review focus

- Empty or malformed optional project media must not crash the hero.
- Switching from video must stop playback and release media.
- New header must preserve mobile menu and keyboard focus.
- Website images and headings must fit narrow phones.
- Static-server API failures must remain isolated from portfolio content.

Progress: first checkpoint implemented, awaiting the user's visual review under the existing per-phase review gate.

## Evidence

- scripts/test-studio.mjs: first observed failing against the old hero, then passing for website-first rendering, native controls, lazy video, malformed optional media, retained projects and unique work anchor.
- scripts/validate-content.mjs: passed, 15 wired sources, 26 parsed JSON files and 87 referenced assets.
- node --check: passed for js/content.js and js/studio.js. git diff --check: passed.
- Real headless Chrome at 1440 / 768 / 390 / 375px with reduced motion: 11 projects rendered, no horizontal overflow or runtime exceptions, website arrows and Web / Video switch passed. Mobile menu opens and closes with Escape. Muted video playback pauses when the media frame scrolls offscreen.
- Screenshots and interaction evidence: .taste-skill/checkpoint/verified-*.jpg and interaction-evidence.json. Desktop and phone screenshots reviewed; initial tablet composition also reviewed.
- Fresh review found a duplicate work anchor and overly broad video visibility observation; both fixed and regression checked.
- Full-page Taste scan remains nonzero, including pre-existing supporting-section issues and deliberate material styling. It is not a release pass. The scan preceded the final header/type cleanup; no claim of a clean final whole-page scan.
- Existing legacy test-rendering.mjs references the retired data-content architecture and was not used as evidence for the active page. Physical devices and live Vercel API functions were not tested.
- Local preview: http://127.0.0.1:4173/. No dependencies installed, commits created, pushes or deployments performed.

## Next checkpoint

### About blur restored and phone scroll cost

The user asked for the About blur-to-sharp reveal back and reported lag on phones. Desktop with a fine pointer keeps the scrubbed reveal (blur 10px→0, opacity, rise). Tablets and phones play it once as the paragraph enters: a CSS transition from blur 6px, staggered 35ms per word. The armed classes are then removed, so no filter or layer stays on the words.

Phone profiling used Playwright's bundled Chromium with iPhone-sized emulation and 4x CPU slowdown. Scripts are in the session scratchpad, not the repo. Main-thread frames stayed at about 16.7ms in every section, and long animation frames showed no scroll-time JavaScript jank. Lenis is already off on touch. The trace's raster time pointed at Stack (205ms while scrolling) and Track Record (218ms). Changes, each re-measured:
- Stack tiles on touch screens rise and fade without the springy scale: raster 205→96–105ms.
- About on phones no longer scrubs per scroll frame: raster 34→15–17ms, layout 24→0–2ms.
- The Edits strip no longer auto-drifts on touch screens. It wrote scrollLeft every frame while visible; swipe and arrows remain. Desktop drift now pauses while the page scrolls.
- The Track Record texture's mask was replaced by a gradient overlay (same look). It made no measurable difference; that section's cost is its one-time count-up and fade-in.
- Layout containment on the number cards also made no difference and was reverted.

Not verified: real phones (headless raster is software and only relative), Safari, battery use.

### Work side by side, 3D services, big-type experience

The user picked the recommended set. At 1024px and wider, the deck's active-site details sit in a right column level with the deck (CSS grid areas on the existing markup); below 1024px the stacked layout is unchanged. Services is now three columns on hairlines with no cards or images. Each service has one small CSS 3D object chosen by `shape` in data/06-practice.json (cube, disc or film). The objects rest still and turn toward a fine pointer through js/studio.js. They keep their resting pose on touch and with reduced motion. On phones the object sits above full-width text. The old stacked-card styles were removed from css/services.css. motion.js `practiceStack` and interactions.js `initStackFit` now find no cards and do nothing; delete them in the cleanup phase. Experience rows set the role in display type with year and organisation small on the right. The open row's title slides in, its details fade in beneath, and the other rows dim. Hover, focus, pin and Escape behaviour is unchanged. The grey hover box and green side bar are gone.

Evidence: the renderer test failed before the change, then passed. It covers shapes, the CTA wiring, unknown shapes, and the new experience row markup. The content validator, syntax checks and `git diff --check` passed. In-app browser at 1920×1080, 1440×900, 1366×768, 1024×768, 768×1000 and 375×812: no horizontal overflow, and the side cards never reach the details column. The active description and the strip fit on screen at every desktop size. Measured section heights at 1440: Work 1033→872px, Services 1504→709px. Pointer tilt sets and clears its values. Experience hover dims the other rows to 0.4 and shifts the title by 18px; click pins it and Escape closes it. A review then caught two bugs at 1024px, both fixed and rechecked. The strip wrapped to 7 + 1; it now uses one auto-column row. The front card covered the arrow buttons; the arrows now sit above the stage like the strip. Live stats only rewrite the views card (`[data-live="views"]`), so the automatic shipped count is not overwritten. Not verified: physical devices, Safari's handling of `:has()` dimming (rows simply don't dim without it), and a full reduced-motion pass.

### Website thumbnail strip

The user kept the 3D deck and asked for an always-visible strip of all eight live sites under it, each one jumping the deck to that site. The strip is rendered from the same live-project list (label in data/07-work.json `viewer.thumbs`), shown only once the deck enhancement runs, and marks the active site with `aria-current`. Desktop and tablet: one row of eight under the arrows. Phones: a 4×2 grid replaces the arrow row (swipe remains); phones 700px tall or less use one row of eight small tiles (at least 30×25px). Short laptop screens (≥768px wide, ≤820px tall) use flatter tiles and a tighter arrow row. The strip sits above the deck's stacking context, so a rotated side-card corner never covers a tile.

Evidence: the renderer test failed before the strip existed, then passed. The bundle build, content validator, syntax checks and `git diff --check` passed. The existing `.taste-skill` browser scripts could not launch headless Chrome on this machine, so their assertions were repeated by hand in the in-app browser. At 1920×1080, 1440×900, 1366×768, 1024×768, 768×1000, 390×844, 375×812, 375×667 and 320×640, the active description stayed on screen for all eight sites, all eight tiles were visible and nothing overflowed horizontally. At 844×390 landscape (exempt from the fit rule, as before) nothing overflowed. Clicks, arrow keys from a focused tile, and inactive cards staying inert all passed. The 1366×768 fit is tight (767 of 768px). Not verified: physical devices, real touch swipe after the change, and reduced-motion emulation. Not optimised: tiles load the full-size screenshots, about 470KB for all eight with the PNGs, instead of small thumbnail files.

### Compact release refinement

User authorized committing and publishing the accumulated portfolio redesign. Narrowed the hero composition to 1080px maximum, reduced the mobile portrait/name group and shortened introductory copy to seven words. Desktop hero now measures about 691px at 1440px and 701px at 1920px, down from 940px. Retained the layered portrait signature. Mobile Experience uses a down chevron which turns upward when open.

Reduced the website deck stage height and the spacing before project copy and metadata. The preview and complete active description fit within the tested portrait viewports when the deck is in view. Added a decorative, pointer-transparent Visit live site badge that follows the mouse inside the active linked screenshot. It uses one scheduled frame per pointer-update batch, no perpetual loop, preserves existing links, clamps to viewport edges and disappears on leave, scroll, keyboard use, project change, tab hiding and blur. Touch keeps the ordinary visible live-site action. Responsive image preload and renderer sizes match.

Evidence: focused renderer regression failed before the new data-driven cue label/short-copy change, then passed. Browser coverage at 1920 / 1440 / 1024 / 768 / 390 / 375 / 320px and 844x390 landscape confirmed loaded content/styles, fitting names, no horizontal overflow, active descriptions, cursor movement/cleanup, and Experience focus/Escape. Existing deck tests passed for arrows, Home/End, swipe and inactive-card focus exclusion; GitHub dot tests passed. Updated the local header browser fixture to the user-approved Merwin wordmark and current deck selectors; menu focus, Escape, anchor navigation and reduced-motion checks passed, including a 4x CPU-throttled phone run. A dev-only fixture toggle exercised long project copy, missing preview, zero/one items and doubled root text size at 320px and 1440px without overflow; no fixture UI ships. Desktop hero, phone hero and desktop work screenshots reviewed. Impeccable's scoped mechanical detector returned an empty finding list; final scoped polish retained the accepted layout, links, focus, dark palette and touch controls. Existing live-stats backend tests also passed. The legacy test-motion.mjs targets retired app.js/editorial-cut architecture and fails before exercising the active application; it is not a current release gate. Physical devices and cross-browser certification remain pending.

Local evidence files are under .taste-skill/checkpoint/compact-release-* and compact-edge-evidence.json. Local design-tool artifacts are ignored, not published. Final release steps: commit the source, content bundle, focused test and design records; push main; verify the deployed domain serves the new assets and interactions. Production API code and credential configuration are unchanged.

### Restored portrait hero and compact experience

The latest user reference supersedes the minimal hero below. Restored oversized two-line name typography, with the responsive cutout portrait layered between the solid name and surname outline. Desktop portrait widths are about 505px at a 1440px viewport and 562px at 1920px. Phones retain a large face above the name and stacked work/CV actions. Responsive WebP sources and the preload use matching sizes; visible introductory copy remains in JSON.

Replaced Experience cards with five compact year / role / organization disclosures using the existing real content. Fine-pointer hover and keyboard focus reveal the period, summary and existing links. Click/tap pins details; Escape closes them. Details enter with a finite transform/opacity stagger and accent-line sweep. Reduced motion and keyboard navigation suppress decorative movement. Native details/summary remains the fallback.

Verification: browser checks passed at 1920, 1440, 1024, 768, 390, 375 and 320px, plus 844x390 landscape. Asserted loaded styling/content, readable name width, loaded portrait, five roles, no horizontal overflow and no runtime exceptions. Hover, focus, Escape, click pinning and reduced motion passed. Actual emulated touch events opened/closed a row at 375px with 4x CPU throttling. Normal-motion child reveals reached full opacity. Desktop and phone screenshots reviewed; evidence: .taste-skill/checkpoint/portrait-experience-evidence.json and portrait-hero-*.jpg / experience-rows-*.jpg. Fresh reviewer found no consequential issue. The local preview server was hardened after an intermittent partial stylesheet/content load, then the full viewport run passed. Physical devices, production APIs and final whole-site release checks remain unverified. No push or deployment performed.

### Minimal hero and hover refinement

The user requested more hover feedback and explicitly rejected the busy hero. Replaced the hero's duplicate website/video preview with a compact typography-led introduction: name, role, one-sentence copy, work/CV links and a small portrait/location. The macOS website deck remains the main showcase and Selected Edits remains directly after it. Removed the retired hero switch/playback code, scene CSS and obsolete image preload. Visible copy remains in JSON.

Added fine-pointer-only button lifts, small link-arrow motion, deck-window lift, gentle image zoom and menu-link feedback. Replaced the existing stack-logo bounce/drop-shadow with a short transform response and removed its pointer-follow gradient display. Touch and reduced-motion paths suppress decorative movement; entrance effects remain finite with no added animation loop or library.

Evidence: changed hero renderer test first failed against old markup, then passed; build bundle, content validator and syntax checks passed. Browser checks at 1440 / 768 / 390 / 375px passed with hero heights 526 / 435 / 474 / 472px, no duplicate hero media, working work/CV destinations and menu, functional deck selection, no overflow or runtime exceptions. The 375px run used 4x simulated CPU slowdown. Real pointer hover checks verified button/deck lifts and image zoom; switching to reduced motion removed the zoom, and stack logos have no bounce or drop-shadow. Screenshots reviewed at desktop and narrow phone widths. Physical devices and full release performance remain unverified. Evidence: .taste-skill/checkpoint/minimal-hero-evidence.json and minimal-hero-*.jpg.

### Approved 3D project deck replacement

Reference refinement: made the deck narrower with a smaller front window and wider fanned side previews. Added macOS-style red/yellow/green decorative traffic lights, centered project title bars, rounded window frames and neutral floating shadows. Traffic lights are aria-hidden styling rather than nonfunctional buttons; arrows, swipe and keyboard remain the actual navigation. Four-viewport deck regression checks and content validation passed; desktop and narrow-phone screenshots reviewed.

The user rejected the list/index layout and explicitly selected a three-preview depth deck. Implemented a CSS perspective deck using the existing screenshots and vanilla JS. Eight live websites remain accessible through previous/next controls, ArrowLeft/ArrowRight, Home/End, and horizontal touch swipe. Only the active preview link and project information are interactive; background cards are inert and hidden from assistive technology. Vertical scrolling and pinch zoom remain allowed. The three non-live systems stay in the text-only archive. Removed the retired index styling and behavior.

The existing gallery markup becomes a simple linked collection if the deck enhancement fails. No autoplay, continuous render loop, WebGL, drag library or new dependency was introduced. Pointer transitions animate transform and opacity, with shorter phone timings and reduced-motion/keyboard movement disabled.

Evidence: renderer test observed failing for the old index before the replacement, then passed. Browser checks at 1440 / 768 / 390 / 375px passed: eight cards retained, three previews visible, one description, correct default project, cyclic arrow browsing, Home/End, actual horizontal touch swipe, inactive-card focus exclusion, reduced-motion behavior, no non-live screenshots, no horizontal overflow or runtime exceptions. Screenshots reviewed at desktop and phone widths; evidence is .taste-skill/checkpoint/project-deck-evidence.json and project-deck-*.jpg. Fresh reviewer found no consequential bugs in scope. Content validation and syntax checks passed. This is a local review build, with no deployment or physical-device certification.

User feedback: all non-live project screenshots must stay hidden. Applied while retaining project descriptions. The user approved replacing the long grid with a compact project browser; implemented on 2026-10-21.

### Compact website viewer follow-up

### Compact header and motion follow-up

### GitHub activity reference follow-up

User provided a monochrome circular-dot contribution graph reference. Applied the treatment to the existing saved snapshot: circle size and brightness encode its contribution levels, the @generosomm profile link stays visible, and one summary replaces the four-stat block. Removed the card border/gradient and green cell glows from this component. The complete saved year now renders, so the graph range matches the total; empty days are preserved. Exact date range is displayed rather than implying a fresh live count. No new chart library or data provider.

Browser regression first failed against the previous four-stat graph, then passed at 1440 / 768 / 390 / 375px: 366 dated cells, 405 contributions matching the saved snapshot, one summary, real profile handle, circular dots, functional day tooltip, no overflow or runtime exceptions. Desktop and narrow phone screenshots reviewed. Evidence: .taste-skill/checkpoint/github-dots-evidence.json and github-dots-*.jpg. Snapshot was reused, not refreshed; saved fetch date is 2026-10-19. Content validation and rendering checks passed.

### Header and motion verification

User requested a smaller header without the full-name wordmark and long navbar, plus more device-conscious animation. Implemented a 152px MG + Menu control and compact navigation panel across viewport widths. Existing menu focus containment, Escape and navigation behavior retained; outside press dismisses it. It no longer closes just because a mobile browser resizes its viewport.

Added short hero entrances, one-time project/edit reveals and project-switch feedback with native WAAPI. New motion animates transform and opacity only, cancels on tab hiding or reduced-motion changes, and suppresses switch movement for keyboard input. Touch/low-capability paths use shorter motion, no pointer hover tilt and no backdrop blur. Removed animated text blur from the existing About and Contact effects. No new perpetual animation loop or dependency.

Checks: header rendering test observed failing first, then passed. Browser checks at 1440 / 768 / 390 / 375px passed for header size, menu visibility/focus, Escape, anchor navigation, project selection, reduced-motion behavior and overflow with no runtime exceptions. Small-phone check used simulated 4x CPU slowdown. Instrumented touch animations confirmed eight calls, only transform/opacity, maximum 260ms. Screenshots reviewed at desktop and phone sizes. Fresh read-only review found no consequential issues. Evidence: .taste-skill/checkpoint/header-motion-evidence.json, compact-header-*.jpg and menu-*.jpg. This is emulated verification, not physical-device or cross-browser performance certification.

### Website viewer verification

- Eight linked websites use native, single-open details controls. ASINTA is the default; desktop uses a left index and right preview, mobile uses in-flow expandable rows.
- Three unlinked systems remain in a collapsed text-only archive with descriptions and stack tags. No repo screenshots or links were introduced.
- JavaScript only enhances exclusive opening for older browsers, desktop panel sizing and selected-row behavior. The native controls and links work without enhancement.
- Source copy and default selection live in data/07-work.json. Removed the unused hover-preview markup from the active renderer.
- Rendering test first failed against the old grid, then passed for one initially open item, all eight live entries and the text-only archive.
- Real Chrome at 1440 / 768 / 390 / 375px: click switching and Enter activation passed, only one project open, mobile collapse passed, all three archived systems retained, no archive images, no overlapping panels, no horizontal overflow, no runtime exceptions. Screenshots reviewed at desktop, tablet and narrow phone widths.
- Evidence: .taste-skill/checkpoint/project-browser-evidence.json and project-browser-*.jpg. Content validation, syntax checks and diff whitespace checks passed. Full-site release checks and physical-device testing remain outside this local checkpoint.

After visual approval, refine the featured-media scene with measured live 3D enhancement and restyle the supporting sections. Final whole-site Impeccable polish, accessibility, motion, performance and API verification remain release work.
