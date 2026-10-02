/* =============================================================
   SCENE BOOT — decides whether the hero gets the live 3D clip
   stack, the static poster, or nothing, and wires it to the page.

   Imported lazily by js/site.js once the hero has painted. The
   whole js/scene/ folder is optional: delete it and the hero simply
   has no 3D layer. Settings live in data/scene.json.

   URL overrides for testing:
     ?scene=live | poster | off   force a mode
     ?scene-debug                 adds an "export poster" button
   ============================================================= */

const version = new URL(import.meta.url).search;
const root = document.documentElement;
const params = new URLSearchParams(window.location.search);
const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const MODES = new Set(["live", "poster", "off"]);

boot().catch(() => {
  /* Decorative layer: any failure leaves the finished hero alone. */
});

async function boot() {
  const lockup = document.querySelector(".hero-lockup");
  if (!lockup) return;

  const config = await loadConfig();
  if (!config) return;

  const override = params.get("scene");
  const mode = MODES.has(override) ? override : MODES.has(config.mode) ? config.mode : "live";
  if (mode === "off") return;

  await heroPainted();

  const host = document.createElement("div");
  host.className = "hero-scene";
  host.setAttribute("aria-hidden", "true");
  lockup.prepend(host);

  const forced = override === "live";
  const live = mode === "live" && hasWebGL() && (forced || (!reduceMotionQuery.matches && !prefersPoster()));

  if (!live) {
    showPoster(host, config);
    return;
  }

  let stack;
  try {
    const { createClipStack } = await import(`./clip-stack.js${version}`);
    stack = createClipStack(host, config, readTokens(), {
      onContextLost: () => fallBack()
    });
  } catch {
    showPoster(host, config);
    return;
  }

  host.classList.add("is-live");
  /* One frame on screen before the fade starts, so the canvas never
     fades in empty. */
  requestAnimationFrame(() => host.classList.add("is-visible"));

  const cleanups = [
    bindProgress(stack),
    bindPointer(stack),
    bindActivity(stack, host)
  ];

  function fallBack() {
    cleanups.forEach((cleanup) => cleanup?.());
    stack?.dispose();
    stack = null;
    host.classList.remove("is-live", "is-visible");
    showPoster(host, config);
  }

  /* Reduced motion switched on mid-visit: swap to the still image. */
  reduceMotionQuery.addEventListener?.("change", (event) => {
    if (event.matches && stack && !forced) fallBack();
  });

  if (params.has("scene-debug")) addDebugTools(stack, config);
}

/* ---- Config ---------------------------------------------------- */

async function loadConfig() {
  try {
    const response = await fetch("data/scene.json");
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/* ---- Timing -----------------------------------------------------
   The hero must look finished before any 3D arrives: wait for the
   render screen to clear, the portrait to decode, and then for the
   main thread to go idle.
------------------------------------------------------------------ */

async function heroPainted() {
  const ready = window.portfolio?.ready;
  if (ready?.then) await ready;

  const portrait = document.querySelector(".hero-portrait img");
  if (portrait && !portrait.complete) {
    await portrait.decode().catch(() => {});
  }

  await new Promise((resolve) => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(resolve, { timeout: 1500 });
    } else {
      window.setTimeout(resolve, 600);
    }
  });
}

/* ---- Capability -------------------------------------------------- */

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!context) return false;
    /* Hand the probe context straight back; browsers cap how many
       can be alive at once. */
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/* Phones, tablets and low-power machines get the poster. A simple,
   honest heuristic: no precise pointer, a narrow screen, data saver,
   or a device that reports very little memory or very few cores. */
function prefersPoster() {
  if (navigator.connection?.saveData) return true;
  if (window.matchMedia("(hover: none), (pointer: coarse), (max-width: 767px)").matches) return true;
  if ((navigator.deviceMemory || 8) < 4) return true;
  if ((navigator.hardwareConcurrency || 8) < 4) return true;
  return false;
}

/* ---- Tokens: CSS custom properties -> scene colours -------------- */

function readTokens() {
  const styles = getComputedStyle(root);
  const read = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
  return {
    ink: read("--ink-900", "#0a0a0a"),
    graphite: read("--scene-graphite", "#1d1d1c"),
    face: read("--scene-face", "#2a2a28"),
    bone: read("--scene-bone", "#e8e6e0"),
    accent: read("--accent", "#2bd47d")
  };
}

/* ---- Poster fallback --------------------------------------------- */

function showPoster(host, config) {
  const poster = config.poster || {};
  if (!poster.src) return;

  const image = new Image();
  image.className = "hero-scene-poster";
  image.alt = "";
  image.decoding = "async";
  if (poster.width) image.width = poster.width;
  if (poster.height) image.height = poster.height;
  image.addEventListener("load", () => host.classList.add("is-visible"), { once: true });
  image.addEventListener("error", () => image.remove(), { once: true });
  image.src = poster.src;
  host.appendChild(image);
}

/* ---- Scroll: the playhead travels with the hero ------------------
   ScrollTrigger when the motion layer is up, so the deck and the
   type share one clock; the site's own scroll bus otherwise.
------------------------------------------------------------------ */

function bindProgress(stack) {
  const hero = document.querySelector(".section-hero");
  if (!hero) return null;

  const ScrollTrigger = window.ScrollTrigger;
  if (ScrollTrigger && root.classList.contains("motion-ready")) {
    const trigger = ScrollTrigger.create({
      trigger: hero,
      start: "top top",
      end: "bottom top",
      onUpdate: (self) => stack.setProgress(self.progress)
    });
    stack.setProgress(trigger.progress);
    return () => trigger.kill();
  }

  const measure = () => {
    const rect = hero.getBoundingClientRect();
    stack.setProgress(rect.height ? -rect.top / rect.height : 0);
  };
  measure();
  return window.portfolio?.onScroll?.(measure) || null;
}

/* ---- Cursor tilt (precise pointers only) ------------------------- */

function bindPointer(stack) {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return null;

  const onMove = (event) => {
    stack.setPointer(
      (event.clientX / window.innerWidth) * 2 - 1,
      (event.clientY / window.innerHeight) * 2 - 1
    );
  };
  window.addEventListener("pointermove", onMove, { passive: true });
  return () => window.removeEventListener("pointermove", onMove);
}

/* ---- Render loop only while visible ------------------------------ */

function bindActivity(stack, host) {
  let onScreen = false;

  const sync = () => {
    if (onScreen && !document.hidden) stack.start();
    else stack.stop();
  };

  const observer = new IntersectionObserver((entries) => {
    onScreen = entries.some((entry) => entry.isIntersecting);
    sync();
  });
  observer.observe(host);
  document.addEventListener("visibilitychange", sync);

  return () => {
    observer.disconnect();
    document.removeEventListener("visibilitychange", sync);
  };
}

/* ---- Debug: one-click poster export ------------------------------
   Visit /?scene-debug, click the button, and two files download:
   the WebP the site serves and a PNG master. Or run
   node scripts/build-scene-assets.mjs to write it straight into
   assets/images/scene/.
------------------------------------------------------------------ */

function addDebugTools(stack, config) {
  const poster = config.poster || {};
  const size = { width: poster.width || 1600, height: poster.height || 800 };
  const name = (poster.src || "clip-stack-poster.webp").split("/").pop().replace(/\.\w+$/, "");

  const exportPoster = (type = "image/webp") => stack.exportPoster({ ...size, type });
  window.portfolioScene = { exportPoster };

  const label = config.debug?.exportLabel;
  if (!label) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "scene-debug-button";
  button.textContent = label;
  button.addEventListener("click", () => {
    download(exportPoster("image/webp"), `${name}.webp`);
    download(exportPoster("image/png"), `${name}.png`);
  });
  document.body.appendChild(button);
}

function download(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}
