import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/* =============================================================
   Data bundle.
   Merges every data file the site renders (the CONTENT_FILES list
   in js/content.js) into one data/site.json. The live site loads
   that single file instead of 13 separate ones: on a host where
   every request can take a second to start, waiting for one file
   is far faster than waiting for the slowest of thirteen.

   You keep editing the individual data/*.json files. This runs
   automatically on every commit (.githooks/pre-commit), and
   scripts/validate-content.mjs fails if site.json is out of date.
   Run it by hand with:  node scripts/build-data.mjs
   ============================================================= */

const root = process.cwd();
const OUTPUT = path.join(root, "data", "site.json");

export async function buildBundle() {
  const source = await readFile(path.join(root, "js", "content.js"), "utf8");
  const block = source.match(/CONTENT_FILES\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/);
  if (!block) throw new Error("js/content.js: could not read the CONTENT_FILES map");
  const entries = [...block[1].matchAll(/(\w+):\s*"([\w.-]+\.json)"/g)].map((m) => [m[1], m[2]]);

  const files = {};
  const hash = createHash("sha256");
  for (const [key, filename] of entries) {
    const text = await readFile(path.join(root, "data", filename), "utf8");
    files[key] = JSON.parse(text);
    hash.update(`${filename}\n${text}\n`);
  }
  /* The hash of the sources lets the validator tell when the bundle
     no longer matches the files it was built from. */
  return { sources: hash.digest("hex").slice(0, 16), files };
}

/* Run directly (not imported by the validator): write the file. */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bundle = await buildBundle();
  await writeFile(OUTPUT, JSON.stringify(bundle));
  console.log(`Built data/site.json from ${Object.keys(bundle.files).length} files (sources ${bundle.sources}).`);
}
