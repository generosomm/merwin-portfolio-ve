import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/* =============================================================
   GitHub contribution snapshot.
   Saves the last year of public contribution levels for the user in
   data/10-stack.json (github.username) to the file named by
   github.snapshot, which the Stack section draws its graph from.
   The public API behind this is slow (often 20-30s), which is why
   the site reads a saved copy instead of calling it per visit.
   Refresh whenever you like:
     node scripts/update-github-snapshot.mjs
   ============================================================= */

const root = process.cwd();
const stack = JSON.parse(await readFile(path.join(root, "data", "10-stack.json"), "utf8"));
const user = stack.github?.username;
const target = stack.github?.snapshot;
if (!user || !target) {
  console.error("data/10-stack.json needs github.username and github.snapshot");
  process.exit(1);
}

const url = `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(user)}?y=last`;
let data = null;

for (let attempt = 1; attempt <= 4 && !data; attempt += 1) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
  } catch (error) {
    console.log(`attempt ${attempt} failed: ${error.message}`);
  }
}

const days = Array.isArray(data?.contributions) ? data.contributions : [];
if (!days.length) {
  console.error("No contribution data received; the existing snapshot was left untouched.");
  process.exit(1);
}

/* One digit (0-4) per day keeps the file to a few hundred bytes. */
const snapshot = {
  user,
  fetchedAt: new Date().toISOString().slice(0, 10),
  total: data.total?.lastYear ?? days.reduce((sum, day) => sum + (Number(day.count) || 0), 0),
  start: days[0].date,
  levels: days.map((day) => Math.min(Math.max(Number(day.level) || 0, 0), 4)).join("")
};

await writeFile(path.join(root, target), JSON.stringify(snapshot, null, 2) + "\n");
console.log(`Saved ${days.length} days (${snapshot.total} contributions) to ${target}`);
