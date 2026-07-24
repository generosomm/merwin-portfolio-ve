// interactions.js — scroll spy, marquee, card tilt, cursor, creative effects

/* ── Scroll Spy (nav active state) ── */
function initScrollSpy() {
  const markers = document.querySelectorAll(".marker");
  if (!markers.length) return;

  const sections = [...markers]
    .map((m) => document.querySelector(m.dataset.target))
    .filter(Boolean);

  markers.forEach((m) => {
    m.addEventListener("click", () => {
      const target = document.querySelector(m.dataset.target);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      if (document.activeElement === m) m.blur();
    });
  });

  if (!sections.length) return;

  const track = document.getElementById("timelineTrack");
  const highlighter = document.getElementById("navHighlighter");
  let activeMarker = null;

  function moveHighlighter(marker) {
    if (!highlighter || !marker || !track) return;
    const rect = marker.getBoundingClientRect();
    const trackRect = track.getBoundingClientRect();
    highlighter.style.width = `${rect.width}px`;
    highlighter.style.left = `${rect.left - trackRect.left + track.scrollLeft}px`;
  }

  markers.forEach(m => {
    m.addEventListener("mouseenter", () => moveHighlighter(m));
    m.addEventListener("mouseleave", () => { if (activeMarker) moveHighlighter(activeMarker); });
  });

  function updateActiveNav() {
    const scrollPos = window.scrollY + 120;
    let currentSection = sections[0];

    for (let i = 0; i < sections.length; i++) {
      if (sections[i].offsetTop <= scrollPos) currentSection = sections[i];
    }
    // Snap to last section at page bottom
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 10) {
      currentSection = sections[sections.length - 1];
    }

    markers.forEach((m) => {
      const isActive = m.dataset.target === `#${currentSection.id}`;
      if (isActive) {
        m.classList.add("active");
        activeMarker = m;
        if (!track.matches(":hover")) moveHighlighter(m);
      } else {
        m.classList.remove("active");
        if (document.activeElement === m) m.blur();
      }
    });
  }

  window.addEventListener("scroll", updateActiveNav, { passive: true });
  setTimeout(updateActiveNav, 100); // wait for layout
  window.addEventListener("resize", () => { if (activeMarker) moveHighlighter(activeMarker); });
}

/* ── Infinite Scroll Marquee ── */
function initMarquee(marqueeId, trackId, speed) {
  const marquee = document.getElementById(marqueeId);
  const track   = document.getElementById(trackId);
  if (!marquee || !track) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let paused = false;
  let resumeTimer = null;
  let pos = marquee.scrollLeft;

  function syncPosFromScroll() { pos = marquee.scrollLeft; }
  function pauseForAWhile() {
    paused = true;
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => { syncPosFromScroll(); paused = false; }, 1800);
  }

  marquee.addEventListener("mouseenter", () => { paused = true; });
  marquee.addEventListener("mouseleave", () => {
    isDown = false;
    setTimeout(() => marquee.classList.remove("dragging"), 0);
    clearTimeout(resumeTimer); syncPosFromScroll(); paused = false;
  });
  marquee.addEventListener("touchstart", () => { paused = true; }, { passive: true });
  marquee.addEventListener("touchend", pauseForAWhile, { passive: true });
  marquee.addEventListener("wheel", pauseForAWhile, { passive: true });

  // Mouse drag support
  let isDown = false, startX, scrollLeftState;
  marquee.addEventListener("mousedown", (e) => {
    isDown = true; marquee.classList.remove("dragging"); paused = true;
    clearTimeout(resumeTimer); startX = e.pageX - marquee.offsetLeft; scrollLeftState = marquee.scrollLeft;
  });
  marquee.addEventListener("mouseup", () => {
    isDown = false; setTimeout(() => marquee.classList.remove("dragging"), 0); pauseForAWhile();
  });
  marquee.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    e.preventDefault(); marquee.classList.add("dragging");
    const x = e.pageX - marquee.offsetLeft;
    const walk = (x - startX) * 1.5;
    marquee.scrollLeft = scrollLeftState - walk;
    syncPosFromScroll();
  });

  // Arrow buttons
  const wrapper = marquee.closest('.marquee-wrapper');
  if (wrapper) {
    const scrollAmount = marqueeId === 'statsMarquee' ? 650 : 340;
    const leftBtn  = wrapper.querySelector('.nav-arrow-left');
    const rightBtn = wrapper.querySelector('.nav-arrow-right');
    if (leftBtn)  leftBtn.addEventListener('click', () => { marquee.scrollBy({ left: -scrollAmount, behavior: 'smooth' }); pauseForAWhile(); });
    if (rightBtn) rightBtn.addEventListener('click', () => { marquee.scrollBy({ left: scrollAmount, behavior: 'smooth' }); pauseForAWhile(); });
  }

  if (reduceMotion) return;

  // Auto-scroll loop
  function step() {
    if (!paused) {
      const half = track.scrollWidth / 2;
      pos += speed;
      if (pos >= half) pos -= half;
      marquee.scrollLeft = pos;
    }
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ── Video Modal for Work Cards ── */
function initWorkVideos() {
  const frames      = document.querySelectorAll(".case-frame[data-video]");
  const modal       = document.getElementById("videoModal");
  const modalVideo  = document.getElementById("videoModalPlayer");
  if (!frames.length || !modal || !modalVideo) return;

  function openModal(src) {
    modalVideo.src = src;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    modalVideo.play().catch(() => {});
  }
  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    modalVideo.pause();
    modalVideo.removeAttribute("src");
    modalVideo.load();
  }

  frames.forEach((frame) => {
    frame.addEventListener("click", () => { const src = frame.dataset.video; if (src) openModal(src); });
    frame.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); const src = frame.dataset.video; if (src) openModal(src); }
    });
  });
  modal.querySelectorAll("[data-modal-close]").forEach((el) => { el.addEventListener("click", closeModal); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("open")) closeModal(); });
}

/* ── Scroll Reveal (IntersectionObserver) ── */
function initScrollReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!els.length) return;

  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("is-visible");
        else entry.target.classList.remove("is-visible");
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -6% 0px" }
  );
  els.forEach((el) => observer.observe(el));
}

/* ── Hero Stat Count-up ── */
function initStatCounters() {
  const statsEl = document.querySelector(".hero-stats");
  if (!statsEl) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);

        const cells = entry.target.querySelectorAll("div");
        cells.forEach((cell, i) => {
          const delay = i * 110;
          cell.style.animationDelay = `${delay}ms`;
          cell.classList.add("stat-animate");
          if (reduceMotion) return;

          const strong = cell.querySelector("strong");
          if (!strong) return;
          const raw = strong.textContent.trim();
          const match = raw.match(/^([\d.]+)([A-Za-z+]*)$/);
          if (!match) return;

          const target   = parseFloat(match[1]);
          const suffix   = match[2];
          const decimals = match[1].includes(".") ? match[1].split(".")[1].length : 0;
          const duration = 1500;

          function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

          setTimeout(() => {
            const start = performance.now();
            function update(now) {
              const t = Math.min((now - start) / duration, 1);
              strong.textContent = (target * easeOut(t)).toFixed(decimals) + suffix;
              if (t < 1) requestAnimationFrame(update);
            }
            requestAnimationFrame(update);
          }, delay + 150);
        });
      });
    },
    { threshold: 0.05 }
  );

  observer.observe(statsEl);
}

/* ── Magnetic Buttons ── */
function initMagneticButtons() {
  const magnets = document.querySelectorAll(".marker, .btn-primary, .btn-ghost, .gh-link, .contact-meta a, .timeline-nav a");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  magnets.forEach((btn) => {
    btn.addEventListener("mousemove", (e) => {
      const rect = btn.getBoundingClientRect();
      const moveX = (e.clientX - rect.left - rect.width / 2) * 0.2;
      const moveY = (e.clientY - rect.top - rect.height / 2) * 0.3;
      btn.classList.add("magneting");
      btn.style.setProperty("--tx", moveX + "px");
      btn.style.setProperty("--ty", moveY + "px");
    });
    btn.addEventListener("mouseleave", () => {
      btn.classList.remove("magneting");
      btn.style.setProperty("--tx", "0px");
      btn.style.setProperty("--ty", "0px");
    });
  });
}

/* ── Spotlight Cards ── */
function initSpotlightCards() {
  const cards = document.querySelectorAll(".case-card, .service-card, .dev-card");
  cards.forEach(card => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
      card.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
    });
  });
}

/* ── 3D Card Tilt ── */
function initCardTilt() {
  const cards = document.querySelectorAll(".case-card, .service-card, .dev-card, .tool-card");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  cards.forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const centerX = rect.width / 2, centerY = rect.height / 2;
      const rotateX = ((e.clientY - rect.top - centerY) / centerY) * -3.5;
      const rotateY = ((e.clientX - rect.left - centerX) / centerX) * 3.5;
      card.classList.add("tilting");
      card.style.setProperty("--rx", rotateX + "deg");
      card.style.setProperty("--ry", rotateY + "deg");
      card.style.setProperty("--s", "1.015");
      card.style.setProperty("--x", (e.clientX - rect.left) + "px");
      card.style.setProperty("--y", (e.clientY - rect.top) + "px");
    });
    card.addEventListener("mouseleave", () => {
      card.classList.remove("tilting");
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
      card.style.setProperty("--s", "1");
    });
  });
}

/* ── Hero Parallax ── */
function initParallaxHero() {
  const heroContent = document.querySelector(".hero-content") || document.querySelector(".hero > .container");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || !heroContent) return;
  heroContent.classList.add("hero-content");
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    if (y < window.innerHeight) heroContent.style.setProperty("--hero-y", (y * 0.4) + "px");
  }, { passive: true });
}

/* ── Theme (dark/light toggle + first-time modal) ── */
function initTheme() {
  const savedTheme = localStorage.getItem("portfolio-theme");
  const modal = document.getElementById("themePromptModal");

  if (savedTheme === "light") {
    document.body.setAttribute("data-theme", "light");
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.body.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme");
  }

  // Show modal on first visit
  if (!savedTheme && modal) {
    setTimeout(() => {
      modal.classList.add("is-visible");
      modal.setAttribute("aria-hidden", "false");
    }, 1100);

    const applyChoice = (choice) => {
      if (choice === "light") {
        document.body.setAttribute("data-theme", "light");
        document.documentElement.setAttribute("data-theme", "light");
        localStorage.setItem("portfolio-theme", "light");
      } else {
        document.body.removeAttribute("data-theme");
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("portfolio-theme", "dark");
      }
      modal.classList.remove("is-visible");
      modal.setAttribute("aria-hidden", "true");
    };

    modal.addEventListener("click", (e) => {
      const selectBtn = e.target.closest("[data-select-theme]");
      if (selectBtn) applyChoice(selectBtn.getAttribute("data-select-theme"));
      else if (e.target.classList.contains("theme-prompt-backdrop")) applyChoice("dark");
    });
  }

  // Toggle button
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("#themeToggleBtn");
    if (!btn) return;
    const isLight = document.body.getAttribute("data-theme") === "light";
    if (isLight) {
      document.body.removeAttribute("data-theme");
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("portfolio-theme", "dark");
    } else {
      document.body.setAttribute("data-theme", "light");
      document.documentElement.setAttribute("data-theme", "light");
      localStorage.setItem("portfolio-theme", "light");
    }
  });
}

/* ── Staggered Text Reveal ── */
function initStaggeredText() {
  const paragraphs = document.querySelectorAll(".about-point p, .contact p");
  if (!paragraphs.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add("is-revealed"); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

  paragraphs.forEach(p => {
    const text = p.innerText;
    p.innerHTML = text.split(" ").map((word, i) =>
      `<span class="stagger-word" style="transition-delay: ${i * 20}ms">${word}</span>`
    ).join(" ");
    p.classList.add("stagger-parent");
    observer.observe(p);
  });
}

/* ── Time Widget ── */
function initTimeWidget() {
  const timeWidget = document.getElementById("timeWidget");
  if (!timeWidget) return;

  function updateTime() {
    const opts = { timeZone: 'Asia/Manila', hour: 'numeric', minute: 'numeric', hour12: true };
    const timeStr = new Intl.DateTimeFormat('en-US', opts).format(new Date());
    timeWidget.innerHTML = `📍 Batangas, PH &bull; ${timeStr} &bull; <span class="dot-live"></span> Online`;
  }
  updateTime();
  setInterval(updateTime, 60000);
}

/* ── Subtle Sound on Hover ── */
function initSoundDesign() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();

  function playTick() {
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.06);
  }

  document.querySelectorAll(".marker, .btn-primary, .btn-ghost, .gh-link, .contact-meta a, .timeline-nav a")
    .forEach(el => el.addEventListener("mouseenter", playTick));
}

/* ── Dynamic Tab Title ── */
function initDynamicTitle() {
  const originalTitle = document.title;
  document.addEventListener("visibilitychange", () => {
    document.title = document.hidden ? "👀 Miss you! - Merwin" : originalTitle;
  });
}

/* ── Secret Developer Mode (type "dev") ── */
function initDeveloperMode() {
  let buffer = "";
  document.addEventListener("keydown", (e) => {
    buffer += e.key.toLowerCase();
    if (buffer.length > 5) buffer = buffer.slice(-5);
    if (buffer.includes("dev")) {
      document.body.classList.toggle("dev-mode");
      buffer = "";
      if (window.AudioContext || window.webkitAudioContext) {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.type = "square";
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.1);
      }
    }
  });
}

/* ── Section Minimap ── */
function initMinimap() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const markers = Array.from(document.querySelectorAll(".marker"));
  const targets = Array.from(new Set(markers.map(m => m.dataset.target)))
    .filter(t => t && typeof t === "string" && t.startsWith("#"))
    .map(t => document.querySelector(t))
    .filter(Boolean);

  if (targets.length < 2) return;

  const minimap = document.createElement("div");
  minimap.className = "minimap";
  const track = document.createElement("div");
  track.className = "minimap-track";
  const indicator = document.createElement("div");
  indicator.className = "minimap-indicator";
  track.appendChild(indicator);

  targets.forEach((sec) => {
    const dot = document.createElement("div");
    dot.className = "minimap-dot";
    dot.addEventListener("click", () => sec.scrollIntoView({ behavior: "smooth" }));
    track.appendChild(dot);
  });

  minimap.appendChild(track);
  document.body.appendChild(minimap);

  const dots = track.querySelectorAll(".minimap-dot");

  const observer = new IntersectionObserver((entries) => {
    let activeIndex = -1;
    entries.forEach(entry => { if (entry.isIntersecting) activeIndex = targets.indexOf(entry.target); });
    if (activeIndex !== -1) {
      dots.forEach((dot, i) => dot.classList.toggle("active", i === activeIndex));
      const activeDot = dots[activeIndex];
      if (activeDot) indicator.style.top = (activeDot.offsetTop + (activeDot.offsetHeight / 2) - 8) + "px";
    }
  }, { threshold: 0.2 });

  targets.forEach(t => observer.observe(t));
}

/* ── CV Pull String ── */
function initPullString(db) {
  const resumeUrl = db && db.contact && db.contact.resume ? db.contact.resume : "#";

  const wrap = document.createElement("div");
  wrap.className = "pull-string-wrap";
  const string = document.createElement("div");
  string.className = "pull-string";
  const knob = document.createElement("div");
  knob.className = "pull-knob";
  knob.textContent = "CV";
  wrap.appendChild(string);
  wrap.appendChild(knob);
  document.body.appendChild(wrap);

  let isDragging = false, startY = 0, currentY = 0, startX = 0, currentX = 0;
  const maxPull = 120, baseHeight = 100;

  const onDown = (e) => {
    isDragging = true;
    const evt = e.touches ? e.touches[0] : e;
    startY = evt.clientY; startX = evt.clientX;
    wrap.style.transition = "none"; string.style.transition = "none";
  };
  const onMove = (e) => {
    if (!isDragging) return;
    const evt = e.touches ? e.touches[0] : e;
    const deltaY = Math.max(0, evt.clientY - startY);
    const deltaX = evt.clientX - startX;
    currentY = deltaY * 0.6;
    if (currentY > maxPull) currentY = maxPull + (currentY - maxPull) * 0.2;
    currentX = deltaX * 0.15;
    const angle = Math.max(-25, Math.min(25, currentX));
    string.style.height = (baseHeight + currentY) + "px";
    wrap.style.transform = `rotate(${angle}deg)`;
  };
  const onUp = () => {
    if (!isDragging) return;
    isDragging = false;
    if (currentY > 50) window.open(resumeUrl, "_blank");
    wrap.style.transition = "transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)";
    string.style.transition = "height 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)";
    wrap.style.transform = "rotate(0deg)";
    string.style.height = baseHeight + "px";
    currentY = 0; currentX = 0;
  };

  wrap.addEventListener("mousedown", onDown);
  wrap.addEventListener("touchstart", onDown, {passive: true});
  window.addEventListener("mousemove", onMove);
  window.addEventListener("touchmove", onMove, {passive: true});
  window.addEventListener("mouseup", onUp);
  window.addEventListener("touchend", onUp);
}

/* ── Custom Cursor ── */
function initCustomCursor() {
  const dot  = document.getElementById("cursorDot");
  const ring = document.getElementById("cursorRing");
  if (!dot || !ring) return;
  if (!window.matchMedia("(pointer: fine)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  document.body.classList.add("custom-cursor-active");
  let ringX = 0, ringY = 0, dotX = 0, dotY = 0;

  document.addEventListener("mousemove", (e) => {
    dotX = e.clientX; dotY = e.clientY;
    dot.style.left = dotX + "px"; dot.style.top = dotY + "px";
  });

  function animateCursor() {
    ringX += (dotX - ringX) * 0.45;
    ringY += (dotY - ringY) * 0.45;
    ring.style.left = ringX + "px"; ring.style.top = ringY + "px";
    requestAnimationFrame(animateCursor);
  }
  requestAnimationFrame(animateCursor);

  const interactives = "a, button, [onclick], input, textarea, .case-frame, .stat-img-card, .marker";
  document.addEventListener("mouseover", (e) => {
    if (e.target.closest(interactives)) { dot.classList.add("is-hovering"); ring.classList.add("is-hovering"); }
  });
  document.addEventListener("mouseout", (e) => {
    if (e.target.closest(interactives)) { dot.classList.remove("is-hovering"); ring.classList.remove("is-hovering"); }
  });
  document.addEventListener("mousedown", () => { dot.classList.add("is-clicking"); ring.classList.add("is-clicking"); });
  document.addEventListener("mouseup", () => { dot.classList.remove("is-clicking"); ring.classList.remove("is-clicking"); });
  document.addEventListener("mouseleave", () => { dot.style.opacity = "0"; ring.style.opacity = "0"; });
  document.addEventListener("mouseenter", () => { dot.style.opacity = "1"; ring.style.opacity = "1"; });
}

/* ── Scroll Progress Bar ── */
function initScrollProgress() {
  const bar = document.getElementById("scrollProgress");
  if (!bar) return;
  window.addEventListener("scroll", () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (docHeight > 0 ? (scrollTop / docHeight) * 100 : 0) + "%";
  }, { passive: true });
}

/* ── Mouse-tracking Spotlight Glow ── */
function initCursorGlow() {
  const glow = document.querySelector(".bg-cursor-glow");
  if (!glow) return;
  if (!window.matchMedia("(pointer: fine)").matches) return;

  let glowX = window.innerWidth / 2, glowY = window.innerHeight / 2;
  let currentX = glowX, currentY = glowY;

  document.addEventListener("mousemove", (e) => {
    glowX = e.clientX; glowY = e.clientY; glow.style.opacity = "1";
  }, { passive: true });

  function animateGlow() {
    currentX += (glowX - currentX) * 0.06;
    currentY += (glowY - currentY) * 0.06;
    glow.style.transform = `translate(${currentX - 250}px, ${currentY - 250}px)`;
    requestAnimationFrame(animateGlow);
  }
  animateGlow();
}
