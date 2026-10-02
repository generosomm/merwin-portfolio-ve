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

  const cursor = document.createElement("div");
  cursor.className = "ios-cursor";
  cursor.setAttribute("aria-hidden", "true");
  document.body.appendChild(cursor);
  root.classList.add("has-ios-cursor");

  /* Where the pointer is, and what the cursor shape should become. */
  const pointer = { x: -100, y: -100 };
  const goal = { x: -100, y: -100, w: DOT, h: DOT, r: DOT / 2 };
  const shown = { ...goal };
  let target = null;
  let mode = "dot";
  let frame = 0;
  let pressed = false;

  function setLean(element, x, y) {
    element?.style.setProperty("--lean-x", `${x.toFixed(2)}px`);
    element?.style.setProperty("--lean-y", `${y.toFixed(2)}px`);
  }

  function release() {
    if (!target) return;
    target.classList.remove("is-cursor-target");
    target.style.removeProperty("--lean-x");
    target.style.removeProperty("--lean-y");
    target = null;
  }

  function aim() {
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
      const lean = reduceMotion.matches ? { x: 0, y: 0 } : {
        x: ((pointer.x - (box.left + box.width / 2)) / box.width) * 6,
        y: ((pointer.y - (box.top + box.height / 2)) / box.height) * 4
      };
      setLean(target, lean.x, lean.y);
      const radius = parseFloat(getComputedStyle(control).borderTopLeftRadius) || 0;
      goal.w = box.width + PAD * 2;
      goal.h = box.height + PAD * 2;
      goal.x = box.left - PAD + lean.x;
      goal.y = box.top - PAD + lean.y;
      goal.r = Math.min(Math.max(radius + PAD, 10), goal.h / 2);
      return;
    }

    release();
    const textual = !control && element?.closest(TEXT);
    if (textual) {
      /* Text: a thin bar as tall as the line under the pointer. */
      mode = "text";
      const size = parseFloat(getComputedStyle(element).fontSize) || 16;
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

  function render() {
    frame = 0;
    aim();
    const ease = reduceMotion.matches ? 1 : 0.28;
    let moving = false;
    for (const key of ["x", "y", "w", "h", "r"]) {
      const delta = goal[key] - shown[key];
      shown[key] = Math.abs(delta) < 0.1 ? goal[key] : shown[key] + delta * ease;
      if (shown[key] !== goal[key]) moving = true;
    }
    const scale = pressed ? 0.9 : 1;
    cursor.style.transform = `translate3d(${shown.x}px, ${shown.y}px, 0) scale(${scale})`;
    cursor.style.width = `${shown.w}px`;
    cursor.style.height = `${shown.h}px`;
    cursor.style.borderRadius = `${shown.r}px`;
    cursor.dataset.mode = mode;
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
    wake();
  }, { passive: true });

  /* Content moves under a still pointer while scrolling. */
  window.addEventListener("scroll", wake, { passive: true });

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
