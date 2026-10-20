# Portfolio creative redesign

Date: 2026-10-21 (Asia/Manila)
Status: user authorized implementation on 2026-10-21, with website projects as the primary showcase. First visual checkpoint in progress.

## Brief

The user wants a premium, unique, creative and minimalist portfolio with 3D and minimal liquid glass. Avoid overdoing the effects. Both web development and ERO | VISUALS must be understandable. Existing content, facts and links remain the source of truth.

## Proposed concept: The living frame

Merwin's shipped websites and ERO | VISUALS edits become the changing contents of one sculptural frame. The frame connects making interfaces and editing moving images. It should show recognizable work rather than become an abstract screensaver.

One live interaction: a Web / Video switch changes the featured media and its project caption. It works by touch and keyboard. Without enhancement, show a real project image and working links to both work sections.

The art-direction draw selected The pinned poster, seed 156475902, retaining the existing brand palette and typography. Use its persistent frame and changing imagery. Adapt incompatible template suggestions: real project media replaces architectural stock photos; proof uses genuine analytics and credentials, never invented partner names; contact needs no unrelated background photograph. The hero's opening window is the frame itself. Keep headings outside the media so text stays readable.

## Visual decisions proposed by the builder

- Canvas: near black #0A0A0A, graphite surfaces #141414, warm white #F2F2F0. Existing green #2BD47D highlights the primary action and one active state.
- Typography: retain locally hosted Clash Display and Satoshi. Remove decorative monospace and excessive uppercase labels from the redesigned components. Five primary size roles; body text at least 16px.
- Hero, revised after the latest compactness feedback: retain the two-line Merwin Generoso name with the cutout portrait between solid and outlined type, within a narrower 1080px desktop composition. Phones place the face above the readable name. Use a single short line of introductory copy and retain work/CV links. The macOS-style project deck below carries the website showcase.
- 3D: one graphite frame with a restrained bevel, soft white studio lighting, and a small green edge detail. No particles, additional floating objects or continuous spinning. Use the existing Three.js module where practical; do not add another rendering engine.
- Glass: at most two surfaces visible together: the compact navigation surface and the Web / Video selector. A light translucent tint, modest blur and subtle edge highlight. No glass paragraphs, project grids or full-screen panels. Opaque fallback when blur is unsupported, contrast is poor or enhanced transparency is disabled.
- The user's glass request is an intentional exception to Taste's no-glass house rule. It does not justify gradients, glow or translucent content everywhere.
- Layout: consistent outer margins, generous but purposeful space, short descriptions and large real imagery. Avoid long blank pinned stretches.

## Page argument and content

1. Introduction: who Merwin is and what he makes, proven immediately by a real website screenshot or edit preview in the frame.
2. Selected work: a three-preview 3D depth deck with one active website. Arrows, keyboard and swipe change the active screenshot; title, concise contribution, status and live link sit below. Use the existing project JSON, including truthful distinctions between proposals and shipped projects. Systems without a live link stay in a text-only archive without repository screenshots. The user selected this replacement after reviewing the initial grid and compact index.
3. Selected edits: actual ERO | VISUALS footage with poster images, accessible playback controls, captions and existing source links. Never play sound automatically. Only the active preview may play; offscreen video pauses.
4. About and experience: concise introduction, actual roles and stack. Experience uses compact year / role / organization rows. Hover or keyboard focus reveals the existing details with a short stagger and accent sweep; click or tap pins the disclosure, and Escape closes it. Native details controls preserve access without enhancement.
5. Proof: preserve the distinction between documented snapshots and live social totals. Keep redacted certifications and analytics accessible.
6. Contact: clear project inquiry action, email, CV and existing social destinations. Preserve the project brief, mobile email behavior and visitor notes in a secondary position.

All existing public sections and anchor destinations remain accessible or receive a deliberate compatible destination. No silent removal of functionality, projects or facts. Exact copy and featured project ordering are builder decisions using existing JSON, subject to review at each phase.

## Motion and mobile

- Brief frame entrance and subtle pointer response on capable desktop devices. Do not delay reading behind a loading screen.
- At most one short pinned showcase, no more than two desktop viewport heights. Normal scroll everywhere else.
- Mobile receives its own frame proportions and stacked layout. Keep the visual concept visible through a properly cropped static 3D render; optional live rendering is a later measured decision.
- Reduced motion, low-power devices, unavailable WebGL and context loss use a finished poster with ordinary HTML controls. No hidden content waiting for animation.
- One WebGL canvas, lazy initialization after essential content paints, capped pixel ratio, paused rendering when offscreen or hidden. Preserve existing fallback infrastructure where suitable.

## Implementation phases and review

1. Hero checkpoint: tokens, navigation, hero composition, static frame and working Web / Video switch. Show desktop, tablet and phone previews for review before continuing.
2. Media checkpoint: live 3D enhancement, featured web projects and edits, with lazy playback and fallback verification.
3. Supporting sections: about, experience, services, proof, stack, notes and contact, preserving interactions and anchor compatibility.
4. Final verification and Impeccable polish: responsive layout, keyboard flow, reduced motion, media failure, navigation, forms and actual content checks.

Keep HTML/CSS/vanilla JS and JSON content architecture. Do not migrate frameworks or add dependencies without a concrete reason. Rebuild data/site.json when source content changes, then run the content validator and appropriate existing checks. Test at 1440, 768 and 390px, plus 375px for the narrow-phone pass. Browser emulation is not physical-device verification. Exercise dialogs, playback, menus, contact and optional APIs; a local static server cannot verify Vercel functions. Measure performance rather than promise a Lighthouse score. Run the Taste inspector, review its screenshots and document the intentional glass exception.

## Authorization boundary

This document proposes a new direction that will supersede the older timeline/clip-stack visual plan only after user approval. The older plan's audit-first and per-phase review checkpoints remain in effect. No deployment, push or public content publication is authorized by this proposal.

## Audit evidence

- The working tree was clean before audit artifacts were generated.
- Active page: index.html; rendering and behavior in js/content.js, js/site.js, js/interactions.js and related modules. Content bundle generated by scripts/build-data.mjs.
- Existing real assets include portrait variants, website screenshots, video footage, edit thumbnails, redacted proof images and local fonts.
- Existing 3D boot and clip-stack modules already support posters and capability checks. data/scene.json currently sets mode to off.
- Baseline screenshots and measured output: .taste-skill/before/. Inspector reported 16 Taste rule failures and 6 warnings. These include aesthetic house-rule differences and heuristic findings, not 16 independently confirmed functional defects.
- Visually reviewed desktop hero and mobile first contact sheet: portrait and name dominate; the mobile project list is primarily text; real work appears later in the page. Full manual visual review is still pending.
