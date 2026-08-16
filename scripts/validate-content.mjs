import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const contentFiles = [
  "00-meta.json",
  "01-nav.json",
  "02-hero.json",
  "04-work.json",
  "05-dev.json",
  "06-operations.json",
  "07-stats.json",
  "08-testimonials.json",
  "09-about.json",
  "10-credentials.json",
  "11-contact.json",
  "12-ui.json"
];

const errors = [];
const assetPaths = new Set();
let interfaceData = null;

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

for (const filename of contentFiles) {
  const relativePath = path.join("data", filename);
  try {
    const source = await readFile(path.join(root, relativePath), "utf8");
    const data = JSON.parse(source);
    if (filename === "12-ui.json") interfaceData = data;
    inspectValue(data);
  } catch (error) {
    errors.push(`${relativePath}: ${error.message}`);
  }
}

for (const label of ["showDropdown", "hideDropdown"]) {
  if (typeof interfaceData?.labels?.[label] !== "string" || !interfaceData.labels[label].trim()) {
    errors.push(`data/12-ui.json: labels.${label} is required by the shared dropdown control`);
  }
}

for (const assetPath of assetPaths) {
  try {
    await access(path.join(root, assetPath), constants.R_OK);
  } catch {
    errors.push(`${assetPath}: referenced by JSON but the file is missing`);
  }
}

try {
  const index = await readFile(path.join(root, "index.html"), "utf8");
  const requiredContainers = [
    "nav",
    "hero",
    "work-heading",
    "work",
    "dev",
    "operations",
    "stats",
    "testimonials",
    "about",
    "credentials",
    "contact",
    "footer"
  ];

  requiredContainers.forEach((name) => {
    if (!index.includes(`data-content="${name}"`)) {
      errors.push(`index.html: missing the data-content="${name}" container`);
    }
  });

  if (/<article[\s>]/i.test(index)) {
    errors.push("index.html: contains a content card; cards must be rendered from JSON");
  }

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

try {
  const renderer = await readFile(path.join(root, "js", "content.js"), "utf8");
  const literalTextNodes = [...renderer.matchAll(/>\s*([A-Za-z][^<${}\r\n`]*)</g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  if (literalTextNodes.length) {
    errors.push(`js/content.js: visible text must come from data JSON, found: ${literalTextNodes.join(", ")}`);
  }
} catch (error) {
  errors.push(`js/content.js: ${error.message}`);
}

if (errors.length) {
  console.error("Content validation failed:\n");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Content validation passed: ${contentFiles.length} JSON files and ${assetPaths.size} referenced assets checked.`);
}
