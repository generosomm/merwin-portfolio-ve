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
    const caption = dialog?.querySelector(".lightbox-caption");
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
     Drawn from the saved snapshot (scripts/update-github-snapshot.mjs),
     loaded once the section is close to the screen. Laid out like a
     strip of timeline: a month ruler with tick marks over the weeks,
     Mon / Wed / Fri down the side, and only as many recent weeks as fit
     the card (never a sideways scroll). Hovering or tapping a day runs
     a green playhead down its week and shows that day's count. Under
     the graph: total, longest streak, busiest day.
  ---------------------------------------------------------------- */

  function initGithubGraph() {
    const box = document.querySelector(".github[data-snapshot]");
    const card = box?.querySelector(".github-scroll");
    const graph = box?.querySelector(".github-graph");
    const ruler = box?.querySelector(".gh-ruler");
    const dayLabels = box?.querySelector(".gh-days");
    const wrap = box?.querySelector(".gh-grid-wrap");
    const playhead = box?.querySelector(".gh-playhead");
    const tip = box?.querySelector(".gh-tip");
    const stats = box?.querySelector(".gh-stats");
    const source = box?.dataset.snapshot;
    if (!box || !card || !graph || !wrap || !source) return;

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
    const formatShort = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" });
    const formatMonth = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
    const formatWeekday = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });

    /* One entry per day: { date, level, count }, padded with nulls at
       the front so every column starts on a Sunday. */
    let weeks = [];
    let shownWeeks = 0;
    let shownCell = 0;

    function countLabel(count) {
      const tooltip = labels.tooltip || {};
      if (!count) return tooltip.none || "0";
      return fill(count === 1 ? tooltip.one : tooltip.many, { count: count.toLocaleString(locale) });
    }

    function render() {
      /* Base square size from the CSS clamp(), read with any earlier
         fit removed (grid-auto-columns resolves it to pixels). */
      card.style.removeProperty("--cell-fit");
      const style = getComputedStyle(graph);
      const base = parseFloat(style.gridAutoColumns) || 12;
      const gap = parseFloat(style.columnGap) || 3;
      const room = wrap.clientWidth;
      const fit = Math.max(1, Math.min(weeks.length, Math.floor((room + gap) / (base + gap))));
      /* When the whole year fits with room to spare, the squares grow
         (up to 20px) so the strip fills the card instead of stopping
         two-thirds of the way across. */
      const cell = fit === weeks.length
        ? Math.min(20, Math.max(base, Math.floor((room + gap) / weeks.length - gap)))
        : base;
      card.style.setProperty("--cell-fit", `${cell}px`);
      if (fit === shownWeeks && cell === shownCell) return;
      shownWeeks = fit;
      shownCell = cell;
      const visible = weeks.slice(-fit);

      const squares = document.createDocumentFragment();
      visible.forEach((week, column) => {
        week.forEach((day) => {
          const square = document.createElement("span");
          square.className = day ? "github-cell" : "github-cell is-empty";
          square.style.setProperty("--c", column);
          if (day) {
            square.dataset.level = day.level;
            square.dataset.date = day.date;
            if (day.count !== null) square.dataset.count = day.count;
          }
          squares.appendChild(square);
        });
      });
      graph.replaceChildren(squares);

      /* Month ruler: a tick on every week, a taller tick and a label
         where a month starts. A label too close to the previous one is
         dropped rather than overlapped. */
      const step = cell + gap;
      const marks = document.createDocumentFragment();
      let lastMonth = null;
      let lastLabelAt = -Infinity;
      let lastLabel = null;
      visible.forEach((week, column) => {
        const first = week.find(Boolean);
        const tick = document.createElement("span");
        tick.className = "gh-tick";
        tick.style.left = `${column * step + cell / 2}px`;
        if (first) {
          const month = first.date.slice(0, 7);
          if (month !== lastMonth) {
            if (lastMonth !== null || column === 0) {
              tick.classList.add("is-month");
              /* Too close to the previous label: if that one is just the
                 sliver of a month at the very start, it gives way (as on
                 GitHub); otherwise this one is skipped. */
              const crowded = column - lastLabelAt < 3;
              if (crowded && lastLabel && lastLabelAt === 0) {
                lastLabel.remove();
                lastLabel = null;
              }
              if (!crowded || !lastLabel) {
                const label = document.createElement("span");
                label.className = "gh-month";
                label.style.left = `${column * step}px`;
                label.textContent = formatMonth.format(new Date(`${first.date}T00:00:00Z`));
                marks.appendChild(label);
                lastLabelAt = column;
                lastLabel = label;
              }
            }
            lastMonth = month;
          }
        }
        marks.appendChild(tick);
      });
      ruler.replaceChildren(marks);
      ruler.style.setProperty("--ruler-w", `${visible.length * step - gap}px`);
    }

    /* Weekday labels down the side: Mon, Wed, Fri, like GitHub's own,
       generated in the page language rather than written out. */
    function drawDays() {
      const rows = document.createDocumentFragment();
      for (let row = 0; row < 7; row += 1) {
        const label = document.createElement("span");
        /* 2023-01-01 was a Sunday; row 0 is Sunday. */
        if (row % 2 === 1) label.textContent = formatWeekday.format(new Date(Date.UTC(2023, 0, 1 + row)));
        rows.appendChild(label);
      }
      dayLabels?.replaceChildren(rows);
    }

    /* Total, longest run of active days, and the single busiest day. */
    function drawStats(days, total) {
      if (!stats) return;
      const names = labels.stats || {};
      let longest = 0;
      let run = 0;
      let busiest = null;
      days.forEach((day) => {
        const active = day.count !== null ? day.count > 0 : day.level > 0;
        run = active ? run + 1 : 0;
        longest = Math.max(longest, run);
        if (day.count !== null && (!busiest || day.count > busiest.count)) busiest = day;
      });

      const items = [];
      if (Number.isFinite(total)) items.push([names.total, total.toLocaleString(locale), ""]);
      items.push([names.streak, fill(longest === 1 ? names.day : names.days, { count: longest }), ""]);
      if (busiest && busiest.count > 0) {
        items.push([names.busiest, formatShort.format(new Date(`${busiest.date}T00:00:00Z`)), countLabel(busiest.count)]);
      }

      const fragment = document.createDocumentFragment();
      items.filter(([label]) => label).forEach(([label, value, detail]) => {
        const item = document.createElement("div");
        item.className = "gh-stat";
        const dt = document.createElement("dt");
        dt.textContent = label;
        const dd = document.createElement("dd");
        dd.textContent = value;
        if (detail) {
          const small = document.createElement("span");
          small.textContent = detail;
          dd.appendChild(small);
        }
        item.append(dt, dd);
        fragment.appendChild(item);
      });
      stats.replaceChildren(fragment);
    }

    /* Hover (or tap) a day: playhead down its week, tooltip above it. */
    function point(square) {
      if (!square?.dataset.date) {
        wrap.classList.remove("is-pointing");
        return;
      }
      const wrapBox = wrap.getBoundingClientRect();
      const box = square.getBoundingClientRect();
      const x = box.left - wrapBox.left + box.width / 2;
      playhead.style.left = `${x}px`;
      /* Older snapshots have levels but no counts: an empty day is
         still known to be zero; any other day just shows its date. */
      const count = square.dataset.count !== undefined
        ? Number(square.dataset.count)
        : square.dataset.level === "0" ? 0 : null;
      const date = formatDay.format(new Date(`${square.dataset.date}T00:00:00Z`));
      tip.textContent = "";
      const strong = document.createElement("strong");
      strong.textContent = count !== null ? countLabel(count) : "";
      const when = document.createElement("span");
      when.textContent = date;
      tip.append(strong, when);
      /* Keep the tooltip inside the card at both ends. */
      const half = tip.offsetWidth / 2;
      tip.style.left = `${Math.min(Math.max(x, half), wrap.clientWidth - half)}px`;
      tip.style.top = `${box.top - wrapBox.top}px`;
      graph.querySelector(".is-pointed")?.classList.remove("is-pointed");
      square.classList.add("is-pointed");
      wrap.classList.add("is-pointing");
    }

    graph.addEventListener("pointerover", (event) => point(event.target.closest(".github-cell")));
    graph.addEventListener("pointerdown", (event) => point(event.target.closest(".github-cell")));
    wrap.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "mouse") {
        wrap.classList.remove("is-pointing");
        graph.querySelector(".is-pointed")?.classList.remove("is-pointed");
      }
    });

    async function draw() {
      try {
        const response = await fetch(source);
        if (!response.ok) return;
        const data = await response.json();
        const levels = String(data.levels || "");
        const counts = Array.isArray(data.counts) ? data.counts : [];
        const start = new Date(`${data.start}T00:00:00Z`);
        if (!levels.length || Number.isNaN(start.getTime())) return;

        const days = Array.from(levels, (level, index) => {
          const date = new Date(start.getTime() + index * 86400000).toISOString().slice(0, 10);
          return {
            date,
            level: /[0-4]/.test(level) ? Number(level) : 0,
            count: Number.isFinite(Number(counts[index])) && index < counts.length ? Number(counts[index]) : null
          };
        });
        const padded = [...Array(start.getUTCDay()).fill(null), ...days];
        weeks = [];
        for (let index = 0; index < padded.length; index += 7) weeks.push(padded.slice(index, index + 7));

        card.hidden = false;
        drawDays();
        render();
        drawStats(days, Number(data.total));
        if ("ResizeObserver" in window) new ResizeObserver(render).observe(wrap);

        /* The squares fill in column by column, once, like a render
           bar crossing the strip (css/closing.css). */
        if (!reduceMotion.matches) {
          graph.classList.add("is-drawing");
          window.setTimeout(() => graph.classList.remove("is-drawing"), 2200);
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
     Web3Forms and lands in the inbox. Without one, the visitor's email
     app opens with the brief already written, so the form works from
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
        window.location.href = `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n\n"))}`;
        say("mailtoSent", "info");
        return;
      }

      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      say("sending", "info");
      try {
        const response = await fetch(form.dataset.endpoint || "https://api.web3forms.com/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ access_key: key, subject, from_name: fields.name, email: fields.email, message: lines.join("\n\n") })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.success === false) throw new Error("rejected");
        form.reset();
        say("sent", "ok");
      } catch {
        say("failed", "error");
      } finally {
        button.disabled = false;
      }
    });
  }

  /* ---- Service cards taller than the screen ----------------------------
     The cards pin near the top while the next one slides over. A card
     taller than the screen would be pinned with its bottom (and its
     "Start a project" button) still off-screen, and then covered.
     Such a card pins later instead: when its bottom edge reaches the
     bottom of the screen, so all of it is seen first.
  ---------------------------------------------------------------- */

  function initStackFit() {
    const cards = Array.from(document.querySelectorAll(".practice-card"));
    if (!cards.length) return;

    function fit() {
      cards.forEach((card) => {
        card.style.removeProperty("top");
        const top = parseFloat(getComputedStyle(card).top);
        if (!Number.isFinite(top)) return;
        const height = card.offsetHeight;
        const room = window.innerHeight - 16;
        if (top + height > room) card.style.top = `${Math.round(room - height)}px`;
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
      set(false);
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
        key.addEventListener("pointermove", (event) => {
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
