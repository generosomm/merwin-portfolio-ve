/* Light / dark switch.
   The inline script in each page's <head> sets data-theme="light"
   before first paint (no dark flash); this file runs the button.
   The new theme grows out of the button as a circle (View
   Transitions); browsers without it get a short colour fade, and
   reduced motion or lite mode switch instantly. The choice is kept
   in localStorage under "theme"; with nothing saved the site is dark. */
(() => {
  const KEY = "theme";
  const root = document.documentElement;
  const meta = document.querySelector('meta[name="theme-color"]');
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const isLight = () => root.dataset.theme === "light";

  function sync() {
    document.querySelectorAll(".theme-toggle").forEach((button) => {
      /* The menu button names the mode it switches to; icon buttons are on/off. */
      if (button.dataset.light) button.querySelector("span").textContent = isLight() ? button.dataset.dark : button.dataset.light;
      else button.setAttribute("aria-pressed", String(isLight()));
    });
    meta?.setAttribute("content", isLight() ? "#F4F3EF" : "#0A0A0A");
  }

  function apply(light) {
    if (light) root.dataset.theme = "light";
    else delete root.dataset.theme;
    try { localStorage.setItem(KEY, light ? "light" : "dark"); } catch { /* private mode: not remembered */ }
    sync();
  }

  function toggle(button) {
    const light = !isLight();
    if (reduceMotion.matches || root.classList.contains("perf-lite")) return apply(light);

    if (!document.startViewTransition) {
      root.classList.add("theme-fade");
      apply(light);
      setTimeout(() => root.classList.remove("theme-fade"), 450);
      return;
    }

    const box = button.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = document.startViewTransition(() => apply(light));
    transition.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 650, easing: "cubic-bezier(.65, 0, .35, 1)", pseudoElement: "::view-transition-new(root)" }
      );
    }).catch(() => {});
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest(".theme-toggle");
    if (button) toggle(button);
  });

  sync();
  Promise.resolve(window.portfolioContentReady).then(sync, sync);
})();
