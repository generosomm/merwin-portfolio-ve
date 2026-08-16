"use strict";

/*
  ERO | VISUALS motion system.
  The site uses three repeatable families only: cut, lift, and stagger.
  Visible content remains in data/*.json and this file never builds UI.
*/
const MOTION_CONFIG = Object.freeze({
  heroDuration: 0.32,
  heroStagger: 0.04,
  revealDuration: 0.38,
  revealDistance: 18,
  detailDuration: 0.28,
  detailStagger: 0.03,
  counterDuration: 0.65,
  dialogDuration: 0.2,
  interactionDuration: 0.14
});

const MOTION_PROFILES = Object.freeze([
  {
    name: "cut",
    selector: ".section-heading, .subsection-title, .gallery-kicker, .contact-inner > h2",
    state: () => ({ autoAlpha: 0, x: -18, y: 0, scale: 1 })
  },
  {
    name: "lift",
    selector: ".horizontal-track > *, .role-spotlight, .about-layout, .credentials, .proof-total, .contact-email",
    state: ({ vertical }) => ({ autoAlpha: 0, x: 0, y: vertical * 16, scale: 0.985 })
  },
  {
    name: "stagger",
    selector: ".contact-inner > *",
    state: ({ vertical }) => ({ autoAlpha: 0, x: 0, y: vertical * 12, scale: 1 })
  }
]);

const DETAIL_TARGETS = Object.freeze({
  headingHosts: ".section-heading, .subsection-title, .about-layout, .credentials, .contact-inner > h2",
  mediaCards: ".case-study, .proof-card, .certificate-card",
  panelHosts: ".role-spotlight, .about-layout, .credentials, .case-study, .repo-list article, .operations-card"
});

function initializePortfolioMotion() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealTargets = Array.from(document.querySelectorAll(".reveal"));

  if (reduceMotion || !window.gsap || !window.ScrollTrigger) return;

  const saveData = Boolean(navigator.connection?.saveData);
  const limitedMemory = Number.isFinite(navigator.deviceMemory) && navigator.deviceMemory <= 4;
  const limitedCpu = Number.isFinite(navigator.hardwareConcurrency) && navigator.hardwareConcurrency <= 4;
  const lightweightMode = saveData || limitedMemory || limitedCpu;
  const { gsap, ScrollTrigger } = window;
  const detailedReveals = new WeakSet();
  const animatedDetails = new Set();

  function revealDelay(target) {
    const value = Number.parseFloat(target.style.getPropertyValue("--reveal-delay"));
    return Number.isFinite(value) ? Math.min(value / 1000, 0.09) : 0;
  }

  function revealStartState(target) {
    const vertical = target.classList.contains("reveal-from-top") ? -1 : 1;
    const profile = MOTION_PROFILES.find(({ selector }) => target.matches(selector));
    return profile
      ? profile.state({ vertical })
      : { autoAlpha: 0, x: 0, y: vertical * MOTION_CONFIG.revealDistance, scale: 1 };
  }

  function detailElements(target) {
    if (target.matches(".case-study")) {
      const copy = target.querySelector(".case-copy");
      return copy ? Array.from(copy.children) : [];
    }
    if (target.matches(".role-spotlight, .about-layout, .credentials, .repo-list article, .operations-card")) {
      return Array.from(target.children);
    }
    return [];
  }

  function animateRevealDetails(target) {
    if (lightweightMode || detailedReveals.has(target)) return;
    detailedReveals.add(target);

    if (target.matches(DETAIL_TARGETS.headingHosts)) {
      const heading = target.matches("h2, h3") ? target : target.querySelector("h2, h3");
      if (heading) {
        animatedDetails.add(heading);
        gsap.fromTo(
          heading,
          { y: 9, clipPath: "inset(0 0 20% 0)" },
          {
            y: 0,
            clipPath: "inset(0 0 0% 0)",
            duration: MOTION_CONFIG.revealDuration,
            ease: "power3.out",
            overwrite: "auto",
            clearProps: "transform,clip-path"
          }
        );
      }
    }

    if (target.matches(DETAIL_TARGETS.panelHosts)) {
      const details = detailElements(target);
      if (details.length > 1) {
        details.forEach((element) => animatedDetails.add(element));
        gsap.fromTo(
          details,
          { autoAlpha: 0.58, y: 8 },
          {
            autoAlpha: 1,
            y: 0,
            duration: MOTION_CONFIG.detailDuration,
            stagger: MOTION_CONFIG.detailStagger,
            ease: "power2.out",
            overwrite: "auto",
            clearProps: "opacity,visibility,transform"
          }
        );
      }
    }

    if (target.matches(DETAIL_TARGETS.mediaCards)) {
      const media = target.querySelector("img, video");
      if (media) {
        animatedDetails.add(media);
        gsap.fromTo(
          media,
          { scale: 1.035, clipPath: "inset(0 0 10% 0)" },
          {
            scale: 1,
            clipPath: "inset(0 0 0% 0)",
            duration: 0.4,
            ease: "power2.out",
            overwrite: "auto",
            clearProps: "transform,clip-path"
          }
        );
      }
    }
  }

  function showReveal(target, initial = false) {
    gsap.to(target, {
      autoAlpha: 1,
      x: 0,
      y: 0,
      scale: 1,
      duration: MOTION_CONFIG.revealDuration,
      delay: initial ? revealDelay(target) : 0,
      ease: "power3.out",
      overwrite: "auto",
      onStart: () => target.style.setProperty("will-change", "opacity, transform"),
      onComplete: () => {
        target.style.setProperty("will-change", "auto");
        if (target.classList.contains("is-visible")) {
          gsap.set(target, { clearProps: "opacity,visibility,transform" });
        }
      }
    });
    animateRevealDetails(target);
  }

  function hideReveal(target) {
    gsap.killTweensOf(target);
    gsap.set(target, revealStartState(target));
    target.style.setProperty("will-change", "auto");
  }

  function animateHero() {
    const shouldAnimate =
      (!window.location.hash || window.location.hash === "#top") &&
      performance.now() < 3500 &&
      window.scrollY < 80;
    if (!shouldAnimate) return;

    const visibleNav = gsap.utils
      .toArray(".site-nav > a, .site-nav > .nav-dropdown")
      .filter((element) => {
        const styles = window.getComputedStyle(element);
        return element.offsetParent !== null && styles.display !== "none" && styles.visibility !== "hidden";
      });
    const groups = [
      { elements: gsap.utils.toArray(".site-header .brand, .site-header .menu-button"), from: { y: -8 } },
      { elements: visibleNav, from: { y: -8 } },
      { elements: gsap.utils.toArray(".availability, .hero-copy > .eyebrow"), from: { x: -14 } },
      { elements: gsap.utils.toArray(".hero h1"), from: { y: 14 } },
      { elements: gsap.utils.toArray(".hero-intro, .hero-actions, .hero-services"), from: { y: 10 } },
      { elements: gsap.utils.toArray(".hero-receipt"), from: { x: 22, y: 6, scale: 0.98 } },
      { elements: gsap.utils.toArray(".hero-receipt > *"), from: { y: 6 } }
    ].filter(({ elements }) => elements.length);
    if (!groups.length) return;

    const animated = groups.flatMap(({ elements }) => elements);
    const timeline = gsap.timeline({
      defaults: {
        duration: lightweightMode ? 0.2 : MOTION_CONFIG.heroDuration,
        ease: "power3.out"
      },
      onComplete: () => gsap.set(animated, { clearProps: "opacity,visibility,transform,will-change" })
    });

    groups.forEach(({ elements, from }, index) => {
      timeline.fromTo(
        elements,
        {
          autoAlpha: 0,
          x: lightweightMode ? 0 : from.x || 0,
          y: lightweightMode ? 6 : from.y || 0,
          scale: lightweightMode ? 1 : from.scale || 1
        },
        {
          autoAlpha: 1,
          x: 0,
          y: 0,
          scale: 1,
          stagger: lightweightMode ? 0 : MOTION_CONFIG.heroStagger,
          onStart: () => gsap.set(elements, { willChange: "opacity, transform" })
        },
        index ? (lightweightMode ? "-=0.15" : "-=0.25") : 0
      );
    });
  }

  function counterParts(value) {
    const match = value.trim().match(/^(.*?)([\d,.]+)(.*)$/);
    if (!match) return null;
    const numberText = match[2];
    const number = Number.parseFloat(numberText.replaceAll(",", ""));
    if (!Number.isFinite(number)) return null;
    return {
      original: value,
      prefix: match[1],
      number,
      suffix: match[3],
      decimals: numberText.includes(".") ? numberText.split(".")[1].length : 0,
      usesGrouping: numberText.includes(",")
    };
  }

  function animateProofCounters() {
    if (lightweightMode) return;
    const counters = Array.from(document.querySelectorAll(".proof-card-top strong"))
      .map((target) => ({ target, parts: counterParts(target.textContent) }))
      .filter(({ parts }) => parts);
    const proof = document.querySelector(".proof");
    if (!proof || !counters.length) return;

    ScrollTrigger.create({
      trigger: proof,
      start: "top 76%",
      once: true,
      onEnter: () => {
        const state = { progress: 0 };
        let lastFrame = -1;
        gsap.to(state, {
          progress: 1,
          duration: MOTION_CONFIG.counterDuration,
          ease: "power2.out",
          onUpdate: () => {
            const frame = Math.round(state.progress * 24);
            if (frame === lastFrame) return;
            lastFrame = frame;
            counters.forEach(({ target, parts }) => {
              const formatted = (parts.number * state.progress).toLocaleString("en-US", {
                useGrouping: parts.usesGrouping,
                minimumFractionDigits: parts.decimals,
                maximumFractionDigits: parts.decimals
              });
              target.textContent = `${parts.prefix}${formatted}${parts.suffix}`;
            });
          },
          onComplete: () => counters.forEach(({ target, parts }) => {
            target.textContent = parts.original;
          })
        });
      }
    });
  }

  function animateDialogs() {
    if (lightweightMode) return;
    document.querySelectorAll(".video-trigger, .image-trigger").forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const dialog = trigger.classList.contains("video-trigger")
          ? document.querySelector("#video-dialog")
          : document.querySelector("#image-dialog");
        window.requestAnimationFrame(() => {
          const media = dialog?.open ? dialog.querySelector("video, img") : null;
          if (!media) return;
          gsap.fromTo(
            media,
            { autoAlpha: 0, y: 8, scale: 0.99 },
            {
              autoAlpha: 1,
              y: 0,
              scale: 1,
              duration: MOTION_CONFIG.dialogDuration,
              ease: "power2.out",
              clearProps: "opacity,visibility,transform"
            }
          );
        });
      });
    });
  }

  function animateExpandableDetails() {
    if (lightweightMode) return;
    document.querySelectorAll(".content-details").forEach((details) => {
      details.addEventListener("toggle", () => {
        if (!details.open) return;
        const panel = details.querySelector(".content-details-panel");
        if (!panel) return;
        const children = panel.children.length ? Array.from(panel.children) : [panel];
        gsap.fromTo(
          children,
          { autoAlpha: 0, y: 7 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.22,
            stagger: 0.025,
            ease: "power2.out",
            clearProps: "opacity,visibility,transform"
          }
        );
      });
    });
  }

  function animateMicroInteractions() {
    if (lightweightMode || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    document.querySelectorAll(".ui-action, .video-trigger, .contact-email").forEach((control) => {
      const icon = control.querySelector('[aria-hidden="true"], .play-pill i, i');
      if (!icon) return;
      control.addEventListener("pointerenter", () => {
        gsap.to(icon, { x: 2, duration: MOTION_CONFIG.interactionDuration, ease: "power2.out", overwrite: "auto" });
      });
      control.addEventListener("pointerleave", () => {
        gsap.to(icon, { x: 0, duration: MOTION_CONFIG.interactionDuration, ease: "power2.out", overwrite: "auto", clearProps: "transform" });
      });
    });
  }

  function animateFooter() {
    if (lightweightMode) return;
    const footer = document.querySelector(".site-footer");
    const children = footer ? Array.from(footer.children) : [];
    if (!children.length) return;
    ScrollTrigger.create({
      trigger: footer,
      start: "top 96%",
      once: true,
      onEnter: () => gsap.fromTo(
        children,
        { autoAlpha: 0, y: 8 },
        { autoAlpha: 1, y: 0, duration: MOTION_CONFIG.detailDuration, stagger: MOTION_CONFIG.detailStagger, ease: "power2.out", clearProps: "opacity,visibility,transform" }
      )
    });
  }

  try {
    gsap.registerPlugin(ScrollTrigger);
    animateHero();

    if (!lightweightMode && revealTargets.length) {
      document.documentElement.classList.add("gsap-motion-ready");
      const revealObserver = new MutationObserver((records) => {
        new Set(records.map(({ target }) => target)).forEach((target) => {
          if (target.classList.contains("is-visible")) showReveal(target);
          else hideReveal(target);
        });
      });

      revealTargets.forEach((target) => {
        revealObserver.observe(target, { attributes: true, attributeFilter: ["class"] });
        if (target.classList.contains("is-visible")) {
          gsap.set(target, revealStartState(target));
          showReveal(target, true);
        } else {
          hideReveal(target);
        }
      });
    }

    animateProofCounters();
    animateDialogs();
    animateExpandableDetails();
    animateMicroInteractions();
    animateFooter();
    window.requestAnimationFrame(() => ScrollTrigger.refresh());
    if (document.readyState !== "complete") {
      window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
    }
  } catch (error) {
    console.warn("Enhanced motion was skipped.", error);
    document.documentElement.classList.remove("gsap-motion-ready");
    revealTargets.forEach((target) => {
      gsap.set(target, { clearProps: "opacity,visibility,transform,will-change" });
    });
    animatedDetails.forEach((element) => {
      gsap.set(element, { clearProps: "opacity,visibility,transform,clip-path" });
    });
  }
}

if (window.portfolioContentReady) {
  window.portfolioContentReady.finally(initializePortfolioMotion);
} else {
  initializePortfolioMotion();
}
