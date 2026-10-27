# Portfolio check fixes, 2026-10-28

User approved fixing the findings in the 2026-10-27 local check. Scope: mobile navigation clearance, active regression scripts, current README, crawler discovery files and local GitHub snapshot synchronization. No redesign or production API changes.

- Fast-forwarded clean main from 420eef3 to 7541d3e, incorporating six automated contribution-snapshot commits. No local changes were discarded.
- Regression test first reproduced the touch-navbar issue. Removed the touch-only keep-visible override so the existing accumulated scroll logic applies on phones too: down past 24px hides it, upward past 16px reveals it. Open menu and navigation focus keep it visible. Safe-area and visualViewport offsets remain.
- Replaced tests for retired app.js/editorial-cut/data files with current renderer and motion tests. Added regression coverage for touch scroll, small upward increments, focused/open navigation, factual JSON-LD and sitemap destinations. Added npm build/validate/test entry points.
- Rewrote README around current mounts, file map, page order, social placement, editing and verification. Documented static-server API limits and email-draft behavior.
- Added robots.txt, a three-page public sitemap and factual WebSite/Person JSON-LD. Structured data lives in meta JSON plus matching static HTML; parity is tested. No invented credentials, dates or metrics. No admin/API URLs in the sitemap; robots exclusions are not authorization.

Validation: npm run build, npm run validate, npm test, node --check js/studio.js and git diff --check passed. Browser checks at 320x640, 390x844, 768x1024 and 1440x900 passed with no horizontal overflow or JavaScript exceptions. Actual hit-testing confirmed the active live-site link receives pointer hits at the formerly overlapping phone position. Slow upward scroll restored the pill; menu open/Escape, project selection and Experience focus/Escape passed. The 390px normal-motion run used 4x CPU throttling; other widths used reduced motion. robots.txt and sitemap.xml returned HTTP 200 locally. Mobile screenshot reviewed. Local artifacts: .taste-skill/checkpoint/fixes-2026-10-28-evidence.json and fixes-2026-10-28-mobile-*.jpg. Physical devices, production APIs, real network Core Web Vitals and deployed crawler behavior were not tested. No new readiness score is claimed. This update is local; no commit, push or deployment requested by the current fix instruction.


## Direct project-inquiry email

User created a Web3Forms form and supplied its explicitly public form access key. Chose JavaScript submission to match the vanilla site and preserve inline feedback. Configured the existing client API branch in contact JSON and rebuilt the bundle; updated the submit/success/failure copy and privacy notice. No account tokens or secret API keys are involved.

The handler now accepts success only when the API explicitly returns success=true, blocks a second submission while pending, and aborts after 15 seconds. Failed requests preserve the brief and re-enable retry; accepted requests reset it. Existing standalone email links remain available.

Verification: added test-contact-form.mjs to npm test. It covers accepted, rejected, malformed, offline, timeout, invalid and duplicate submissions. Full test suite, content validation and JavaScript syntax passed. Browser checks at 390px and 1440px used intercepted API responses to verify configured form, invalid-input blocking, disabled pending state, success reset, failure preservation, no external tabs and no overflow/runtime exceptions. No real email was sent. Provider acceptance, inbox delivery and account/domain restrictions remain unverified until a real submission. No push/deployment.

Release authorized by the user on 2026-10-28: commit and push the reviewed changes to main. Inquiry button and status messages are centered; browser checks at 390, 768 and 1440px measured less than 1px centering offset and no overflow. Final build, content validation, full npm test and diff whitespace checks passed before commit. Deployment and inbox verification are distinct: no test email has been sent.

Deployment follow-up: first Vercel build failed because npm build auto-detection tried to run the intentionally excluded scripts/build-data.mjs. Explicitly disabled automatic build detection in vercel.json, retaining the existing static prebuilt-bundle deployment model. Added a config regression assertion.
