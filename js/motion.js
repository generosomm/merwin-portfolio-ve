"use strict";

/*
  Central motion configuration. Visible content stays in data/*.json and this
  layer only enhances elements already rendered by the portfolio.
*/
const MOTION_CONFIG = Object.freeze({
  heroDuration: 0.36,
  heroStagger: 0.045,
  revealDuration: 0.42,
  revealDistance: 22,
  hideDuration: 0.18,
  detailDuration: 0.32,
  detailStagger: 0.035,
  hoverDuration: 0.16,
  counterDuration: 0.72,
  dialogDuration: 0.22
});

const REVEAL_MOTION_PROFILES = Object.freeze([
  { selector: ".section-heading, .credentials-heading", state: ({ base }) => ({ ...base, x: -24, y: 0 }) },
  { selector: ".subsection-title", state: ({ base }) => ({ ...base, x: -20, y: 0 }) },
  { selector: ".role-spotlight", state: ({ base, vertical }) => ({ ...base, y: vertical * 18, scale: 0.975 }) },
  { selector: ".gallery-kicker", state: ({ base }) => ({ ...base, x: 18, y: 0 }) },
  { selector: ".selected-role-link", state: ({ base, alternate }) => ({ ...base, x: alternate * 14, y: 0, scale: 0.96 }) },
  { selector: ".case-study", state: ({ base, alternate, vertical }) => ({ ...base, y: vertical * 24, scale: 0.96, rotation: alternate * 0.7 }) },
  { selector: ".repo-list article", state: ({ base, alternate }) => ({ ...base, x: alternate * 28, y: 0, scale: 0.985 }) },
  { selector: ".operations-card", state: ({ base, alternate, vertical }) => ({ ...base, y: vertical * 22, scale: 0.98, rotation: alternate * 1.2 }) },
  { selector: ".proof-card", state: ({ base, vertical }) => ({ ...base, y: vertical * 8, scale: 0.92 }) },
  { selector: ".testimonial-card", state: ({ base, alternate }) => ({ ...base, x: alternate * 24, y: 0, scale: 0.98 }) },
  { selector: ".certificate-card", state: ({ base, alternate, vertical }) => ({ ...base, y: vertical * 20, scale: 0.97, rotation: alternate * 1.3 }) },
  { selector: ".proof-total", state: ({ base }) => ({ ...base, y: 10, scale: 0.95 }) },
  { selector: ".about-layout", state: ({ base, vertical }) => ({ ...base, y: vertical * 20, scale: 0.985 }) },
  { selector: ".credentials", state: ({ base, vertical }) => ({ ...base, y: vertical * 18, scale: 0.985 }) },
  { selector: ".contact-inner > .eyebrow", state: ({ base }) => ({ ...base, x: -18, y: 0 }) },
  { selector: ".contact-inner > h2", state: ({ base }) => ({ ...base, x: -24, y: 0 }) },
  { selector: ".contact-email", state: ({ base }) => ({ ...base, y: 12, scale: 0.96 }) },
  { selector: ".contact-meta", state: ({ base }) => ({ ...base, x: 20, y: 0 }) }
]);

const MOTION_TARGETS = Object.freeze({
  tiltCards: ".case-study, .repo-list article, .operations-card, .proof-card, .testimonial-card, .certificate-card",
  detailPanels: ".content-details",
  tactileIcons: ".tech-icon, .operations-tool, .contact-social-link, .video-social-link, .dialog-close",
  directionalControls: "[data-scroll-direction]",
  magneticControls: ".nav-cta, .hero-actions .ui-action, .contact-cv-link",
  headingHosts: ".section-heading, .subsection-title, .about-layout, .credentials, .contact-inner > h2"
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
  const detailAnimatedElements = new Set();

  function revealDelay(target) {
    const value = Number.parseFloat(target.style.getPropertyValue("--reveal-delay"));
    return Number.isFinite(value) ? value / 1000 : 0;
  }

  function revealStartState(target) {
    const itemIndex = Math.max(0, revealTargets.indexOf(target));
    const alternate = itemIndex % 2 === 0 ? -1 : 1;
    const vertical = target.classList.contains("reveal-from-top") ? -1 : 1;
    const base = { autoAlpha: 0, x: 0, y: vertical * MOTION_CONFIG.revealDistance, scale: 1, rotation: 0 };

    const profile = REVEAL_MOTION_PROFILES.find(({ selector }) => target.matches(selector));
    return profile ? profile.state({ base, alternate, vertical }) : base;
  }

  function animateRevealDetails(target) {
    if (lightweightMode || detailedReveals.has(target)) return;

    let details = [];
    if (target.matches(".section-heading, .role-spotlight, .about-layout, .credentials")) {
      details = Array.from(target.children);
    } else if (target.matches(".case-study")) {
      const copy = target.querySelector(".case-copy");
      details = copy ? Array.from(copy.children) : [];
    } else if (target.matches(".repo-list article, .operations-card")) {
      details = Array.from(target.children);
    }

    detailedReveals.add(target);
    if (details.length >= 2) {
      details.forEach((element) => detailAnimatedElements.add(element));
      const isHeading = target.matches(".section-heading, .credentials-heading");
      gsap.fromTo(
        details,
        { autoAlpha: 0.35, x: isHeading ? -14 : 0, y: isHeading ? 0 : 10 },
        {
          autoAlpha: 1,
          x: 0,
          y: 0,
          duration: MOTION_CONFIG.detailDuration,
          stagger: MOTION_CONFIG.detailStagger,
          ease: "power2.out",
          overwrite: "auto",
          clearProps: "opacity,visibility,transform"
        }
      );
    }

    if (target.matches(".case-study, .proof-card, .certificate-card")) {
      const media = target.querySelector("img, video");
      if (media) {
        detailAnimatedElements.add(media);
        gsap.fromTo(
          media,
          { scale: 1.06, clipPath: "inset(0 0 12% 0)" },
          {
            scale: 1,
            clipPath: "inset(0 0 0% 0)",
            duration: 0.46,
            ease: "power2.out",
            overwrite: "auto",
            clearProps: "transform,clip-path"
          }
        );
      }
    }

    if (target.matches(MOTION_TARGETS.headingHosts)) {
      const heading = target.matches("h2, h3") ? target : target.querySelector("h2, h3");
      if (heading) {
        detailAnimatedElements.add(heading);
        gsap.fromTo(
          heading,
          { y: 10, clipPath: "inset(0 0 22% 0)" },
          {
            y: 0,
            clipPath: "inset(0 0 0% 0)",
            duration: 0.38,
            ease: "power3.out",
            overwrite: "auto",
            clearProps: "transform,clip-path"
          }
        );
      }
    }
  }

  function showReveal(target, initial = false) {
    const settings = {
      autoAlpha: 1,
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      duration: MOTION_CONFIG.revealDuration,
      delay: initial ? revealDelay(target) : 0,
      ease: "power2.out",
      overwrite: "auto",
      onStart: () => target.style.setProperty("will-change", "opacity, transform"),
      onComplete: () => {
        target.style.setProperty("will-change", "auto");
        if (target.classList.contains("is-visible")) {
          gsap.set(target, { clearProps: "opacity,visibility,transform" });
        }
      }
    };

    if (initial) {
      gsap.fromTo(target, revealStartState(target), settings);
    } else {
      gsap.to(target, settings);
    }

    animateRevealDetails(target);
  }

  function hideReveal(target) {
    gsap.to(target, {
      ...revealStartState(target),
      duration: MOTION_CONFIG.hideDuration,
      ease: "power1.out",
      overwrite: "auto",
      onStart: () => target.style.setProperty("will-change", "opacity, transform"),
      onComplete: () => target.style.setProperty("will-change", "auto")
    });
  }

  function animateHero() {
    const shouldAnimate =
      (!window.location.hash || window.location.hash === "#top") &&
      performance.now() < 3500 &&
      window.scrollY < 80;

    if (!shouldAnimate) return false;

    const visibleNavItems = gsap.utils
      .toArray(".site-nav > a, .site-nav > .nav-dropdown")
      .filter((element) => {
        const styles = window.getComputedStyle(element);
        return element.offsetParent !== null && styles.display !== "none" && styles.visibility !== "hidden";
      });
    const groups = [
      { elements: gsap.utils.toArray(".site-header .brand, .site-header .menu-button"), from: { y: -10 } },
      { elements: visibleNavItems, from: { y: -10 } },
      { elements: gsap.utils.toArray(".availability, .hero-copy > .eyebrow"), from: { x: -18 } },
      { elements: gsap.utils.toArray(".hero h1"), from: { y: 18, scale: 0.985 } },
      { elements: gsap.utils.toArray(".hero h1 em"), from: { x: -10, scale: 0.97 } },
      { elements: gsap.utils.toArray(".hero-intro, .hero-actions, .hero-services"), from: { y: 14 } },
      { elements: gsap.utils.toArray(".hero-receipt"), from: { x: 30, y: 8, scale: 0.97 } },
      { elements: gsap.utils.toArray(".hero-receipt > *"), from: { x: 10, y: 4 } }
    ].filter((group) => group.elements.length);

    if (!groups.length) return false;

    const animatedElements = groups.flatMap((group) => group.elements);
    const timeline = gsap.timeline({
      delay: 0,
      defaults: {
        duration: lightweightMode ? 0.24 : MOTION_CONFIG.heroDuration,
        ease: "power3.out"
      },
      onComplete: () => {
        gsap.set(animatedElements, { clearProps: "opacity,visibility,transform,will-change" });
      }
    });

    groups.forEach(({ elements, from }, index) => {
      timeline.fromTo(
        elements,
        {
          autoAlpha: 0,
          x: lightweightMode ? 0 : from.x || 0,
          y: lightweightMode ? 8 : from.y || 0,
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
        index ? (lightweightMode ? "-=0.18" : "-=0.28") : 0
      );
    });

    return true;
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
      .filter((counter) => counter.parts);
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
            const frame = Math.round(state.progress * 30);
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
          onComplete: () => {
            counters.forEach(({ target, parts }) => {
              target.textContent = parts.original;
            });
            gsap.fromTo(
              counters.map(({ target }) => target),
              { scale: 0.96 },
              { scale: 1, duration: 0.18, stagger: 0.025, ease: "back.out(1.7)", clearProps: "transform" }
            );
          }
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
          if (!dialog?.open) return;
          const media = dialog.querySelector("video, img");
          if (!media) return;

          gsap.fromTo(
            media,
            { autoAlpha: 0, y: 10, scale: 0.985 },
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

  function animateMicroInteractions() {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (lightweightMode || !finePointer) return;

    function bindHorizontalNudge(control, icon) {
      if (!icon) return;

      control.addEventListener("pointerenter", () => {
        gsap.to(icon, {
          x: 3,
          duration: MOTION_CONFIG.hoverDuration,
          ease: "power2.out",
          overwrite: "auto"
        });
      });

      control.addEventListener("pointerleave", () => {
        gsap.to(icon, {
          x: 0,
          duration: MOTION_CONFIG.hoverDuration,
          ease: "power2.out",
          overwrite: "auto",
          clearProps: "transform"
        });
      });
    }

    gsap.utils.toArray(".ui-action").forEach((control) => {
      bindHorizontalNudge(control, control.querySelector('[aria-hidden="true"]'));
    });
    gsap.utils.toArray(".video-trigger").forEach((control) => {
      bindHorizontalNudge(control, control.querySelector(".play-pill i"));
    });
    gsap.utils.toArray(".contact-email").forEach((control) => {
      bindHorizontalNudge(control, control.querySelector("i"));
    });
  }

  function animateCardDepth() {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (lightweightMode || !finePointer) return;

    gsap.utils.toArray(MOTION_TARGETS.tiltCards).forEach((card) => {
      const rotateX = gsap.quickTo(card, "rotationX", { duration: 0.18, ease: "power2.out" });
      const rotateY = gsap.quickTo(card, "rotationY", { duration: 0.18, ease: "power2.out" });

      card.addEventListener("pointerenter", () => {
        gsap.set(card, { transformPerspective: 800, transformOrigin: "center" });
      });
      card.addEventListener("pointermove", (event) => {
        const bounds = card.getBoundingClientRect();
        const horizontal = (event.clientX - bounds.left) / bounds.width - 0.5;
        const vertical = (event.clientY - bounds.top) / bounds.height - 0.5;
        rotateX(vertical * -4.5);
        rotateY(horizontal * 4.5);
      });
      card.addEventListener("pointerleave", () => {
        gsap.to(card, {
          rotationX: 0,
          rotationY: 0,
          duration: 0.2,
          ease: "power2.out",
          overwrite: "auto",
          clearProps: "transform,transform-origin"
        });
      });
    });
  }

  function animateExpandableDetails() {
    if (lightweightMode) return;

    gsap.utils.toArray(MOTION_TARGETS.detailPanels).forEach((details) => {
      details.addEventListener("toggle", () => {
        if (!details.open) return;
        const panel = details.querySelector(".content-details-panel");
        if (!panel) return;
        const children = panel.children.length ? Array.from(panel.children) : [panel];

        gsap.fromTo(
          children,
          { autoAlpha: 0, y: 8 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.24,
            stagger: 0.025,
            ease: "power2.out",
            clearProps: "opacity,visibility,transform"
          }
        );
      });
    });
  }

  function animateTactileControls() {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (lightweightMode || !finePointer) return;

    gsap.utils.toArray(MOTION_TARGETS.tactileIcons).forEach((icon, index) => {
      icon.addEventListener("pointerenter", () => {
        gsap.to(icon, {
          y: -3,
          scale: 1.08,
          rotation: index % 2 ? 3 : -3,
          duration: 0.16,
          ease: "power2.out",
          overwrite: "auto"
        });
      });
      icon.addEventListener("pointerleave", () => {
        gsap.to(icon, {
          y: 0,
          scale: 1,
          rotation: 0,
          duration: 0.16,
          ease: "power2.out",
          overwrite: "auto",
          clearProps: "transform"
        });
      });
    });

    gsap.utils.toArray(MOTION_TARGETS.directionalControls).forEach((control) => {
      control.addEventListener("click", () => {
        const direction = Number(control.dataset.scrollDirection) || 1;
        gsap.fromTo(
          control,
          { x: 0 },
          { x: direction * 4, duration: 0.08, repeat: 1, yoyo: true, ease: "power1.inOut", clearProps: "transform" }
        );
      });
    });
  }

  function animateFooterEntrance() {
    if (lightweightMode) return;
    const footer = document.querySelector(".site-footer");
    const children = footer ? Array.from(footer.children) : [];
    if (!children.length) return;

    ScrollTrigger.create({
      trigger: footer,
      start: "top 96%",
      once: true,
      onEnter: () => {
        gsap.fromTo(
          children,
          { autoAlpha: 0, y: 12 },
          { autoAlpha: 1, y: 0, duration: 0.32, stagger: 0.04, ease: "power2.out", clearProps: "opacity,visibility,transform" }
        );
      }
    });
  }

  function animateActiveNavigation() {
    if (lightweightMode) return;
    const links = gsap.utils.toArray(".site-nav a");

    links.forEach((link) => {
      const observer = new MutationObserver(() => {
        if (!link.classList.contains("is-active")) return;
        gsap.fromTo(
          link,
          { y: -3, scale: 0.97 },
          { y: 0, scale: 1, duration: 0.22, ease: "back.out(1.8)", overwrite: "auto", clearProps: "transform" }
        );
      });
      observer.observe(link, { attributes: true, attributeFilter: ["class"] });
    });
  }

  function animateGallerySelection() {
    if (lightweightMode) return;

    gsap.utils.toArray(".horizontal-track").forEach((track) => {
      const observer = new MutationObserver(() => {
        const index = Number.parseInt(track.dataset.activeIndex, 10);
        const item = Number.isFinite(index) ? track.children[index] : null;
        if (!item) return;
        const accent = item.querySelector("img, h3, h4, strong") || item;

        gsap.fromTo(
          accent,
          { scale: 0.975, y: 3 },
          { scale: 1, y: 0, duration: 0.24, ease: "back.out(1.6)", overwrite: "auto", clearProps: "transform" }
        );
      });
      observer.observe(track, { attributes: true, attributeFilter: ["data-active-index"] });
    });
  }

  function animateMagneticControls() {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (lightweightMode || !finePointer) return;

    gsap.utils.toArray(MOTION_TARGETS.magneticControls).forEach((control) => {
      const moveX = gsap.quickTo(control, "x", { duration: 0.18, ease: "power2.out" });
      const moveY = gsap.quickTo(control, "y", { duration: 0.18, ease: "power2.out" });

      control.addEventListener("pointermove", (event) => {
        const bounds = control.getBoundingClientRect();
        moveX(((event.clientX - bounds.left) / bounds.width - 0.5) * 6);
        moveY(((event.clientY - bounds.top) / bounds.height - 0.5) * 4);
      });
      control.addEventListener("pointerleave", () => {
        gsap.to(control, {
          x: 0,
          y: 0,
          duration: 0.18,
          ease: "power2.out",
          overwrite: "auto",
          clearProps: "transform"
        });
      });
    });
  }

  try {
    gsap.registerPlugin(ScrollTrigger);
    animateHero();

    if (!lightweightMode && revealTargets.length) {
      document.documentElement.classList.add("gsap-motion-ready");
      const revealObserver = new MutationObserver((records) => {
        const changedTargets = new Set(records.map((record) => record.target));
        changedTargets.forEach((target) => {
          if (target.classList.contains("is-visible")) showReveal(target);
          else hideReveal(target);
        });
      });

      revealTargets.forEach((target) => {
        revealObserver.observe(target, { attributes: true, attributeFilter: ["class"] });
        if (target.classList.contains("is-visible")) showReveal(target, true);
        else gsap.set(target, revealStartState(target));
      });
    }

    animateProofCounters();
    animateDialogs();
    animateMicroInteractions();
    animateCardDepth();
    animateExpandableDetails();
    animateTactileControls();
    animateFooterEntrance();
    animateActiveNavigation();
    animateGallerySelection();
    animateMagneticControls();
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
    detailAnimatedElements.forEach((element) => {
      gsap.set(element, { clearProps: "opacity,visibility,transform" });
    });
  }
}

if (window.portfolioContentReady) {
  window.portfolioContentReady.finally(initializePortfolioMotion);
} else {
  initializePortfolioMotion();
}
