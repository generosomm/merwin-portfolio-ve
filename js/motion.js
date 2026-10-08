"use strict";

/* =============================================================
   MOTION — GSAP + ScrollTrigger, attached to the scroll layer in
   js/site.js. Nothing here initialises under prefers-reduced-motion.
   Phase 1 scope: plumbing only. Animations land in Phases 2-5.
   ============================================================= */

(function initMotion() {
  function boot() {
    const site = window.portfolio;
    if (!site || site.reduceMotion) return;
    if (typeof window.gsap === "undefined" || typeof window.ScrollTrigger === "undefined") return;

    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);
    /* Mobile browsers resize the viewport as the address bar slides;
       re-measuring every trigger on each of those makes pins and
       scrubs jump. Only real width changes trigger a refresh. */
    ScrollTrigger.config({ ignoreMobileResize: true });
    document.documentElement.classList.add("motion-ready");

    /* Lenis runs its own rAF loop, so ScrollTrigger only needs to be
       told when the scroll position changed. Lenis may attach after
       this file runs, so listen for it either way. */
    const bindLenis = () => {
      const lenis = window.portfolio?.lenis;
      if (lenis) lenis.on("scroll", ScrollTrigger.update);
    };
    bindLenis();
    window.addEventListener("portfolio:lenis", bindLenis, { once: true });

    /* Web fonts change measured heights; refresh once they land so
       every trigger position is measured against final metrics. */
    if (document.fonts?.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());

    window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });

    /* Lazy images change heights below the fold as they arrive; one
       debounced refresh after a burst of them keeps triggers honest. */
    let refreshTimer = 0;
    document.addEventListener("load", (event) => {
      if (event.target.tagName !== "IMG") return;
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 250);
    }, true);

    /* Set up the introduction before the section and card reveals. */
    aboutScroll(gsap);
    practiceStack(gsap);
    sectionTitles(gsap);
    countUps(gsap);
    entrances(gsap);
    closingStatement(gsap);
    stackWave(gsap);

    /* The hero entrance is CSS now (css/hero.css, triggered by
       js/site.js), so it never waits for this file or GSAP. */
  }

  /* ---- About ---------------------------------------------------
     Scrubbed to the scroll, not played once: each word starts faint,
     blurred and slightly low, and sharpens into place as you scroll.
     On wide screens the section pins for most of a screen's worth of
     scrolling so the whole sentence resolves while it holds still;
     on phones it resolves as it passes, without the pin.
  ---------------------------------------------------------------- */

  function aboutScroll(gsap) {
    const section = document.querySelector(".section-about");
    const words = section?.querySelectorAll(".about-word");
    if (!words?.length) return;

    /* 0.55 keeps even the green words above 3:1 at their dimmest. */
    const from = { opacity: 0.55, filter: "blur(10px)", yPercent: 35 };
    const to = { opacity: 1, filter: "blur(0px)", yPercent: 0, ease: "power2.out", stagger: 0.08, duration: 0.6 };

    /* Pinning only where it is reliable: a laptop or desktop with a real
       pointer. Tablets and phones get the same reveal as the section
       passes, without holding the page still. */
    gsap.matchMedia().add(
      {
        wide: "(min-width: 1024px) and (hover: hover) and (pointer: fine)",
        narrow: "(max-width: 1023px), (hover: none), (pointer: coarse)"
      },
      ({ conditions }) => {
        if (conditions.wide) {
          gsap
            .timeline({
              scrollTrigger: { trigger: section, start: "top 85%", end: "bottom 55%", scrub: 0.8 }
            })
            .fromTo(words, from, to);
        } else {
          gsap.fromTo(words, from, {
            ...to,
            scrollTrigger: { trigger: section.querySelector(".about-text"), start: "top 85%", end: "bottom 55%", scrub: 0.8 }
          });
        }
      }
    );
  }

  function practiceStack(gsap) {
    const cards = Array.from(document.querySelectorAll(".practice-card"));
      gsap.matchMedia().add("all", () => {
      cards.slice(0, -1).forEach((card, index) => {
        const next = cards[index + 1];
        const inner = card.querySelector(".practice-card-inner");
        const shade = card.querySelector(".practice-shade");
        if (!inner) return;

        gsap
          .timeline({
            scrollTrigger: {
              trigger: next,
              start: "top bottom",
              /* Ends exactly where the next card sticks. */
              end: () => `top ${parseFloat(getComputedStyle(next).top) || 0}px`,
                scrub: true,
                invalidateOnRefresh: true
            }
          })
            .to(inner, { scale: () => window.matchMedia("(max-width: 767px)").matches ? 0.96 : 0.93, rotateX: () => window.matchMedia("(max-width: 767px)").matches ? 4 : 6, ease: "none" }, 0)
          .to(shade, { opacity: 0.55, ease: "none" }, 0);
      });
    });
  }

  /* ---- Entrances ---------------------------------------------------
     Work rows and edit cards rise in once, staggered, as their list
     reaches the screen. `from` renders the start state immediately,
     so nothing flashes first.
  ---------------------------------------------------------------- */

  function entrances(gsap) {
    [
      [".process-steps", ".process-step"],
      [".offer-list", ".offer-row"],
      [".work-list", ".work-row"],
      [".contact-list", ".contact-row"]
    ].forEach(([listSelector, itemSelector]) => {
      const list = document.querySelector(listSelector);
      const items = list?.querySelectorAll(itemSelector);
      if (!items?.length) return;

      gsap.from(items, {
        opacity: 0,
        y: 32,
        duration: 0.8,
        ease: "power2.out",
        stagger: 0.07,
        clearProps: "opacity,transform",
        scrollTrigger: { trigger: list, start: "top 85%", once: true }
      });
    });
  }

  /* ---- Stack logos -------------------------------------------------
     The logos pop in one after another, like a wave, the first time
     the Stack section reaches the screen.
  ---------------------------------------------------------------- */

  function stackWave(gsap) {
    const groups = document.querySelector(".stack-groups");
    const tiles = groups?.querySelectorAll(".stack-logo, .stack-pills li");
    if (!tiles?.length) return;

    gsap.from(tiles, {
      opacity: 0,
      scale: 0.6,
      y: 18,
      duration: 0.6,
      ease: "back.out(2.2)",
      stagger: 0.035,
      clearProps: "opacity,transform",
      scrollTrigger: { trigger: groups, start: "top 80%", once: true }
    });
  }

  /* ---- Closing statement --------------------------------------
     The same blur-to-sharp words as About, scrubbed as the contact
     section scrolls in, without the pin.
  ---------------------------------------------------------------- */

  function closingStatement(gsap) {
    const statement = document.querySelector(".contact-statement");
    const words = statement?.querySelectorAll(".about-word");
    if (!words?.length) return;

    gsap.fromTo(
      words,
      { opacity: 0.55, filter: "blur(10px)", yPercent: 35 },
      {
        opacity: 1,
        filter: "blur(0px)",
        yPercent: 0,
        ease: "power2.out",
        stagger: 0.08,
        duration: 0.6,
        scrollTrigger: { trigger: statement, start: "top 88%", end: "bottom 55%", scrub: 0.8 }
      }
    );
  }

  /* ---- Section titles ------------------------------------------
     Every title arrives as an outline and fills in solid, left to
     right, as it scrolls up the screen (see css/sections.css).
  ---------------------------------------------------------------- */

  function sectionTitles(gsap) {
    document.querySelectorAll(".section-title").forEach((title) => {
      gsap.fromTo(
        title,
        { "--fill": 0 },
        {
          "--fill": 1,
          ease: "none",
          scrollTrigger: { trigger: title, start: "top 92%", end: "top 55%", scrub: 0.6 }
        }
      );
    });
  }

  /* ---- Numbers ---------------------------------------------------
     Markup ships the real figure; this rewinds to zero and counts up
     only once the block is actually on screen.
  ---------------------------------------------------------------- */

  function countUps(gsap) {
    const { ScrollTrigger } = window;

    /* The target is read when the count starts, not when the page
       loads: js/live-stats.js may swap a card's figure for the live
       one (81.4 instead of 74) while it's still off screen. data-
       decimals lets a figure like 81.4 count with its decimal. */
    const targetOf = (element) => Number(element.dataset.countTo);
    const show = (element, value) => {
      const decimals = Number(element.dataset.decimals) || 0;
      element.textContent = value.toFixed(decimals);
    };

    /* A live card waits (at most ~3 s) for live-stats.js to settle,
       so it counts once to the right number instead of counting to
       the old figure and then jumping. */
    const settled = (card) =>
      card.hasAttribute("data-live") && window.portfolioLive?.ready
        ? Promise.race([window.portfolioLive.ready, new Promise((resolve) => setTimeout(resolve, 3200))])
        : Promise.resolve();

    /* Desktop shows all four cards in one row, so they can start as
       soon as the row peeks in. On phones each card is its own row: if
       it started at the bottom edge the count would be over before the
       card reached the eye, so there each card waits until it is well
       in view, counts a little longer, and rises in as it starts. */
    gsap.matchMedia().add(
      { wide: "(min-width: 768px)", narrow: "(max-width: 767px)" },
      ({ conditions }) => {
        const counted = [];
        document.querySelectorAll(".number").forEach((card) => {
          const element = card.querySelector(".number-value");
          if (!element || !Number.isFinite(targetOf(element))) return;
          counted.push(element);

          element.textContent = "0";
          element.dataset.countState = "waiting";
          if (conditions.narrow) gsap.set(card, { opacity: 0, y: 28 });

          ScrollTrigger.create({
            trigger: conditions.narrow ? card : element,
            start: conditions.narrow ? "top 72%" : "top 88%",
            once: true,
            onEnter: async () => {
              await settled(card);
              const counter = { value: 0 };
              const timeline = gsap.timeline();
              element.dataset.countState = "running";
              if (conditions.narrow) {
                timeline.to(card, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, 0);
              }
              timeline.to(counter, {
                value: targetOf(element),
                duration: conditions.narrow ? 1.8 : 1.4,
                ease: "power2.out",
                onUpdate: () => show(element, counter.value),
                onComplete: () => {
                  show(element, targetOf(element));
                  element.dataset.countState = "done";
                  element.dispatchEvent(new CustomEvent("count:done"));
                }
              }, conditions.narrow ? 0.1 : 0);
            }
          });
        });

        /* Leaving this layout (window resized past the breakpoint):
           show the real figures so none sticks part-way. */
        return () => {
          counted.forEach((element) => {
            show(element, targetOf(element));
            element.dataset.countState = "done";
          });
        };
      }
    );
  }

  if (window.portfolioContentReady?.then) {
    window.portfolioContentReady.then(boot).catch(boot);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
