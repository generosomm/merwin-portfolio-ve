"use strict";

/* Rounded arrow inspired by the reference. Difference blending inverts
   the pixels beneath it; the tip stays on the pointer hotspot. */
(function initCursor() {
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const forced = matchMedia("(forced-colors: active)");
  if (!fine.matches || forced.matches) return;
  const root = document.documentElement;
  const cursor = document.createElement("div");
  cursor.className = "ios-cursor";
  cursor.setAttribute("aria-hidden", "true");
  cursor.innerHTML = '<svg viewBox="0 0 32 38" aria-hidden="true"><path d="M4 5C4 2.5 6.1 1.8 7.8 3.6L28.2 24C30 25.8 29.1 28 26.6 28H17.1L10 35.1C8 37.1 4 35.8 4 33V5Z"/></svg>';
  document.body.append(cursor);
  function hide() {
    cursor.classList.remove("is-visible", "is-pressed");
    root.classList.remove("has-ios-cursor");
  }
  window.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" || !fine.matches || forced.matches) { hide(); return; }
    cursor.style.transform = `translate3d(${event.clientX - 2.5}px, ${event.clientY - 1.9}px, 0)`;
    cursor.classList.add("is-visible");
    root.classList.add("has-ios-cursor");
  }, { passive: true });
  window.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") cursor.classList.add("is-pressed");
  }, { passive: true });
  window.addEventListener("pointerup", () => cursor.classList.remove("is-pressed"), { passive: true });
  root.addEventListener("mouseleave", hide);
  window.addEventListener("blur", hide);
  fine.addEventListener("change", hide);
  forced.addEventListener("change", hide);
})();
