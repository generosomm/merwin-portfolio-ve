import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const contentFiles = [
  "00-meta.json",
  "01-nav.json",
  "02-hero.json",
  "03-services.json",
  "04-work.json",
  "05-dev.json",
  "06-operations.json",
  "07-stats.json",
  "08-testimonials.json",
  "09-about.json",
  "10-credentials.json",
  "11-contact.json"
];

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

for (const filename of contentFiles) {
  const relativePath = path.join("data", filename);
  try {
    const source = await readFile(path.join(root, relativePath), "utf8");
    const data = JSON.parse(source);
    inspectValue(data);
  } catch (error) {
    errors.push(`${relativePath}: ${error.message}`);
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
    "services",
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
} catch (error) {
  errors.push(`index.html: ${error.message}`);
}

if (errors.length) {
  console.error("Content validation failed:\n");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Content validation passed: ${contentFiles.length} JSON files and ${assetPaths.size} referenced assets checked.`);
}
