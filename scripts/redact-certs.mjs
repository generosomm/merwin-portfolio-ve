/* Exports certificate web versions, optionally baking configured
   masks into the pixels. Empty boxes preserve signatures and IDs.

   node scripts/redact-certs.mjs --preview [dir]
     Draws the boxes from scripts/redact-config.json on each source
     (…-boxes.png) and shows the redacted result (…-redacted.png).
     Nothing in the repo changes. Default dir: <tmp>/cert-redact-preview.
   node scripts/redact-certs.mjs --apply
     Writes <outDir>/<id>.webp (card) and, for sources wider than
     thumbWidth, <id>-full.webp (lightbox), both made from the
     redacted image, with no metadata.

   Needs ffmpeg on PATH (built with libwebp). The redaction shrinks
   each box to a few pixels and blurs it back up, so the original
   strokes and characters are gone from the file, not just hidden. */

import { execFileSync } from "node:child_process";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const config = JSON.parse(await readFile(path.join(root, "scripts", "redact-config.json"), "utf8"));
const sourceDir = path.resolve(root, process.env.CERT_SOURCE_DIR || config.sourceDir);
const mode = process.argv[2];

if (mode !== "--preview" && mode !== "--apply") {
  console.error("Usage: node scripts/redact-certs.mjs --preview [dir] | --apply");
  process.exit(1);
}

function ffmpeg(args) {
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
}

function size(file) {
  const out = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height", "-of", "csv=p=0", file], { encoding: "utf8" });
  const [width, height] = out.trim().split(",").map(Number);
  return { width, height };
}

/* Filter graph: for every box, crop it out, crush it to ~1/10 size,
   scale it back and blur, then lay it over the same spot. */
function redactGraph(boxes) {
  if (!boxes.length) return "[0:v]null[out]";
  const parts = [`[0:v]split=${boxes.length + 1}[base]${boxes.map((_, i) => `[c${i}]`).join("")}`];
  boxes.forEach((b, i) => {
    const sw = Math.max(2, Math.round(b.w / 10));
    const sh = Math.max(2, Math.round(b.h / 10));
    const sigma = Math.max(4, Math.round(b.h / 5));
    parts.push(`[c${i}]crop=${b.w}:${b.h}:${b.x}:${b.y},scale=${sw}:${sh}:flags=area,` +
      `scale=${b.w}:${b.h}:flags=bilinear,gblur=sigma=${sigma}[b${i}]`);
  });
  let prev = "base";
  boxes.forEach((b, i) => {
    const next = i === boxes.length - 1 ? "out" : `o${i}`;
    parts.push(`[${prev}][b${i}]overlay=${b.x}:${b.y}[${next}]`);
    prev = next;
  });
  return parts.join(";");
}

function checkBoxes(cert, dims) {
  for (const b of cert.boxes) {
    if (b.x < 0 || b.y < 0 || b.x + b.w > dims.width || b.y + b.h > dims.height) {
      throw new Error(`${cert.id}: box "${b.label}" falls outside the ${dims.width}x${dims.height} image`);
    }
  }
}

const previewDir = mode === "--preview"
  ? path.resolve(process.argv[3] || path.join(os.tmpdir(), "cert-redact-preview"))
  : null;
await mkdir(previewDir || path.resolve(root, config.outDir), { recursive: true });

for (const cert of config.certificates) {
  const src = path.join(sourceDir, cert.source);
  if (!existsSync(src)) throw new Error(`Missing source: ${src}`);
  const dims = size(src);
  checkBoxes(cert, dims);
  const graph = redactGraph(cert.boxes);

  if (previewDir) {
    const draw = cert.boxes.map((b) =>
      `drawbox=x=${b.x}:y=${b.y}:w=${b.w}:h=${b.h}:color=${b.label === "signature" ? "red" : "orange"}:t=3`).join(",") || "null";
    ffmpeg(["-i", src, "-vf", draw, "-frames:v", "1", path.join(previewDir, `${cert.id}-boxes.png`)]);
    ffmpeg(["-i", src, "-filter_complex", graph, "-map", "[out]", "-frames:v", "1",
      path.join(previewDir, `${cert.id}-redacted.png`)]);
    console.log(`${cert.id}: ${dims.width}x${dims.height}, ${cert.boxes.length} box(es)`);
    continue;
  }

  /* Both sizes come from the redacted frame, never from the source.
     A source no wider than thumbWidth gets one file, used for both. */
  const thumbWidth = Math.min(config.thumbWidth, dims.width);
  const fullWidth = Math.min(config.fullWidth, dims.width);
  const outputs = fullWidth > thumbWidth
    ? [
        { file: `${cert.id}.webp`, width: thumbWidth, quality: 82 },
        { file: `${cert.id}-full.webp`, width: fullWidth, quality: 88 }
      ]
    : [{ file: `${cert.id}.webp`, width: thumbWidth, quality: 88 }];
  for (const out of outputs) {
    const dest = path.resolve(root, config.outDir, out.file);
    ffmpeg(["-i", src, "-filter_complex", `${graph};[out]scale=${out.width}:-2:flags=lanczos[sized]`,
      "-map", "[sized]", "-map_metadata", "-1", "-frames:v", "1",
      "-c:v", "libwebp", "-quality", String(out.quality), dest]);
    const d = size(dest);
    console.log(`${path.relative(root, dest)}  ${d.width}x${d.height}`);
  }
}

if (previewDir) console.log(`Previews in ${previewDir}`);
