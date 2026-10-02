import http from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

/* =============================================================
   Scene assets.
   Builds everything js/scene/ needs from data/scene.json:
     1. frames: each `source` thumbnail -> a small desaturated WebP
        at `src`, cropped to the slab's 9:16 face.
     2. poster: the live scene's rest frame -> `poster.src`, the
        static fallback for mobile, low power and reduced motion.
   Run after changing frames, slab count, or the scene's look:
     node scripts/build-scene-assets.mjs
   ============================================================= */

const root = process.cwd();
const config = JSON.parse(await readFile(path.join(root, "data", "scene.json"), "utf8"));

const FRAME = { width: 180, height: 320, quality: 0.72 };

const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".pdf": "application/pdf"
};

const server = http
  .createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = path.join(root, pathname === "/" ? "index.html" : pathname);
    try {
      const body = await readFile(file);
      response.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  })
  .listen(0);
const origin = `http://localhost:${server.address().port}`;

/* SwiftShader gives headless Chromium a software WebGL context, so
   the poster renders the same on any machine. */
const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });

function decodeDataUrl(url) {
  return Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
}

try {
  /* ---- 1. Frames ------------------------------------------------ */

  const page = await browser.newPage();
  await page.goto(`${origin}/data/scene.json`);

  for (const frame of config.frames || []) {
    if (!frame?.source || !frame?.src) continue;
    const url = await page.evaluate(
      async ({ source, size }) => {
        const image = new Image();
        image.src = `/${source}`;
        await image.decode();

        const canvas = document.createElement("canvas");
        canvas.width = size.width;
        canvas.height = size.height;
        const context = canvas.getContext("2d");

        /* Centre crop to the face ratio, then strip the colour: the
           scene is monochrome, the accent belongs to the light. */
        const scale = Math.max(size.width / image.width, size.height / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.filter = "grayscale(1) contrast(0.92)";
        context.drawImage(image, (size.width - width) / 2, (size.height - height) / 2, width, height);
        return canvas.toDataURL("image/webp", size.quality);
      },
      { source: frame.source, size: FRAME }
    );

    const target = path.join(root, frame.src);
    await mkdir(path.dirname(target), { recursive: true });
    const bytes = decodeDataUrl(url);
    await writeFile(target, bytes);
    console.log(`frame  ${frame.src}  ${(bytes.length / 1024).toFixed(1)}KB`);
  }
  await page.close();

  /* ---- 2. Poster ------------------------------------------------ */

  const poster = config.poster || {};
  if (poster.src) {
    const scenePage = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    await scenePage.addInitScript(() => sessionStorage.setItem("mg-preloader-seen", "1"));
    await scenePage.goto(`${origin}/?scene=live&scene-debug`, { waitUntil: "networkidle" });
    await scenePage.waitForFunction(() => window.portfolioScene?.exportPoster, null, { timeout: 30000 });
    /* Let the frame textures arrive before the still is taken. */
    await scenePage.waitForTimeout(1500);

    const url = await scenePage.evaluate(() => window.portfolioScene.exportPoster("image/webp"));
    const target = path.join(root, poster.src);
    await mkdir(path.dirname(target), { recursive: true });
    const bytes = decodeDataUrl(url);
    await writeFile(target, bytes);
    console.log(`poster ${poster.src}  ${(bytes.length / 1024).toFixed(1)}KB`);
    await scenePage.close();
  }
} finally {
  await browser.close();
  server.close();
}
