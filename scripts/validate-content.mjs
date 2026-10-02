import { readFile, access, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import process from "node:process";

/* =============================================================
   Content validation.
   Guarantees the one architectural promise of this site: every
   visible string lives in data/*.json, never in markup or code.
   The wired data files are read out of js/content.js so this stays
   correct as sections are added.
   ============================================================= */

const root = process.cwd();
const errors = [];
const assetPaths = new Set();

function inspectValue(value) {
  if (typeof value === "string" && value.startsWith("assets/")) {
    assetPaths.add(value);
  }
  if (Array.isArray(value)) {
    value.forEach(inspectValue);
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach(inspectValue);
  }
}

/* ---- Which data files are actually wired up ------------------ */

const contentSource = await readFile(path.join(root, "js", "content.js"), "utf8");
const contentFilesBlock = contentSource.match(/CONTENT_FILES\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/);
const wiredFiles = [...(contentFilesBlock?.[1] || "").matchAll(/"([\w.-]+\.json)"/g)].map(
  (match) => match[1]
);

if (!wiredFiles.length) {
  errors.push("js/content.js: could not read the CONTENT_FILES map");
}

/* ---- Every data file must parse; wired ones must exist ------- */

const dataDir = path.join(root, "data");
const dataFiles = (await readdir(dataDir)).filter((name) => name.endsWith(".json"));
const parsed = new Map();

for (const filename of dataFiles) {
  const relativePath = path.posix.join("data", filename);
  try {
    const source = await readFile(path.join(dataDir, filename), "utf8");
    const data = JSON.parse(source);
    parsed.set(filename, data);
    /* scene.json is read by js/scene/boot.js, not content.js, but its
       textures and poster must exist all the same. */
    if (wiredFiles.includes(filename) || filename === "scene.json") inspectValue(data);
  } catch (error) {
    errors.push(`${relativePath}: ${error.message}`);
  }
}

for (const filename of wiredFiles) {
  if (!parsed.has(filename)) {
    errors.push(`data/${filename}: wired in js/content.js but the file is missing`);
  }
}

/* ---- Referenced assets must exist --------------------------- */

for (const assetPath of assetPaths) {
  try {
    await access(path.join(root, assetPath), constants.R_OK);
  } catch {
    errors.push(`${assetPath}: referenced by JSON but the file is missing`);
  }
}

/* ---- index.html: mount points present, zero literal copy ---- */

const chromeContainers = ["preloader", "top", "socials", "menu"];

try {
  const index = await readFile(path.join(root, "index.html"), "utf8");

  chromeContainers.forEach((name) => {
    if (!index.includes(`data-chrome="${name}"`)) {
      errors.push(`index.html: missing the data-chrome="${name}" container`);
    }
  });

  const sections = parsed.get("01-chrome.json")?.sections || [];
  sections.forEach((section) => {
    if (!section?.id) return;
    if (!index.includes(`data-section="${section.id}"`)) {
      errors.push(`index.html: missing the data-section="${section.id}" container`);
    }
  });

  /* Every wired data file is preloaded in <head>, so it downloads in
     parallel with the CSS and JS instead of after content.js runs. */
  wiredFiles.forEach((filename) => {
    const tag = `<link rel="preload" href="data/${filename}" as="fetch" crossorigin>`;
    if (!index.includes(tag)) errors.push(`index.html: missing ${tag}`);
  });

  const body = index.match(/<body[\s\S]*<\/body>/i)?.[0] || "";
  const bodyText = [...body.matchAll(/>([^<]+)</g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  if (bodyText.length) {
    errors.push(`index.html: visible text must come from data JSON, found: ${bodyText.join(", ")}`);
  }
} catch (error) {
  errors.push(`index.html: ${error.message}`);
}

/* ---- js/*.js: zero literal copy ----------------------------- */

const jsDir = path.join(root, "js");
const jsFiles = (await readdir(jsDir, { recursive: true }))
  .filter((name) => name.endsWith(".js"))
  .map((name) => name.split(path.sep).join("/"));

for (const filename of jsFiles) {
  try {
    const source = await readFile(path.join(jsDir, filename), "utf8");
    const literalTextNodes = [...source.matchAll(/>\s*([A-Za-z][^<${}\r\n`]*)</g)]
      .map((match) => match[1].trim())
      .filter(Boolean);
    if (literalTextNodes.length) {
      errors.push(
        `js/${filename}: visible text must come from data JSON, found: ${literalTextNodes.join(", ")}`
      );
    }
  } catch (error) {
    errors.push(`js/${filename}: ${error.message}`);
  }
}

if (errors.length) {
  console.error("Content validation failed:\n");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(
    `Content validation passed: ${wiredFiles.length} wired data files, ` +
      `${dataFiles.length} JSON files parsed, ${assetPaths.size} referenced assets checked.`
  );
}
