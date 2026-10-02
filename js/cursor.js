"use strict";

/* =============================================================
   CURSOR — an iPadOS-style pointer for mouse and trackpad users.
   - a soft translucent dot that glides after the real pointer
   - over a small control (link, button, tab) it morphs into a
     rounded highlight around it, and the control leans a little
     toward the pointer
   - over text it becomes a thin text bar, sized to the line
   - over large targets (cards, rows) it stays a dot, just bigger
   Pointer devices only: touch screens never see it. Under reduced
   motion it snaps instead of gliding and nothing leans.

   Performance: working out what is under the pointer (a hit test
   plus style reads) is the expensive part, so it happens only when
   the pointer moves, and at most every ~90ms while the page scrolls
   under a still pointer. The animation loop itself only eases
   numbers and writes styles that changed: plain movement is a
   transform (composited, no layout); width, height and radius are
   written only while the shape is actually morphing.
   ============================================================= */

(function initCursor() {
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!finePointer.matches) return;

  const root = document.documentElement;
  const CONTROLS = 'a, button, [role="tab"], summary, label';
  const TEXT = "p, h1, h2, h3, h4, li, dt, dd, blockquote, .about-word, .hero-intro";
  /* Above this size a "control" is really a card or a row: the dot
     grows instead of wrapping it, as on iPad. */
  const MAX_WRAP = { width: 320, height: 120 };
  const PAD = 6;
  const DOT = 20;
  const SCROLL_AIM_MS = 90;

  const cursor = document.createElement("div");
  cursor.className = "ios-cursor";
  cursor.setAttribute("aria-hidden", "true");
  document.body.appendChild(cursor);
  root.classList.add("has-ios-cursor");

  /* Where the pointer is, and what the cursor shape should become. */
  const pointer = { x: -100, y: -100 };
  const goal = { x: -100, y: -100, w: DOT, h: DOT, r: DOT / 2 };
  const shown = { ...goal };
  const written = { w: -1, h: -1, r: -1, transform: "", mode: "" };
  let target = null;
  let mode = "dot";
  let frame = 0;
  let pressed = false;
  let aimQueued = false;
  let lastScrollAim = 0;
  let scrollTimer = 0;
  let lean = { x: 0, y: 0 };

  /* Style reads are cached per element: radius and font size do not
     change while the page is open. */
  const radiusOf = new WeakMap();
  const fontSizeOf = new WeakMap();
  const cached = (map, element, read) => {
    if (!map.has(element)) map.set(element, read());
    return map.get(element);
  };

  function setLean(x, y) {
    if (!target || (Math.abs(x - lean.x) < 0.25 && Math.abs(y - lean.y) < 0.25)) return;
    lean = { x, y };
    target.style.setProperty("--lean-x", `${x.toFixed(2)}px`);
    target.style.setProperty("--lean-y", `${y.toFixed(2)}px`);
  }

  function release() {
    if (!target) return;
    target.classList.remove("is-cursor-target");
    target.style.removeProperty("--lean-x");
    target.style.removeProperty("--lean-y");
    target = null;
    lean = { x: 0, y: 0 };
  }

  /* The expensive part: hit test and measure. */
  function aim() {
    aimQueued = false;
    const element = document.elementFromPoint(pointer.x, pointer.y);
    const control = element?.closest(CONTROLS);
    const box = control?.getBoundingClientRect();

    /* A link stretched over a whole row (Selected Work) is hit through
       its overlay, outside its own box: treat it as the large row it
       really is, not as the title text it is attached to. */
    const inside = box &&
      pointer.x >= box.left && pointer.x <= box.right &&
      pointer.y >= box.top && pointer.y <= box.bottom;

    if (control && inside && box.width <= MAX_WRAP.width && box.height <= MAX_WRAP.height) {
      /* Small control: wrap it, and let it lean toward the pointer. */
      if (control !== target) {
        release();
        target = control;
        target.classList.add("is-cursor-target");
      }
      mode = "wrap";
      /* The measured box already includes the current lean. */
      const left = box.left - lean.x;
      const top = box.top - lean.y;
      const leanX = reduceMotion.matches ? 0 : ((pointer.x - (left + box.width / 2)) / box.width) * 6;
      const leanY = reduceMotion.matches ? 0 : ((pointer.y - (top + box.height / 2)) / box.height) * 4;
      setLean(leanX, leanY);
      const radius = cached(radiusOf, control, () => parseFloat(getComputedStyle(control).borderTopLeftRadius) || 0);
      goal.w = box.width + PAD * 2;
      goal.h = box.height + PAD * 2;
      goal.x = left - PAD + leanX;
      goal.y = top - PAD + leanY;
      goal.r = Math.min(Math.max(radius + PAD, 10), goal.h / 2);
    } else {
      release();
      const textual = !control && element?.closest(TEXT);
      if (textual) {
        /* Text: a thin bar as tall as the line under the pointer. */
        mode = "text";
        const size = cached(fontSizeOf, element, () => parseFloat(getComputedStyle(element).fontSize) || 16);
        goal.w = 2.5;
        goal.h = Math.min(Math.max(size * 1.15, 14), 72);
        goal.r = 1.25;
      } else {
        /* A large target (card, row) or empty space: the dot. */
        mode = control ? "large" : "dot";
        goal.w = goal.h = control ? DOT * 1.8 : DOT;
        goal.r = goal.w / 2;
      }
      goal.x = pointer.x - goal.w / 2;
      goal.y = pointer.y - goal.h / 2;
    }
    wake();
  }

  /* Cheap update between hit tests: outside a wrapped control the
     shape just follows the pointer, without re-measuring anything. */
  function follow() {
    if (mode === "wrap") return;
    goal.x = pointer.x - goal.w / 2;
    goal.y = pointer.y - goal.h / 2;
  }

  function queueAim() {
    if (aimQueued) return;
    aimQueued = true;
    requestAnimationFrame(aim);
  }

  function render() {
    frame = 0;
    const ease = reduceMotion.matches ? 1 : 0.28;
    let moving = false;
    for (const key of ["x", "y", "w", "h", "r"]) {
      const delta = goal[key] - shown[key];
      shown[key] = Math.abs(delta) < 0.1 ? goal[key] : shown[key] + delta * ease;
      if (shown[key] !== goal[key]) moving = true;
    }

    /* Only write what changed. */
    const transform = `translate3d(${shown.x.toFixed(1)}px, ${shown.y.toFixed(1)}px, 0) scale(${pressed ? 0.9 : 1})`;
    if (transform !== written.transform) {
      cursor.style.transform = transform;
      written.transform = transform;
    }
    const w = Math.round(shown.w * 2) / 2;
    const h = Math.round(shown.h * 2) / 2;
    const r = Math.round(shown.r * 2) / 2;
    if (w !== written.w) cursor.style.width = `${(written.w = w)}px`;
    if (h !== written.h) cursor.style.height = `${(written.h = h)}px`;
    if (r !== written.r) cursor.style.borderRadius = `${(written.r = r)}px`;
    if (mode !== written.mode) cursor.dataset.mode = written.mode = mode;

    if (moving) frame = requestAnimationFrame(render);
  }

  function wake() {
    if (!frame) frame = requestAnimationFrame(render);
  }

  window.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    cursor.classList.add("is-visible");
    follow();
    queueAim();
    wake();
  }, { passive: true });

  /* Content moves under a still pointer while scrolling: re-check
     what is under it, but not on every frame, and once more after
     the scroll settles. */
  window.addEventListener("scroll", () => {
    const now = performance.now();
    if (now - lastScrollAim > SCROLL_AIM_MS) {
      lastScrollAim = now;
      queueAim();
    }
    window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(queueAim, SCROLL_AIM_MS + 30);
  }, { passive: true });

  window.addEventListener("pointerdown", () => {
    pressed = true;
    wake();
  });
  window.addEventListener("pointerup", () => {
    pressed = false;
    wake();
  });

  root.addEventListener("mouseleave", () => cursor.classList.remove("is-visible"));
  window.addEventListener("blur", () => cursor.classList.remove("is-visible"));
})();
