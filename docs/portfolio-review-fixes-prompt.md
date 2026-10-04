# PROMPT: generosomm.dev Review Fixes (Job Title + Certificate Privacy)

Paste everything below into Claude in VS Code, with your portfolio repo open as the workspace.

---

## CONTEXT

A data engineer reviewed my portfolio (generosomm.dev) and gave me two fixes. My site is plain HTML/CSS/JS with content in `/data/*.json`, deployed from this repo.

## FIX 1: Remove "Founder" wording for ERO | VISUALS

ERO | VISUALS is my personal content brand. It is **not a DTI-registered business**, so I must not present it as a registered company or myself as its founder/owner.

Do this:

1. Search the WHOLE repo (HTML, JSON, JS, meta tags, Open Graph/Twitter tags, `alt` text, JSON-LD structured data, CV/resume files if any, README) for: `Founder`, `Co-founder`, `CEO`, `Owner`, `Director`, `Company`, `Agency`, `Studio`, `Inc`, `Business`, `Clients` (in the context of ERO | VISUALS).
2. Show me every match with file + line before changing anything.
3. Replace the role with: **Creator & Video Editor**, and describe ERO | VISUALS as **"my personal short-form content brand"**.
4. Keep everything else true: dates (2022 to present), 70M+ documented views, real work. Don't downgrade real achievements, just the title and the business framing.
5. If JSON-LD has `"@type": "Organization"` for ERO | VISUALS, remove it or change it so it's not presented as a company.
6. Tell me if my GitHub README, LinkedIn text, or CV in the repo still says Founder, so I can update those outside the site too.

## FIX 2: Blur signatures on the 3 certificate images

Certificates: ITS Network Security, ITS Databases, Salesforce Agentblazer Champion.

**Important:** the blur must be baked into the image files. A CSS `filter: blur()` is NOT enough, because the original sharp image can still be downloaded from DevTools or the image URL.

Do this:

1. Find all certificate images in the repo (thumbnails, lightbox/full-size versions, and any WebP/AVIF/PNG/JPG variants or `srcset` sizes).
2. For each one, create a redacted version with a script (Python + Pillow, or `sharp` in Node, ask me before installing):
   - Blur (strong Gaussian blur or pixelate) the **signature areas**.
   - Also redact these if present: certificate ID / credential number, verification QR code or verification URL, and any exam/candidate ID. Ask me first if you're unsure whether I want a verification ID kept visible.
   - Since every certificate layout is different, do NOT guess coordinates blindly. Output a preview of each image with the proposed blur boxes drawn on it, show me, and let me adjust the coordinates (store them in a small `scripts/redact-config.json`).
3. Strip metadata (EXIF) from the output files.
4. **Replace** the originals in the site with the redacted versions (same file names or update all references). Regenerate every size/format variant from the redacted image, not from the original.
5. Move the unredacted originals OUT of the repo (tell me to keep them in a private folder). Add them to `.gitignore`.
6. **Git history:** the original sharp images are still in my public repo history. Explain the options (e.g. `git filter-repo` to purge them, then force-push), the risks, and wait for my OK before rewriting history. Also remind me that GitHub Pages / Vercel caches and old deployments may still serve the old files for a while.
7. In the lightbox, optionally add a small caption: "Signature and IDs redacted for privacy."

## RULES

- Don't change design, layout, or any other content.
- Show me the list of matches (Fix 1) and the blur previews (Fix 2) before applying changes.
- After both fixes, give me a short checklist of what changed and how to verify it on the live site (including right-click > open image in new tab to confirm the file itself is blurred).
