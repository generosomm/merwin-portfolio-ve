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
    if (!list || !preview || !image || !desktop.matches) return;

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

    list.addEventListener("pointermove", (event) => {
      if (!current || reduceMotion.matches || !preview.classList.contains("is-visible")) return;
      const box = current.getBoundingClientRect();
      const dx = Math.max(-1, Math.min(1, (event.clientX - (box.left + box.width / 2)) / (box.width / 2)));
      const dy = Math.max(-1, Math.min(1, (event.clientY - (box.top + box.height / 2)) / (box.height / 2)));
      preview.style.setProperty("--ry", `${(dx * 12).toFixed(2)}deg`);
      preview.style.setProperty("--rx", `${(-dy * 10).toFixed(2)}deg`);
    }, { passive: true });

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
      if (current && preview.classList.contains("is-visible")) place(current, { instant: true });
    }, { passive: true });
  }

  /* ---- Edit previews -----------------------------------------------
     The <video> is only created on first hover, so none of the clips
     download until someone actually points at one.
  ---------------------------------------------------------------- */

  function initEditPreviews() {
    if (!finePointer.matches || reduceMotion.matches) return;

    document.querySelectorAll(".edit-card").forEach((card) => {
      const media = card.querySelector(".edit-media[data-video]");
      if (!media) return;
      let video = null;

      card.addEventListener("pointerenter", () => {
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
    if (!dialog || !image || typeof dialog.showModal !== "function") return;

    /* Images (proof) and videos (AI hooks) share one dialog. */
    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-lightbox], [data-lightbox-video]");
      if (!trigger) return;

      const clip = trigger.dataset.lightboxVideo;
      if (clip && video) {
        image.hidden = true;
        video.hidden = false;
        video.src = clip;
        video.setAttribute("aria-label", trigger.dataset.lightboxAlt || "");
        video.play().catch(() => {});
      } else {
        if (video) video.hidden = true;
        image.hidden = false;
        image.src = trigger.dataset.lightbox;
        image.alt = trigger.dataset.lightboxAlt || "";
      }
      dialog.showModal();
      window.portfolio?.lenis?.stop();
    });

    dialog.querySelector(".lightbox-close")?.addEventListener("click", () => dialog.close());
    /* A click that lands on the dialog itself is a click on the dim
       backdrop around the image. */
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => {
      /* Stop the clip and its download, not just its sound. */
      if (video && !video.hidden) {
        video.pause();
        video.removeAttribute("src");
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
      /* The newly shown row starts at its first card, and its dots are
         re-measured now that it has a real width (it was hidden). */
      const grid = document.getElementById(tab.getAttribute("aria-controls"))?.querySelector(".edits-grid");
      if (grid) {
        grid.scrollLeft = 0;
        grid.dispatchEvent(new Event("scroll"));
      }
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

  /* ---- Swipe-row dots (phones) ----------------------------------------
     One dot per card; the one for the card at the start of the row is
     lit. Purely visual (the cards themselves are the controls).
  ---------------------------------------------------------------- */

  function initEditDots() {
    document.querySelectorAll(".edits-panel").forEach((panel) => {
      const grid = panel.querySelector(".edits-grid");
      const dots = panel.querySelector(".edits-dots");
      const cards = grid ? Array.from(grid.children) : [];
      if (!grid || !dots || cards.length < 2) return;

      dots.replaceChildren(...cards.map(() => document.createElement("span")));
      let frame = 0;

      const update = () => {
        frame = 0;
        const step = cards[1].offsetLeft - cards[0].offsetLeft || 1;
        const atEnd = grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 2;
        const active = atEnd ? cards.length - 1 : Math.round(grid.scrollLeft / step);
        Array.from(dots.children).forEach((dot, index) => dot.classList.toggle("is-active", index === active));
      };

      grid.addEventListener("scroll", () => {
        if (!frame) frame = requestAnimationFrame(update);
      }, { passive: true });
      update();
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
      tile.addEventListener("pointermove", (event) => {
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

      card.addEventListener("pointermove", (event) => {
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

  /* ---- GitHub contribution graph -------------------------------------
     Drawn from the saved snapshot (scripts/update-github-snapshot.mjs
     writes it), loaded once the section is close to the screen.
     Columns are weeks, rows are Sunday to Saturday, like GitHub's
     own. If the file is missing the graph stays hidden.
  ---------------------------------------------------------------- */

  function initGithubGraph() {
    const box = document.querySelector(".github[data-snapshot]");
    const scroll = box?.querySelector(".github-scroll");
    const graph = box?.querySelector(".github-graph");
    const summary = box?.querySelector(".github-summary");
    const source = box?.dataset.snapshot;
    if (!box || !scroll || !graph || !source) return;

    /* Days as weeks of seven (Sunday first), padded at the front so
       the first column starts on the right weekday. */
    let weeks = [];
    let shownWeeks = 0;

    /* Only the most recent weeks that fit the card: never a sideways
       scroll, never squares shrunk past readable. */
    function render() {
      const style = getComputedStyle(graph);
      /* grid-auto-columns resolves the clamp() in --cell to pixels;
         the custom property itself would only give back its text. */
      const cell = parseFloat(style.gridAutoColumns) || 12;
      const gap = parseFloat(style.columnGap) || 3;
      const room = graph.parentElement.clientWidth -
        parseFloat(getComputedStyle(graph.parentElement).paddingLeft) -
        parseFloat(getComputedStyle(graph.parentElement).paddingRight);
      const fit = Math.max(1, Math.min(weeks.length, Math.floor((room + gap) / (cell + gap))));
      if (fit === shownWeeks) return;
      shownWeeks = fit;

      const fragment = document.createDocumentFragment();
      weeks.slice(-fit).flat().forEach((level) => {
        const square = document.createElement("span");
        square.className = level === null ? "github-cell is-empty" : "github-cell";
        if (level !== null) square.dataset.level = level;
        fragment.appendChild(square);
      });
      graph.replaceChildren(fragment);
    }

    async function draw() {
      try {
        const response = await fetch(source);
        if (!response.ok) return;
        const data = await response.json();
        const levels = String(data.levels || "");
        const start = new Date(`${data.start}T00:00:00Z`);
        if (!levels.length || Number.isNaN(start.getTime())) return;

        const days = [
          ...Array(start.getUTCDay()).fill(null),
          ...Array.from(levels, (level) => (/[0-4]/.test(level) ? level : "0"))
        ];
        weeks = [];
        for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7));

        scroll.hidden = false;
        render();
        if ("ResizeObserver" in window) new ResizeObserver(render).observe(scroll);

        const total = Number(data.total);
        const template = box.dataset.summary || "";
        if (summary && Number.isFinite(total) && template.includes("{count}")) {
          summary.textContent = template.replace("{count}", total.toLocaleString("en-US"));
          summary.hidden = false;
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
    }, { rootMargin: "600px 0px" });
    observer.observe(box);
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

  function boot() {
    initWorkPreview();
    initEditPreviews();
    initProofCarousel();
    initLightbox();
    initEditTabs();
    initEditDots();
    initCertTilt();
    initStackLogos();
    initGithubGraph();
    initLocalTime();
  }

  if (window.portfolioContentReady?.then) {
    window.portfolioContentReady.then(boot).catch(boot);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
