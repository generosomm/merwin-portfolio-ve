"use strict";

/* =============================================================
   SITE — the scroll layer and the fixed chrome behaviour.
   Owns: reduced-motion gate, Lenis, a single scroll bus, the
   playhead, nav state, and the mobile menu.
   Exposes window.portfolio for js/motion.js to attach to.
   ============================================================= */

(function initSite() {
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduceMotion = motionQuery.matches;

  const root = document.documentElement;
  const subscribers = new Set();
  /* Cache-buster for js/scene/, which index.html never references
     directly. boot.js passes it on to the modules it imports. */
  const SCENE_VERSION = "p5";

  let lenis = null;
  let frameQueued = false;

  /* ---- Scroll bus ---------------------------------------------
     One source of scroll truth. Everything that reacts to scroll
     subscribes here rather than adding its own listener.
  ------------------------------------------------------------- */

  function readScroll() {
    const scroll = window.scrollY || root.scrollTop || 0;
    const limit = Math.max(root.scrollHeight - window.innerHeight, 0);
    const progress = limit > 0 ? Math.min(Math.max(scroll / limit, 0), 1) : 0;
    return { scroll, limit, progress };
  }

  function emit(state) {
    const payload = state || readScroll();
    subscribers.forEach((callback) => {
      try {
        callback(payload);
      } catch (error) {
        console.error("Scroll subscriber failed.", error);
      }
    });
  }

  function queueEmit() {
    if (frameQueued) return;
    frameQueued = true;
    requestAnimationFrame(() => {
      frameQueued = false;
      emit();
    });
  }

  function onScroll(callback) {
    if (typeof callback !== "function") return () => {};
    subscribers.add(callback);
    callback(readScroll());
    return () => subscribers.delete(callback);
  }

  /* ---- Smooth scroll -----------------------------------------
     Lenis drives its own rAF loop on purpose: if the GSAP CDN ever
     fails, scrolling must still work. `autoRaf` is what turns that
     loop on — Lenis 1.1 defaults it to false, and without it Lenis
     swallows every wheel event and never animates to the target,
     so the page cannot be scrolled at all.
  ------------------------------------------------------------- */

  /* Touch devices keep the browser's own momentum scrolling: it is
     what people expect under their thumb, and it is the only thing
     that stays smooth through iOS Safari's address-bar resizes. */
  const touchFirst = window.matchMedia("(hover: none), (pointer: coarse)").matches;

  function initLenis() {
    if (reduceMotion || touchFirst || lenis || typeof window.Lenis !== "function") return null;

    const instance = new window.Lenis({
      autoRaf: true,
      lerp: 0.09,
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
      smoothWheel: true
    });

    instance.on("scroll", ({ scroll, limit, progress }) => {
      emit({
        scroll,
        limit,
        progress: Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 1) : 0
      });
    });

    return instance;
  }

  /* Lenis loads from a CDN after this file, so it is attached when it
     arrives rather than being waited on. `load` fires only after every
     deferred script has executed. */
  function attachLenisWhenReady() {
    if (reduceMotion) return;

    const attach = () => {
      if (lenis) return;
      lenis = initLenis();
      if (!lenis) return;
      window.removeEventListener("scroll", queueEmit);
      window.dispatchEvent(new CustomEvent("portfolio:lenis"));
      emit();
    };

    if (typeof window.Lenis === "function") attach();
    else window.addEventListener("load", attach, { once: true });
  }

  /* ---- Preloader ----------------------------------------------
     A bar filling like an export, with a timecode counting beside
     it. Resolves the moment the wipe STARTS, so the hero animates
     into view behind it rather than after it.
  ------------------------------------------------------------- */

  function initPreloader() {
    const element = document.querySelector('[data-chrome="preloader"]');
    const active = root.classList.contains("preloading");

    if (!element || !active) {
      root.classList.remove("preloading");
      element?.remove();
      return Promise.resolve();
    }

    const fill = element.querySelector("#preloader-fill");
    const readout = element.querySelector("#preloader-timecode");
    const fps = Number(element.dataset.fps) || 24;
    const frames = Number(element.dataset.frames) || 36;
    const duration = Number(element.dataset.duration) || 850;
    const exitMs = Number(element.dataset.exit) || 650;
    /* The screen also waits for the live stats (js/live-stats.js), so
       the Track Record shows real numbers when it lifts, but never
       longer than maxWait from navigation start. */
    const maxWait = Number(element.dataset.maxWait) || 2000;
    let liveSettled = !window.portfolioLive?.ready;
    window.portfolioLive?.ready?.then(() => { liveSettled = true; });
    const pad = (value) => String(value).padStart(2, "0");

    /* Timing lives in JSON rather than CSS so the whole render screen
       is tunable from one place. */
    element.style.transitionDuration = `${exitMs}ms`;

    lenis?.stop();

    return new Promise((resolve) => {
      let frameRequest = 0;
      let finished = false;

      function paint(progress) {
        if (fill) fill.style.transform = `scaleX(${progress})`;
        if (!readout) return;
        const frame = Math.round(progress * frames);
        readout.textContent = `00:00:${pad(Math.floor(frame / fps))}:${pad(frame % fps)}`;
      }

      function finish() {
        if (finished) return;
        finished = true;
        window.cancelAnimationFrame(frameRequest);
        paint(1);

        element.classList.add("is-exiting");
        root.classList.remove("preloading");
        lenis?.start();
        resolve();

        window.setTimeout(() => element.remove(), exitMs);
      }

      /* `now` is measured from navigation start, and so is the bar.
         That makes the render screen ABSORB load time rather than add
         to it: if the first frame paints late, the bar is already most
         of the way across instead of starting over. */
      function step(now) {
        const progress = Math.min(now / duration, 1);
        /* Ease out so the bar decelerates into its end point. While the
           live stats are still on their way it holds just short of the
           end, then completes the moment they land. */
        const eased = 1 - Math.pow(1 - progress, 3);
        paint(liveSettled ? eased : Math.min(eased, 0.92));
        if (progress >= 1 && liveSettled) finish();
        else frameRequest = window.requestAnimationFrame(step);
      }

      frameRequest = window.requestAnimationFrame(step);

      element.addEventListener("pointerdown", finish);
      document.addEventListener("keydown", finish, { once: true });

      /* Never wait on the network longer than maxWait, and if anything
         else stalls, the page still gets revealed. */
      window.setTimeout(finish, Math.max(Math.max(duration, maxWait) - performance.now(), 0));
      window.setTimeout(finish, Math.max(duration - performance.now(), 0) + 2400);
    });
  }

  /* ---- Playhead ---------------------------------------------- */

  function initPlayhead() {
    const bar = document.querySelector("#playhead");
    const fill = document.querySelector("#playhead-fill");
    if (!fill) return;

    onScroll(({ progress }) => {
      fill.style.transform = `scaleX(${progress})`;
    });

    /* Notches mark the scroll position at which each section begins,
       so they line up with the fill rather than with the viewport. */
    function drawNotches() {
      if (!bar) return;
      bar.querySelectorAll(".playhead-notch").forEach((node) => node.remove());

      const { limit } = readScroll();
      if (limit <= 0) return;

      const sections = Array.from(document.querySelectorAll("[data-section]"));
      const fragment = document.createDocumentFragment();

      sections.forEach((section) => {
        const top = section.getBoundingClientRect().top + window.scrollY;
        const ratio = Math.min(Math.max(top / limit, 0), 1);
        if (ratio <= 0 || ratio >= 1) return;
        const notch = document.createElement("span");
        notch.className = "playhead-notch";
        notch.style.left = `${(ratio * 100).toFixed(3)}%`;
        fragment.appendChild(notch);
      });

      bar.appendChild(fragment);
    }

    drawNotches();
    if (document.fonts?.ready) document.fonts.ready.then(drawNotches);
    window.addEventListener("resize", debounce(drawNotches, 180), { passive: true });
  }

  /* ---- Hero lockup --------------------------------------------
     The portrait sits just past the end of the first name line.
     That width depends on the font that actually loaded, so it is
     measured rather than assumed. Stored in em, which makes it
     independent of viewport size: one measurement per font swap.
  ------------------------------------------------------------- */

  function initHeroLockup() {
    const lockup = document.querySelector(".hero-lockup");
    const line = lockup?.querySelector(".hero-line-back .hero-line-inner");
    if (!line?.firstChild) return;

    function measure() {
      const fontSize = parseFloat(getComputedStyle(lockup).fontSize);
      if (!fontSize) return;
      const range = document.createRange();
      range.selectNodeContents(line);
      const end = range.getBoundingClientRect().right - lockup.getBoundingClientRect().left;
      lockup.style.setProperty("--name-end", `${(end / fontSize).toFixed(3)}em`);
    }

    measure();
    if (document.fonts?.ready) document.fonts.ready.then(measure);
  }

  /* ---- 3D layer -----------------------------------------------
     Optional and self-contained: js/scene/boot.js waits for the hero
     to paint, then picks the live scene or the poster. If the folder
     is deleted the import fails quietly and the hero stays as is.
  ------------------------------------------------------------- */

  function initScene() {
    const url = new URL(`js/scene/boot.js?v=${SCENE_VERSION}`, document.baseURI);
    import(url.href).catch(() => {});
  }

  /* ---- Active nav state --------------------------------------- */

  function initNavState() {
    /* Desktop nav and the phone menu share the same active state. */
    const links = Array.from(document.querySelectorAll(".chrome-nav-link, .menu-link"));
    const sections = Array.from(document.querySelectorAll("[data-section]"));
    if (!links.length || !sections.length || !("IntersectionObserver" in window)) return;

    const byId = new Map();
    links.forEach((link) => {
      const id = (link.getAttribute("href") || "").replace("#", "");
      if (!byId.has(id)) byId.set(id, []);
      byId.get(id).push(link);
    });

    const visible = new Set();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        });

        const current = sections.find((section) => visible.has(section.id));
        links.forEach((link) => link.removeAttribute("aria-current"));
        (current ? byId.get(current.id) || [] : []).forEach((link) => link.setAttribute("aria-current", "true"));
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );

    sections.forEach((section) => observer.observe(section));
  }

  /* ---- Mobile menu --------------------------------------------
     `inert` keeps focus out of the closed menu without a
     hand-rolled focus trap.
  ------------------------------------------------------------- */

  function initMenu() {
    const menu = document.querySelector("#menu");
    const toggle = document.querySelector("#nav-toggle");
    if (!menu || !toggle) return;

    const openLabel = toggle.getAttribute("aria-label") || "";
    const closeLabel = toggle.dataset.closeLabel || openLabel;
    let open = false;

    function setState(next) {
      open = next;
      menu.classList.toggle("is-open", open);
      menu.inert = !open;
      menu.setAttribute("aria-hidden", String(!open));
      root.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? closeLabel : openLabel);

      if (open) {
        lenis?.stop();
        menu.querySelector("a")?.focus();
      } else {
        lenis?.start();
      }
    }

    setState(false);

    toggle.addEventListener("click", () => setState(!open));

    menu.addEventListener("click", (event) => {
      if (event.target.closest("a")) setState(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && open) {
        setState(false);
        toggle.focus();
      }
    });

    /* Resizing past the breakpoint hides the menu in CSS, so its
       state has to be reset or the toggle lies about it. */
    window.addEventListener(
      "resize",
      debounce(() => {
        if (open && window.innerWidth >= 768) setState(false);
      }, 180),
      { passive: true }
    );
  }

  /* ---- Anchor navigation -------------------------------------- */

  /* Where scroll-padding-top (css/base.css) parks an anchor target. */
  function headerClearance() {
    return parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
  }

  function initAnchors() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link) return;

      const id = link.getAttribute("href");
      if (!id || id === "#") return;

      const target = document.querySelector(id);
      if (!target) return;

      event.preventDefault();

      /* Content above the target can still grow while the page scrolls
         to it (lazy sections such as the GitHub graph draw themselves
         as they come near), which leaves a long jump short. When the
         scroll settles, check where the target ended up and finish the
         trip if it moved. Only once, so a user who scrolls away during
         the jump is not dragged back repeatedly. */
      const settle = () => {
        const drift = Math.abs(target.getBoundingClientRect().top - (lenis ? 48 : headerClearance()));
        if (drift < 24 || window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) return;
        if (lenis) lenis.scrollTo(target, { offset: -48, immediate: true });
        else target.scrollIntoView({ behavior: "auto", block: "start" });
      };

      if (lenis) {
        lenis.scrollTo(target, { offset: -48, onComplete: settle });
      } else {
        /* No Lenis (touch, or reduced motion): the browser scrolls,
           smoothly unless motion is reduced. scroll-padding-top in
           css/base.css keeps the target clear of the header. */
        target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        if ("onscrollend" in window) window.addEventListener("scrollend", settle, { once: true });
        else window.setTimeout(settle, 1200);
      }

      /* Keyboard and screen-reader users land in the section they
         asked for, not back at the link. */
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });

      /* Keep the URL shareable without letting the browser also
         perform its own jump. */
      if (window.history?.replaceState) window.history.replaceState(null, "", id);
    });
  }

  /* ---- Helpers ------------------------------------------------ */

  function debounce(callback, wait) {
    let timer = 0;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback(...args), wait);
    };
  }

  /* ---- Boot ---------------------------------------------------- */

  function boot() {
    /* The render screen starts first and waits for nothing. */
    const ready = initPreloader();
    attachLenisWhenReady();

    window.portfolio = {
      get reduceMotion() {
        return reduceMotion;
      },
      get lenis() {
        return lenis;
      },
      onScroll,
      readScroll,
      ready
    };

    /* The hero entrance is CSS (css/hero.css): it plays as soon as the
       page is ready, without waiting for the animation library. Once
       it has finished, the start pose is dropped. */
    ready.then(() => {
      root.classList.add("hero-play");
      window.setTimeout(() => root.classList.remove("hero-armed"), 2500);
    });

    initHeroLockup();
    initScene();
    initPlayhead();
    initNavState();
    initMenu();
    initAnchors();

    /* Native scroll drives the bus until (and unless) Lenis attaches. */
    if (!lenis) window.addEventListener("scroll", queueEmit, { passive: true });
    window.addEventListener("resize", queueEmit, { passive: true });
    emit();
  }

  motionQuery.addEventListener?.("change", (event) => {
    reduceMotion = event.matches;
    if (reduceMotion && lenis) {
      lenis.destroy();
      lenis = null;
      window.addEventListener("scroll", queueEmit, { passive: true });
      emit();
    }
  });

  if (window.portfolioContentReady?.then) {
    window.portfolioContentReady.then(boot).catch(boot);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
