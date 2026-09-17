/* =============================================================
   MOTION — Scroll reveal + GSAP hero sequence
   Merwin Generoso Portfolio — v20260918-3
   Uses IntersectionObserver to drive .reveal / .is-visible
   (defined in css/motion.css). GSAP used only for hero sequence.
   ============================================================= */

(function initMotion() {

  function waitForGSAP(cb, attempts) {
    attempts = attempts || 0;
    if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
      cb();
    } else if (attempts < 60) {
      setTimeout(function() { waitForGSAP(cb, attempts + 1); }, 50);
    }
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ----------------------------------------------------------------
     Hero sequence — runs once on page load.
     Animates children of the hero section using GSAP, then marks
     the HTML element so motion.css disables transitions on .reveal
     (they are handled by GSAP for the hero only).
  ---------------------------------------------------------------- */
  function bootHero() {
    if (reduceMotion) return;

    gsap.registerPlugin(ScrollTrigger);
    document.documentElement.classList.add("gsap-motion-ready");

    const heroTl = gsap.timeline({ delay: 0.05 });

    heroTl.fromTo(
      ".hero .availability",
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.38, ease: "power2.out" }
    );
    heroTl.fromTo(
      ".hero h1",
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.52, ease: "power3.out" },
      "-=0.22"
    );
    heroTl.fromTo(
      ".hero .hero-intro",
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.42, ease: "power2.out" },
      "-=0.32"
    );
    heroTl.fromTo(
      ".hero .hero-actions",
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.36, ease: "power2.out" },
      "-=0.25"
    );
    heroTl.fromTo(
      ".hero .hero-services",
      { opacity: 0 },
      { opacity: 1, duration: 0.3, ease: "power1.out" },
      "-=0.18"
    );
    heroTl.fromTo(
      ".hero .hero-visual-stack",
      { opacity: 0, x: 18 },
      { opacity: 1, x: 0, duration: 0.55, ease: "power3.out" },
      "-=0.48"
    );
  }

  /* ----------------------------------------------------------------
     IntersectionObserver scroll reveals.
     Drives .reveal → .is-visible transitions defined in motion.css.
     This is the canonical reveal system used by all sections.
  ---------------------------------------------------------------- */
  function bootReveal() {
    if (!("IntersectionObserver" in window)) {
      // Graceful degradation — make everything visible immediately.
      document.querySelectorAll(".reveal").forEach(function(el) {
        el.classList.add("is-visible");
      });
      return;
    }

    if (reduceMotion) {
      document.querySelectorAll(".reveal").forEach(function(el) {
        el.classList.add("is-visible");
      });
      return;
    }

    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        const entersFromTop = entry.boundingClientRect.top < 0;
        entry.target.classList.toggle("reveal-from-top", entersFromTop);
        entry.target.classList.toggle("is-visible", entry.isIntersecting);
      });
    }, {
      threshold: 0.1,
      rootMargin: "0px 0px -6% 0px"
    });

    document.querySelectorAll(".reveal").forEach(function(el) {
      observer.observe(el);
    });
  }

  /* ----------------------------------------------------------------
     Boot — wait for content to be injected by content.js before
     observing reveal targets (they don't exist yet at parse time).
  ---------------------------------------------------------------- */
  function run() {
    waitForGSAP(bootHero);
    bootReveal();
  }

  if (window.portfolioContentReady && typeof window.portfolioContentReady.finally === "function") {
    window.portfolioContentReady.finally(run);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }

})();
