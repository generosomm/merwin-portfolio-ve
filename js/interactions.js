"use strict";

/* =============================================================
   INTERACTIONS — pointer and click behaviour that must work with or
   without the GSAP motion layer: the 3D project preview card, edit
   video previews, the analytics
   carousel and lightbox, certificate tilt, stack logo magnet, the
   GitHub graph and the local clock. Hover-only touches are skipped
   on touch screens, which get plain links and inline images.
   ============================================================= */

(function initInteractions() {
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  /* Touch screens: the edits strip doesn't drift on its own. Moving it
     means a scroll-position write every frame, which costs phones a
     steady share of every frame; swiping and the arrows still work. */
  const touchFirst = window.matchMedia("(hover: none), (pointer: coarse)");
  /* Lite mode for weak devices (index.html, js/site.js). */
  const lite = () => document.documentElement.classList.contains("perf-lite");

  /* Pointer-driven tilts: high-rate mice send several moves per frame,
     and each one would measure and restyle. Handle the latest move
     once per frame instead. */
  function onPointerFrame(element, handler) {
    let frame = 0;
    let latest = null;
    element.addEventListener("pointermove", (event) => {
      latest = event;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        handler(latest);
      });
    }, { passive: true });
    element.addEventListener("pointerleave", () => {
      cancelAnimationFrame(frame);
      frame = 0;
    });
  }

  /* ---- Selected work: 3D preview card ---------------------------------
     One card for the whole list. Hovering (or tabbing to) a row swings
     it in level with that row; moving within the row tilts it toward
     the cursor; moving to another row flips it to the next screenshot.
     Rows without a screenshot simply put the card away. Under reduced
     motion it only fades and swaps.
  ---------------------------------------------------------------- */

  function initWorkPreview() {
    const desktop = window.matchMedia("(min-width: 900px) and (hover: hover) and (pointer: fine)");
    const list = document.querySelector(".work-list");
    const preview = document.querySelector(".work-preview");
    const image = preview?.querySelector("img");
    if (!list || !preview || !image) return;

    let current = null;
    let shown = "";
    let flipTimer = 0;
    let preloaded = false;

    function place(row, { instant = false } = {}) {
      const y = row.offsetTop + row.offsetHeight / 2 - preview.offsetHeight / 2;
      if (instant) preview.style.transition = "none";
      preview.style.setProperty("--y", `${Math.round(y)}px`);
      if (instant) {
        void preview.offsetWidth; /* commit the jump before re-enabling the glide */
        preview.style.transition = "";
      }
    }

    function hide() {
      window.clearTimeout(flipTimer);
      preview.classList.remove("is-visible", "is-flipping");
      preview.style.setProperty("--rx", "0deg");
      preview.style.setProperty("--ry", "0deg");
      current = null;
    }

    function show(row) {
      if (!desktop.matches) return;
      const source = row?.dataset.preview;
      if (!source) {
        hide();
        current = row;
        return;
      }

      const visible = preview.classList.contains("is-visible");
      place(row, { instant: !visible });
      current = row;

      if (!visible) {
        image.src = source;
        shown = source;
        preview.classList.add("is-visible");
        return;
      }
      if (source === shown) return;

      if (reduceMotion.matches) {
        image.src = source;
        shown = source;
        return;
      }
      /* Turn edge-on, swap while invisible, turn back. */
      window.clearTimeout(flipTimer);
      preview.classList.add("is-flipping");
      flipTimer = window.setTimeout(() => {
        image.src = source;
        shown = source;
        preview.classList.remove("is-flipping");
      }, 160);
    }

    list.addEventListener("pointerenter", () => {
      if (preloaded) return;
      preloaded = true;
      list.querySelectorAll(".work-row[data-preview]").forEach((row) => {
        const probe = new Image();
        probe.src = row.dataset.preview;
      });
    });

    list.addEventListener("pointerover", (event) => {
      const row = event.target.closest(".work-row");
      if (row && row !== current) show(row);
    });

    onPointerFrame(list, (event) => {
      if (!current || reduceMotion.matches || !preview.classList.contains("is-visible")) return;
      const box = current.getBoundingClientRect();
      const dx = Math.max(-1, Math.min(1, (event.clientX - (box.left + box.width / 2)) / (box.width / 2)));
      const dy = Math.max(-1, Math.min(1, (event.clientY - (box.top + box.height / 2)) / (box.height / 2)));
      preview.style.setProperty("--ry", `${(dx * 12).toFixed(2)}deg`);
      preview.style.setProperty("--rx", `${(-dy * 10).toFixed(2)}deg`);
    });

    list.addEventListener("pointerleave", hide);

    /* Keyboard: tabbing through the project links shows the card too. */
    list.addEventListener("focusin", (event) => {
      const row = event.target.closest(".work-row");
      if (row) show(row);
    });
    list.addEventListener("focusout", (event) => {
      if (!list.contains(event.relatedTarget)) hide();
    });

    window.addEventListener("resize", () => {
      if (!desktop.matches) { hide(); return; }
      if (current && preview.classList.contains("is-visible")) place(current, { instant: true });
    }, { passive: true });
  }

  /* Local clips load on the first desktop hover. */
  function initEditPreviews() {
    if (!finePointer.matches || reduceMotion.matches) return;
    document.querySelectorAll(".edit-card").forEach((card) => {
      const media = card.querySelector(".edit-media[data-video]");
      if (!media) return;
      let video = null;
      card.addEventListener("pointerenter", () => {
        /* Lite mode keeps the still: decoding a clip per hover is what
           weak machines and slow connections can least afford. */
        if (!video && lite()) return;
        if (!video) {
          video = document.createElement("video");
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          video.preload = "auto";
          video.setAttribute("aria-hidden", "true");
          video.src = media.dataset.video;
          video.addEventListener("playing", () => media.classList.add("is-playing"));
          media.appendChild(video);
        }
        video.play().catch(() => {});
      });
      card.addEventListener("pointerleave", () => {
        if (!video) return;
        video.pause();
        media.classList.remove("is-playing");
      });
    });
  }

  /* ---- Lightbox ----------------------------------------------------
     A native <dialog>: focus is trapped and Esc closes it for free,
     and focus returns to the button that opened it. Smooth scroll is
     paused underneath so the page does not drift while it is open.
  ---------------------------------------------------------------- */

  function initLightbox() {
    const dialog = document.querySelector(".lightbox");
    const image = dialog?.querySelector("img");
    const video = dialog?.querySelector("video");
    const caption = dialog?.querySelector(".lightbox-caption");
    if (!dialog || !image || typeof dialog.showModal !== "function") return;

    /* Images (proof) and videos (AI hooks) share one dialog. */
    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-lightbox], [data-lightbox-video]");
      if (!trigger) return;

      const clip = trigger.dataset.lightboxVideo;
      event.preventDefault();
      if (clip && video) {
        image.hidden = true;
        video.hidden = false;
        video.poster = trigger.dataset.lightboxPoster || "";
        video.src = clip;
        video.setAttribute("aria-label", trigger.dataset.lightboxAlt || "");
        video.play().catch(() => {});
      } else {
        if (video) video.hidden = true;
        image.hidden = false;
        image.src = trigger.dataset.lightbox;
        image.alt = trigger.dataset.lightboxAlt || "";
      }
      if (caption) {
        caption.textContent = trigger.dataset.lightboxCaption || "";
        caption.hidden = !caption.textContent;
        dialog.classList.toggle("has-caption", !caption.hidden);
      }
      dialog.showModal();
      document.documentElement.classList.add("dialog-open");
      window.portfolio?.lenis?.stop();
    });

    dialog.querySelector(".lightbox-close")?.addEventListener("click", () => dialog.close());
    /* A click that lands on the dialog itself is a click on the dim
       backdrop around the image. */
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => {
      document.documentElement.classList.remove("dialog-open");
      /* Stop the clip and its download, not just its sound. */
      if (video && !video.hidden) {
        video.pause();
        video.removeAttribute("src");
        video.removeAttribute("poster");
        video.load();
      }
      window.portfolio?.lenis?.start();
    });
  }

  /* ---- Edits / AI Hooks tabs -----------------------------------------
     Standard tab pattern: one tab in the tab order, arrow keys move
     between tabs, the panel follows the selected tab.
  ---------------------------------------------------------------- */

  function initEditTabs() {
    const tabs = Array.from(document.querySelectorAll(".edits-tab"));
    if (tabs.length < 2) return;

    function select(tab, { focus = false } = {}) {
      tabs.forEach((other) => {
        const selected = other === tab;
        other.setAttribute("aria-selected", String(selected));
        other.tabIndex = selected ? 0 : -1;
        const panel = document.getElementById(other.getAttribute("aria-controls"));
        if (panel) panel.hidden = !selected;
      });
      if (focus) tab.focus();
      const panel = document.getElementById(tab.getAttribute("aria-controls"));
      panel?.dispatchEvent(new Event("edits:show"));
      window.ScrollTrigger?.refresh();
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => select(tab));
      tab.addEventListener("keydown", (event) => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        select(tabs[(index + step + tabs.length) % tabs.length], { focus: true });
      });
    });
  }

  /* ---- Edits: continuous loop and native swipe ----------------------- */
  function initEditCarousels() {
    document.querySelectorAll(".edits-panel").forEach((panel) => {
      const grid = panel.querySelector(".edits-grid");
      const originals = [...(grid?.children || [])];
      if (!grid || originals.length < 2) return;
      const cloneSet = () => originals.map((card) => {
        const clone = card.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        clone.dataset.loopClone = "";
        clone.querySelectorAll("a, button").forEach((el) => el.tabIndex = -1);
        return clone;
      });
      grid.prepend(...cloneSet());
      grid.append(...cloneSet());
      let start = 0, cycle = 0, position = 0, frame = 0, last = 0;
      let inView = false, hovered = false, touching = false;
      let drag = null, suppressClickUntil = 0;
      let busyUntil = 0, resumeTimer = 0;
      const focused = () => panel.contains(document.activeElement);
      const canPlay = () => inView && !panel.hidden && !document.hidden && !reduceMotion.matches && !touchFirst.matches && !lite() &&
        !hovered && !touching && !focused() && !document.querySelector("dialog[open]") && performance.now() >= busyUntil;

      function stop() {
        cancelAnimationFrame(frame); frame = 0; last = 0;
      }
      function normalize() {
        if (!cycle) return;
        const x = grid.scrollLeft;
        if (x < start || x >= start + cycle) {
          grid.scrollLeft = start + ((x - start) % cycle + cycle) % cycle;
        }
        position = grid.scrollLeft;
      }
      function tick(now) {
        frame = 0;
        if (!canPlay() || !cycle) { last = 0; return; }
        if (!last) position = grid.scrollLeft;
        const delta = last ? Math.min(now - last, 50) : 0;
        last = now;
        position += delta * 0.024;
        if (position >= start + cycle) position -= cycle;
        if (position < start) position += cycle;
        grid.scrollLeft = position;
        frame = requestAnimationFrame(tick);
      }
      function sync() {
        stop();
        if (canPlay()) { normalize(); frame = requestAnimationFrame(tick); }
      }
      function measure() {
        if (!grid.clientWidth) return;
        const first = originals[0].offsetLeft;
        const inset = window.matchMedia("(max-width: 767px)").matches ? (grid.clientWidth - originals[0].offsetWidth) / 2 : 0;
        start = first - inset;
        cycle = grid.querySelectorAll("[data-loop-clone]")[originals.length].offsetLeft - first;
        grid.scrollLeft = start; position = start;
        sync();
      }
      function hold(delay = 1800) {
        stop(); busyUntil = performance.now() + delay;
        clearTimeout(resumeTimer); resumeTimer = setTimeout(sync, delay + 20);
      }
      /* Pause while the page itself is scrolling, so the loop never
         competes with the user's scroll for frames. */
      window.addEventListener("scroll", () => { if (inView) hold(250); }, { passive: true });
      panel.querySelectorAll("[data-edits-step]").forEach((button) => {
        button.addEventListener("click", (event) => {
          hold();
          normalize();
          const step = originals[1].offsetLeft - originals[0].offsetLeft;
          if (event.detail) button.blur();
          grid.scrollBy({
            left: Number(button.dataset.editsStep) * step,
            behavior: reduceMotion.matches ? "instant" : "smooth"
          });
        });
      });
      panel.addEventListener("pointerenter", (event) => {
        if (event.pointerType !== "touch") { hovered = true; sync(); }
      });
      panel.addEventListener("pointerleave", () => { hovered = false; sync(); });
      panel.addEventListener("focusin", stop);
      panel.addEventListener("focusout", () => requestAnimationFrame(sync));
      grid.addEventListener("pointerdown", (event) => {
        if (!event.isPrimary || event.button !== 0) return;
        touching = true;
        stop();
        if (event.pointerType === "mouse") {
          drag = { id: event.pointerId, startX: event.clientX, lastX: event.clientX, moved: false };
        }
      }, { passive: true });
      window.addEventListener("pointermove", (event) => {
        if (!drag || event.pointerId !== drag.id) return;
        if (!drag.moved) {
          if (Math.abs(event.clientX - drag.startX) < 8) return;
          drag.moved = true;
          grid.setPointerCapture(event.pointerId);
          grid.classList.add("is-dragging");
        }
        event.preventDefault();
        grid.scrollLeft -= event.clientX - drag.lastX;
        drag.lastX = event.clientX;
        normalize();
      }, { passive: false });
      function finishDrag(event) {
        if (drag && event?.pointerId !== undefined && event.pointerId !== drag.id) return;
        const finished = drag;
        drag = null;
        grid.classList.remove("is-dragging");
        if (finished?.moved) {
          suppressClickUntil = performance.now() + 350;
          if (grid.contains(document.activeElement)) document.activeElement.blur();
        }
        if (finished && grid.hasPointerCapture(finished.id)) grid.releasePointerCapture(finished.id);
        if (touching) { touching = false; hold(); }
      }
      window.addEventListener("pointerup", finishDrag, { passive: true });
      grid.addEventListener("pointercancel", finishDrag, { passive: true });
      grid.addEventListener("lostpointercapture", finishDrag, { passive: true });
      window.addEventListener("blur", () => finishDrag());
      grid.addEventListener("dragstart", (event) => event.preventDefault());
      grid.addEventListener("click", (event) => {
        if (event.detail && (drag?.moved || performance.now() < suppressClickUntil)) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }, true);
      grid.addEventListener("wheel", () => hold(), { passive: true });
      grid.addEventListener("scrollend", () => { if (!frame && !focused() && !touching) normalize(); });
      panel.addEventListener("edits:show", measure);
      new ResizeObserver(measure).observe(grid);
      new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }).observe(grid);
      document.addEventListener("visibilitychange", sync);
      document.querySelector(".lightbox")?.addEventListener("close", sync);
      reduceMotion.addEventListener("change", sync);
      window.addEventListener("portfolio:lite", sync);
      measure();
    });
  }

  /* ---- Analytics carousel ---------------------------------------------
     Turns the plain row into a 3D coverflow. Moves by arrows, drag or
     swipe, horizontal trackpad scroll, the keyboard's arrow keys, or
     a click on a side card. A click on the middle card falls through
     to the lightbox. Only CSS custom properties are set here; the 3D
     itself lives in css/closing.css.
  ---------------------------------------------------------------- */

  function initProofCarousel() {
    document.querySelectorAll(".proof-carousel").forEach(setupCarousel);
  }

  /* One carousel. A data-carousel-media query (the certificates use
     one) limits the 3D mode to matching screens; outside it, the
     markup falls back to its plain CSS layout and every handler below
     stands down. */
  function setupCarousel(carousel) {
    const track = carousel.querySelector(".proof-track");
    const slides = Array.from(carousel.querySelectorAll(".proof-slide"));
    const current = carousel.querySelector(".proof-current");
    const arrows = Array.from(carousel.querySelectorAll(".proof-arrow"));
    if (!track || slides.length < 2) return;

    const media = carousel.dataset.carouselMedia ? window.matchMedia(carousel.dataset.carouselMedia) : null;
    let enabled = false;
    let active = 0;
    let dragged = false;
    let lastWheel = 0;
    const last = slides.length - 1;
    const clamp = (value) => Math.min(Math.max(value, 0), last);

    carousel.querySelectorAll("img").forEach((image) => {
      image.draggable = false;
    });

    /* Slides are absolutely placed in 3D, so the track needs an
       explicit height: the tallest slide's. */
    function measure() {
      if (!enabled) return;
      const tallest = Math.max(...slides.map((slide) => slide.offsetHeight));
      if (tallest) track.style.setProperty("--track-h", `${tallest}px`);
    }

    function layout() {
      slides.forEach((slide, index) => {
        const offset = Math.max(-3, Math.min(3, index - active));
        slide.style.setProperty("--offset", String(offset));
        slide.style.setProperty("--abs", String(Math.abs(offset)));
        slide.classList.toggle("is-active", index === active);
        slide.classList.toggle("is-far", Math.abs(index - active) > 2);
      });
      if (current) current.textContent = String(active + 1).padStart(2, "0");
      arrows.forEach((arrow) => {
        const step = Number(arrow.dataset.step);
        arrow.disabled = (step < 0 && active === 0) || (step > 0 && active === last);
      });
    }

    function enable() {
      enabled = true;
      carousel.classList.add("is-3d");
      layout();
      measure();
    }

    /* Back to the plain layout: every trace of the 3D state removed. */
    function disable() {
      enabled = false;
      carousel.classList.remove("is-3d");
      track.style.removeProperty("--track-h");
      slides.forEach((slide) => {
        slide.style.removeProperty("--offset");
        slide.style.removeProperty("--abs");
        slide.classList.remove("is-active", "is-far");
      });
    }

    function go(index, { focus = false } = {}) {
      const next = clamp(index);
      if (next === active) return;
      active = next;
      layout();
      if (focus) slides[active].querySelector("button")?.focus({ preventScroll: true });
    }

    arrows.forEach((arrow) => {
      arrow.addEventListener("click", () => go(active + Number(arrow.dataset.step)));
    });

    /* Runs before the page-level lightbox listener (this element is
       closer to the target), so it can claim side-card clicks. */
    carousel.addEventListener("click", (event) => {
      if (!enabled) return;
      const slide = event.target.closest(".proof-slide");
      if (!slide) return;
      const index = Number(slide.dataset.index);
      if (dragged || index !== active) {
        event.preventDefault();
        event.stopPropagation();
        if (!dragged) go(index);
      }
    });

    /* Tabbing onto a side card brings it to the middle. Mouse clicks
       also focus the button, so only keyboard focus counts here. */
    carousel.addEventListener("focusin", (event) => {
      if (!enabled) return;
      const slide = event.target.closest(".proof-slide");
      if (slide && event.target.matches(":focus-visible")) go(Number(slide.dataset.index));
    });

    carousel.addEventListener("keydown", (event) => {
      if (!enabled || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
      event.preventDefault();
      go(active + (event.key === "ArrowLeft" ? -1 : 1), { focus: true });
    });

    /* Drag or swipe: a mostly-horizontal move of 40px steps once.
       touch-action: pan-y in the CSS keeps vertical page scrolling. */
    let start = null;
    track.addEventListener("pointerdown", (event) => {
      if (!enabled || !event.isPrimary) return;
      start = { x: event.clientX, y: event.clientY };
      dragged = false;
    });
    track.addEventListener("pointerup", (event) => {
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      start = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        dragged = true;
        go(active + (dx < 0 ? 1 : -1));
        /* Swallow the click that ends the drag, then reset. */
        window.setTimeout(() => {
          dragged = false;
        }, 0);
      }
    });
    track.addEventListener("pointercancel", () => {
      start = null;
    });

    /* Sideways trackpad scroll steps too; vertical scroll passes on. */
    track.addEventListener("wheel", (event) => {
      if (!enabled) return;
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 4) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastWheel < 450) return;
      lastWheel = now;
      go(active + (event.deltaX > 0 ? 1 : -1));
    }, { passive: false });

    if (!media || media.matches) enable();
    media?.addEventListener?.("change", (event) => (event.matches ? enable() : disable()));
    if ("ResizeObserver" in window) new ResizeObserver(measure).observe(slides[0]);
  }

  /* ---- Stack logos: magnet + glow -------------------------------------
     The glow follows the cursor across the tile; the icon leans up to
     6px toward it with a slight tilt. The pop itself is CSS. Under
     reduced motion only the glow moves.
  ---------------------------------------------------------------- */

  function initStackLogos() {
    if (!finePointer.matches) return;

    document.querySelectorAll(".stack-logo").forEach((tile) => {
      onPointerFrame(tile, (event) => {
        const box = tile.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width;
        const y = (event.clientY - box.top) / box.height;
        tile.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
        tile.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
        if (reduceMotion.matches) return;
        const dx = Math.max(-1, Math.min(1, x * 2 - 1));
        const dy = Math.max(-1, Math.min(1, y * 2 - 1));
        tile.style.setProperty("--tx", `${(dx * 6).toFixed(2)}px`);
        tile.style.setProperty("--ty", `${(dy * 6).toFixed(2)}px`);
        tile.style.setProperty("--tilt", `${(dx * 8).toFixed(2)}deg`);
      });

      tile.addEventListener("pointerleave", () => {
        ["--tx", "--ty", "--tilt", "--gx", "--gy"].forEach((name) => tile.style.removeProperty(name));
      });
    });
  }

  /* ---- Certificate tilt + sheen -------------------------------------
     Up to ~5 degrees toward the cursor, with the green highlight
     following it. Only the custom properties change; css/closing.css
     does the drawing. Flat under reduced motion.
  ---------------------------------------------------------------- */

  function initCertTilt() {
    if (!finePointer.matches) return;

    document.querySelectorAll(".cert-card").forEach((card) => {
      const media = card.querySelector(".cert-media");
      if (!media) return;

      onPointerFrame(card, (event) => {
        const box = media.getBoundingClientRect();
        const x = Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1);
        const y = Math.min(Math.max((event.clientY - box.top) / box.height, 0), 1);
        card.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
        card.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
        if (reduceMotion.matches) return;
        card.classList.add("is-tilting");
        card.style.setProperty("--ry", `${((x - 0.5) * 10).toFixed(2)}deg`);
        card.style.setProperty("--rx", `${((0.5 - y) * 10).toFixed(2)}deg`);
      });

      card.addEventListener("pointerleave", () => {
        card.classList.remove("is-tilting");
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      });
    });
  }

  /* ---- GitHub activity -----------------------------------------------
     Drawn from the saved snapshot (scripts/update-github-snapshot.mjs),
     loaded once the section is close to the screen. One dot per day
     for the entire saved year, with size and brightness following
     contribution level. Hovering or tapping reveals the day's count.
     The total and exact saved date range sit below the graph.
  ---------------------------------------------------------------- */

  function initGithubGraph() {
    const box = document.querySelector(".github[data-snapshot]");
    const card = box?.querySelector(".github-scroll");
    const chart = box?.querySelector(".gh-chart");
    const months = chart?.querySelector(".gh-months");
    const grid = chart?.querySelector(".gh-grid");
    const playhead = chart?.querySelector(".gh-playhead");
    const tip = chart?.querySelector(".gh-tip");
    const stats = box?.querySelector(".gh-stats");
    const source = box?.dataset.snapshot;
    if (!box || !card || !chart || !months || !grid || !source) return;

    let labels = {};
    try {
      labels = JSON.parse(box.dataset.labels || "{}");
    } catch {
      labels = {};
    }
    const fill = (template, values) =>
      String(template || "").replace(/\{(\w+)\}/g, (match, key) => (key in values ? values[key] : match));

    const locale = document.documentElement.lang || "en";
    const formatDay = new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
    const formatMonth = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
    const asDate = (day) => new Date(`${day}T00:00:00Z`);


    function countLabel(count) {
      const tooltip = labels.tooltip || {};
      if (!count) return tooltip.none || "0";
      return fill(count === 1 ? tooltip.one : tooltip.many, { count: count.toLocaleString(locale) });
    }

    /* One square per day, a column per week (Sunday on top), like
       GitHub's own graph. Month names sit above the week holding the
       1st. Days before the first shown day keep an invisible cell so
       the weeks line up. */
    function drawGrid(days) {
      const lead = asDate(days[0].date).getUTCDay();
      const weeks = Math.ceil((lead + days.length) / 7);
      const cells = document.createDocumentFragment();
      for (let i = 0; i < lead; i += 1) {
        const pad = document.createElement("span");
        pad.className = "gh-cell is-pad";
        cells.appendChild(pad);
      }
      const marks = [];
      days.forEach((day, index) => {
        const week = Math.floor((lead + index) / 7);
        const cell = document.createElement("span");
        cell.className = "gh-cell";
        cell.dataset.level = day.level;
        cell.style.setProperty("--i", week);
        cell.dataset.date = day.date;
        if (day.count !== null) cell.dataset.count = day.count;
        cells.appendChild(cell);
        if (index === 0 || day.date.endsWith("-01")) marks.push({ week, date: day.date });
      });
      grid.replaceChildren(cells);

      /* A month name needs about three weeks of room, so a name that
         would crowd the previous one is left out. */
      const names = document.createDocumentFragment();
      let last = -Infinity;
      marks.forEach(({ week, date }) => {
        if (week - last < 3) return;
        last = week;
        const name = document.createElement("span");
        name.style.gridColumnStart = week + 1;
        name.textContent = formatMonth.format(asDate(date));
        names.appendChild(name);
      });
      months.replaceChildren(names);
      chart.style.setProperty("--weeks", weeks);
    }

    /* Hover (or tap) a day: playhead down its week, tooltip above it. */
    function point(square) {
      if (!playhead || !tip) return;
      if (!square?.dataset.date) {
        chart.classList.remove("is-pointing");
        return;
      }
      const chartBox = chart.getBoundingClientRect();
      const box = square.getBoundingClientRect();
      const x = box.left - chartBox.left + box.width / 2;
      playhead.style.left = `${x}px`;
      /* Older snapshots have levels but no counts: an empty day is
         still known to be zero; any other day just shows its date. */
      const count = square.dataset.count !== undefined
        ? Number(square.dataset.count)
        : square.dataset.level === "0" ? 0 : null;
      tip.textContent = "";
      const strong = document.createElement("strong");
      strong.textContent = count !== null ? countLabel(count) : "";
      const when = document.createElement("span");
      when.textContent = formatDay.format(asDate(square.dataset.date));
      tip.append(strong, when);
      /* Keep the tooltip inside the chart at both ends. */
      const half = tip.offsetWidth / 2;
      tip.style.left = `${Math.min(Math.max(x, half), chart.clientWidth - half)}px`;
      tip.style.top = `${box.top - chartBox.top}px`;
      grid.querySelector(".is-pointed")?.classList.remove("is-pointed");
      square.classList.add("is-pointed");
      chart.classList.add("is-pointing");
    }

    function unpoint() {
      chart.classList.remove("is-pointing");
      grid.querySelector(".is-pointed")?.classList.remove("is-pointed");
    }

    grid.addEventListener("pointerover", (event) => point(event.target.closest(".gh-cell")));
    grid.addEventListener("pointerdown", (event) => point(event.target.closest(".gh-cell")));
    chart.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "mouse") unpoint();
    });
    /* A tap keeps the tooltip open (touch has no hover to end it), so a
       tap anywhere outside the graph, or Escape, closes it. */
    document.addEventListener("pointerdown", (event) => {
      if (chart.classList.contains("is-pointing") && !chart.contains(event.target)) unpoint();
    }, { passive: true });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && chart.classList.contains("is-pointing")) unpoint();
    });

    /* One truthful total paired with the complete saved period. */
    function drawStats(days, total) {
      if (!stats || !days.length || !Number.isFinite(total)) return;
      const date = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
      const label = fill(labels.stats?.total, { from: date.format(asDate(days[0].date)), to: date.format(asDate(days.at(-1).date)) });
      const item = document.createElement('div');
      item.className = 'gh-stat';
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = total.toLocaleString(locale);
      item.append(dt, dd);
      stats.replaceChildren(item);
    }

    async function draw() {
      try {
        const response = await fetch(source);
        if (!response.ok) return;
        const data = await response.json();
        const levels = String(data.levels || "");
        const counts = Array.isArray(data.counts) ? data.counts : [];
        const start = asDate(data.start);
        if (!levels.length || Number.isNaN(start.getTime())) return;

        const days = Array.from(levels, (level, index) => ({
          date: new Date(start.getTime() + index * 86400000).toISOString().slice(0, 10),
          level: /[0-4]/.test(level) ? Number(level) : 0,
          count: Number.isFinite(Number(counts[index])) && index < counts.length ? Number(counts[index]) : null
        }));
        card.hidden = false;
        drawGrid(days);
        drawStats(days, Number(data.total));

        /* The weeks fade in once, left to right (css/closing.css). */
        if (!reduceMotion.matches) {
          grid.classList.add("is-drawing");
          window.setTimeout(() => grid.classList.remove("is-drawing"), 2500);
        }
      } catch {
        /* Missing or malformed snapshot: the GitHub link still works. */
      }
    }

    if (!("IntersectionObserver" in window)) {
      draw();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      draw();
    }, { rootMargin: "0px 0px -15% 0px" });
    observer.observe(box);
  }

  /* ---- Project brief form ----------------------------------------------
     With an access key (data/11-contact.json), the brief is posted to
     Web3Forms and lands in the inbox. Without one, Gmail compose
     opens with the brief already written, so the form works from
     day one with no account. The browser's own validation messages
     cover empty or malformed fields.
  ---------------------------------------------------------------- */

  function initProjectForm() {
    const form = document.querySelector("#project-brief");
    const status = form?.querySelector(".brief-status");
    if (!form || !status) return;

    let messages = {};
    try {
      messages = JSON.parse(form.dataset.messages || "{}");
    } catch {
      messages = {};
    }

    const say = (key, state) => {
      status.textContent = messages[key] || "";
      status.dataset.state = state;
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      if (button.disabled) return;
      if (!form.reportValidity()) return;

      const fields = Object.fromEntries(new FormData(form).entries());
      const serviceLabel = form.querySelector('select[name="service"]')?.selectedOptions[0]?.textContent || fields.service;
      const subject = String(messages.subject || "").replace("{service}", serviceLabel);
      const lines = [
        [messages.name, fields.name],
        [messages.replyTo, fields.email],
        [messages.service, serviceLabel],
        [messages.deadline, fields.deadline],
        [messages.message, fields.message]
      ].filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`);

      const key = form.dataset.key;
      if (!key) {
        const address = form.dataset.address;
        const compose = new URL("https://mail.google.com/mail/");
        compose.search = new URLSearchParams({ view: "cm", fs: "1", to: address, su: subject, body: lines.join("\n\n") }).toString();
        const mobileEmail = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        const emailUrl = mobileEmail
          ? `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n\n"))}`
          : compose.href;
        if (mobileEmail) window.location.href = emailUrl;
        else window.open(emailUrl, "_blank", "noopener,noreferrer");
        say(mobileEmail ? "mobileOpened" : "gmailOpened", "info");
        const retry = document.createElement("a");
        retry.href = emailUrl;
        if (!mobileEmail) retry.target = "_blank";
        retry.rel = "noopener noreferrer";
        retry.textContent = (mobileEmail ? messages.mobileRetry : messages.gmailRetry) || "";
        status.append(" ", retry);
        return;
      }

      button.disabled = true;
      say("sending", "info");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(form.dataset.endpoint || "https://api.web3forms.com/submit", {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ access_key: key, subject, from_name: fields.name, email: fields.email, message: lines.join("\n\n") })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.success !== true) throw new Error("rejected");
        form.reset();
        say("sent", "ok");
      } catch {
        say("failed", "error");
      } finally {
        clearTimeout(timer);
        button.disabled = false;
      }
    });
  }

  function initStackFit() {
    const cards = Array.from(document.querySelectorAll(".practice-card"));
    if (!cards.length) return;

    function fit() {
      cards.forEach((card) => {
        card.style.removeProperty("top");
        card.removeAttribute("data-flat");
        const top = parseFloat(getComputedStyle(card).top);
          if (!Number.isFinite(top) || getComputedStyle(card).position !== "sticky") return;
        const height = card.offsetHeight;
        const room = window.innerHeight - 16;
          // Tall cards scroll into view completely before their bottom sticks.
          card.style.top = `${Math.min(top, room - height)}px`;
      });
      window.ScrollTrigger?.refresh();
    }

    fit();
    let timer = 0;
    window.addEventListener("resize", () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(fit, 150);
    }, { passive: true });
    if (document.fonts?.ready) document.fonts.ready.then(fit);
  }

  /* ---- Folds: forms tucked behind a 3D key --------------------------
     Markup from js/content.js (foldBlock). Closed on load; the key
     toggles. While closed the form is inert (can't be tabbed into or
     read out), and while it unfolds the sheet clips its content, then
     un-clips once settled so focus outlines aren't cut off. On a mouse,
     the key tilts a few degrees toward the pointer. */
  function initFolds() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    document.querySelectorAll("[data-fold]").forEach((fold) => {
      const key = fold.querySelector("[data-fold-toggle]");
      const panel = fold.querySelector("[data-fold-panel]");
      if (!key || !panel) return;

      const set = (open) => {
        key.setAttribute("aria-expanded", String(open));
        fold.classList.toggle("is-open", open);
        fold.classList.remove("is-settled");
        panel.inert = !open;
        /* No transition will run (reduced motion, or not animated yet): settle now. */
        if (open && (reduce || !fold.classList.contains("fold-ready"))) fold.classList.add("is-settled");
      };

      fold.classList.add("fold-enhanced");
      set(fold.dataset.defaultOpen === "true");
      /* Transitions only after the closed state has painted, so the
         page doesn't animate the forms shut on load. */
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => fold.classList.add("fold-ready")));

      panel.addEventListener("transitionend", (event) => {
        if (event.target !== panel || event.propertyName !== "grid-template-rows") return;
        if (fold.classList.contains("is-open")) fold.classList.add("is-settled");
        window.ScrollTrigger?.refresh(); // sections below moved
      });

      key.addEventListener("click", () => set(key.getAttribute("aria-expanded") !== "true"));
      fold.openFold = () => set(true);

      if (finePointer && !reduce) {
        onPointerFrame(key, (event) => {
          const box = key.getBoundingClientRect();
          const x = (event.clientX - box.left) / box.width - 0.5;
          const y = (event.clientY - box.top) / box.height - 0.5;
          key.style.setProperty("--tilt-x", `${(-y * 14).toFixed(2)}deg`);
          key.style.setProperty("--tilt-y", `${(x * 10).toFixed(2)}deg`);
        });
        key.addEventListener("pointerleave", () => {
          key.style.removeProperty("--tilt-x");
          key.style.removeProperty("--tilt-y");
        });
      }
    });
  }

  /* A service card's "Start a project" preselects that service in the
     form and unfolds it; the jump itself is the normal in-page link. */
  function initServiceLinks() {
    const select = document.querySelector('#project-brief select[name="service"]');
    if (!select) return;
    document.querySelectorAll(".service-cta[data-service]").forEach((link) => {
      link.addEventListener("click", () => {
        select.closest("[data-fold]")?.openFold?.();
        if ([...select.options].some((option) => option.value === link.dataset.service)) {
          select.value = link.dataset.service;
        }
      });
    });
  }

  /* ---- Local time beside the location --------------------------------- */

  function initLocalTime() {
    const clocks = Array.from(document.querySelectorAll(".contact-time[data-time-zone]"));
    if (!clocks.length) return;

    const tick = () => {
      clocks.forEach((clock) => {
        try {
          const time = new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: clock.dataset.timeZone
          }).format(new Date());
          clock.textContent = [time, clock.dataset.timeLabel].filter(Boolean).join(" ");
        } catch {
          clock.remove();
        }
      });
    };
    tick();
    window.setInterval(tick, 30000);
  }

  /* ---- Stack tooltips ------------------------------------------------
     One shared bubble shows an item's one-sentence description above
     it on mouse hover or keyboard focus, flipped below when there is no
     room and kept inside the viewport. Touch taps just open the link;
     screen readers hear the description through aria-describedby.
  ---------------------------------------------------------------- */

  function initStackTips() {
    /* The stack guide bot explains these items itself when it is on. */
    if (document.querySelector(".stack-guide")) return;
    const links = document.querySelectorAll(".stack-link[data-tip]");
    if (!links.length) return;
    const tip = document.createElement("div");
    tip.className = "stack-tooltip";
    tip.setAttribute("aria-hidden", "true");
    document.body.appendChild(tip);
    let current = null;

    const show = (link) => {
      current = link;
      tip.textContent = link.dataset.tip;
      const item = link.closest("li").getBoundingClientRect();
      const box = tip.getBoundingClientRect();
      const gap = 8;
      const left = Math.min(Math.max(gap, item.left + item.width / 2 - box.width / 2), window.innerWidth - box.width - gap);
      const top = item.top - box.height - gap >= gap ? item.top - box.height - gap : item.bottom + gap;
      tip.style.left = `${Math.round(left)}px`;
      tip.style.top = `${Math.round(top)}px`;
      tip.classList.add("is-visible");
    };
    const hide = () => {
      if (!current) return;
      current = null;
      tip.classList.remove("is-visible");
    };

    links.forEach((link) => {
      const item = link.closest("li");
      item.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") show(link); });
      item.addEventListener("pointerleave", hide);
      link.addEventListener("focus", () => { if (link.matches(":focus-visible")) show(link); });
      link.addEventListener("blur", hide);
    });
    /* Keyboard focus can scroll the page; the bubble follows a focused
       item and closes for a hovered one. */
    window.addEventListener("scroll", () => {
      if (current && current === document.activeElement) show(current);
      else hide();
    }, { passive: true });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") hide(); });
  }

  /* ---- Stack guide ---------------------------------------------------
     A small bot lives in the Stack section while it is on screen. It
     roams: perches on a random tool that is fully visible, says what it
     is and "click (or tap) to learn more", and every few stops rests
     quietly. When the visitor hovers or tabs to a tool, it flies
     straight there and explains that one instead; on leaving, it goes
     back to roaming. Paused while the section is off screen or the tab
     is hidden. It replaces the plain tooltip for these items.
  ---------------------------------------------------------------- */

  function initStackGuide() {
    const guide = document.querySelector(".stack-guide");
    const groups = document.querySelector(".stack-groups");
    const host = guide?.parentElement;
    if (!guide || !groups || !host || !("IntersectionObserver" in window)) return;

    const bubble = guide.querySelector(".stack-guide-bubble");
    const hint = () => (finePointer.matches ? guide.dataset.hint : guide.dataset.touchHint);
    const STEP = 3200;
    const REST_EVERY = 4;
    const REST = 7000;
    const ITEMS = ".stack-logos li, .stack-pills li";
    let timer = 0;
    let inView = false;
    let held = null;
    let current = null;
    let stops = 0;

    const later = (fn, ms) => { clearTimeout(timer); timer = setTimeout(fn, ms); };
    const active = () => inView && !document.hidden;

    const say = (link) => {
      bubble.replaceChildren(...[
        ["strong", link.textContent],
        ["span", link.dataset.tip],
        ["em", hint()]
      ].filter(([, words]) => words).map(([tag, words]) => {
        const node = document.createElement(tag);
        node.textContent = words;
        return node;
      }));
    };

    /* Perch on a tool's top-right corner; the bubble is centred on the
       perch but kept inside the section. The first perch jumps there. */
    const perch = (item) => {
      const first = !guide.classList.contains("is-on");
      const box = host.getBoundingClientRect();
      const tile = item.getBoundingClientRect();
      const x = tile.right - box.left - 8;
      const y = tile.top - box.top + 6;
      if (first) {
        guide.classList.add("is-jump");
        void guide.offsetWidth;
      }
      guide.style.setProperty("--x", `${Math.round(x)}px`);
      guide.style.setProperty("--y", `${Math.round(y)}px`);
      const width = bubble.offsetWidth;
      const left = Math.min(Math.max(0, x - width / 2), box.width - width);
      guide.style.setProperty("--bx", `${Math.round(left - x)}px`);
      if (first) {
        void guide.offsetWidth;
        guide.classList.remove("is-jump");
      }
    };

    const visit = (item) => {
      const link = item.querySelector(".stack-link[data-tip]");
      if (!link) return;
      say(link);
      perch(item);
      current?.classList.remove("is-guided");
      current = item;
      item.classList.add("is-guided");
      guide.classList.add("is-on", "is-talking");
    };

    const quiet = () => {
      current?.classList.remove("is-guided");
      current = null;
      guide.classList.remove("is-talking");
    };

    const hide = () => {
      clearTimeout(timer);
      quiet();
      guide.classList.remove("is-on");
    };

    /* A random tool fully on screen (below the floating nav), not the
       one the bot is on. */
    const pick = () => {
      const items = [...groups.querySelectorAll(ITEMS)].filter((item) => {
        const box = item.getBoundingClientRect();
        return item !== current && item.querySelector(".stack-link[data-tip]") &&
          box.height && box.top > 120 && box.bottom < window.innerHeight - 16;
      });
      return items[Math.floor(Math.random() * items.length)] || null;
    };

    const roam = () => {
      if (held || !active()) return;
      if (stops > 0 && stops % REST_EVERY === 0) {
        stops += 1;
        quiet();
        later(roam, REST);
        return;
      }
      const item = pick();
      if (!item) { later(roam, 1500); return; }
      stops += 1;
      visit(item);
      later(roam, STEP);
    };

    /* The visitor points at (or tabs to) a tool: the bot flies there
       quickly and stays until they leave, then roams again. */
    const hold = (item) => {
      if (!item.querySelector(".stack-link[data-tip]")) return;
      held = item;
      clearTimeout(timer);
      guide.classList.add("is-quick");
      visit(item);
    };

    const release = (item) => {
      if (held !== item) return;
      held = null;
      later(() => {
        guide.classList.remove("is-quick");
        quiet();
        stops = 0;
        roam();
      }, 450);
    };

    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (!inView) hide();
      else if (!guide.classList.contains("is-on") && !held) later(roam, 1200);
    }, { threshold: 0.35 }).observe(groups);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) hide();
      else if (inView && !held) later(roam, 800);
    });

    let scrolledAt = 0;
    window.addEventListener("scroll", () => { scrolledAt = performance.now(); }, { passive: true });

    groups.querySelectorAll(ITEMS).forEach((item) => {
      /* Ignored right after a scroll: wheel-scrolling under a still
         cursor also fires hover events, and the bot should not chase them. */
      item.addEventListener("pointermove", (event) => {
        if (event.pointerType === "mouse" && held !== item && performance.now() - scrolledAt > 200) hold(item);
      });
      item.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse") release(item); });
      item.addEventListener("focusin", (event) => { if (event.target.matches(":focus-visible")) hold(item); });
      item.addEventListener("focusout", () => release(item));
    });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && held) release(held); });
  }

  /* ---- Site guide ----------------------------------------------------
     The docked bot says one line the first time each section reaches
     the middle of the screen, for about six seconds, then goes quiet.
     Lines already said are remembered for this visit (sessionStorage);
     a section flown past in under ~0.7s is skipped until the visitor
     actually stops there. Tapping the bot repeats the current
     section's line. The close button hides it for good on this device.
  ---------------------------------------------------------------- */

  function initSiteGuide() {
    const guide = document.querySelector(".site-guide");
    if (!guide || !("IntersectionObserver" in window)) return;
    const HIDDEN = "siteGuideHidden";
    const SAID = "siteGuideSaid";
    try {
      if (localStorage.getItem(HIDDEN)) { guide.remove(); return; }
    } catch { /* storage blocked: show it this visit */ }

    let lines = {};
    try { lines = JSON.parse(guide.dataset.lines || "{}"); } catch { return; }
    const bubble = guide.querySelector(".site-guide-bubble");
    const said = new Set();
    try { JSON.parse(sessionStorage.getItem(SAID) || "[]").forEach((id) => said.add(id)); } catch { /* fine */ }

    let current = "";
    let settle = 0;
    let quiet = 0;

    const talk = (id) => {
      const line = lines[id];
      if (!line) return;
      bubble.textContent = line;
      guide.classList.add("is-talking");
      clearTimeout(quiet);
      quiet = setTimeout(() => guide.classList.remove("is-talking"), 6000);
      said.add(id);
      try { sessionStorage.setItem(SAID, JSON.stringify([...said])); } catch { /* fine */ }
    };

    const sections = [...document.querySelectorAll("main > section[id]")].filter((section) => lines[section.id]);
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        current = entry.target.id;
        clearTimeout(settle);
        if (said.has(current)) return;
        settle = setTimeout(() => talk(current), 700);
      });
    }, { rootMargin: "-45% 0px -45% 0px" });

    /* Appear after the hero's entrance, then start watching. */
    setTimeout(() => {
      guide.classList.add("is-ready");
      sections.forEach((section) => observer.observe(section));
    }, 1600);

    guide.querySelector(".site-guide-bot").addEventListener("click", () => {
      if (guide.classList.contains("is-talking")) {
        clearTimeout(quiet);
        guide.classList.remove("is-talking");
      } else if (current) {
        talk(current);
      }
    });

    guide.querySelector(".site-guide-hide").addEventListener("click", () => {
      try { localStorage.setItem(HIDDEN, "1"); } catch { /* fine */ }
      observer.disconnect();
      clearTimeout(settle);
      clearTimeout(quiet);
      guide.classList.remove("is-ready", "is-talking");
      setTimeout(() => guide.remove(), 500);
    });
  }

  function boot() {
    initWorkPreview();
    initEditCarousels();
    initEditPreviews();
    initProofCarousel();
    initLightbox();
    initEditTabs();
    initCertTilt();
    initStackLogos();
    initStackTips();
    initStackGuide();
    initSiteGuide();
    initGithubGraph();
    initLocalTime();
    initFolds();
    initProjectForm();
    initServiceLinks();
    initStackFit();
  }

  if (window.portfolioContentReady?.then) {
    window.portfolioContentReady.then(boot).catch(boot);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
