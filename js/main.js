// Main script

const DATA_FILES = {
  nav:          "data/nav.json",
  hero:         "data/hero.json",
  work:         "data/work.json",
  services:     "data/services.json",
  stats:        "data/stats.json",
  testimonials: "data/testimonials.json",
  skills:       "data/skills.json",
  dev:          "data/dev.json",
  about:        "data/about.json",
  contact:      "data/contact.json",
};

// Helpers

function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function pick(obj, key, fallback = "") {
  const v = obj ? obj[key] : undefined;
  return v === undefined || v === null ? fallback : v;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function emptyState(message) {
  return `<p class="load-msg" style="padding:32px 0;">${esc(message)}</p>`;
}

function revealDelay(i) {
  return `${Math.min(i, 8) * 65}ms`;
}

function sectionIndex(num, label) {
  return `<span class="section-index">${String(num).padStart(2,"0")} / ${label}</span>`;
}

function sectionHead(index, label, data) {
  if (!data) return "";
  return `
    <div class="section-head reveal">
      ${sectionIndex(index, label)}
      <h2>${esc(pick(data, "heading", ""))}</h2>
      ${data.sub ? `<p>${esc(data.sub)}</p>` : ""}
    </div>`;
}

// Data

async function loadData() {
  const results = await Promise.allSettled(
    Object.entries(DATA_FILES).map(async ([key, path]) => {
      const url = `${path}?t=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`${path} responded ${res.status}`);
      const json = await res.json();
      return [key, json];
    })
  );

  const data = {};
  const failed = [];

  results.forEach((result, i) => {
    const key = Object.keys(DATA_FILES)[i];
    if (result.status === "fulfilled") {
      data[result.value[0]] = result.value[1];
    } else {
      failed.push(key);
      data[key] = null;
      console.warn(`Couldn't load "${key}":`, result.reason?.message || result.reason);
    }
  });

  return { data, failed };
}

// Render

function renderNav(data) {
  const el = document.getElementById("nav-root");
  if (!el) return;
  const items = list(data && data.items);

  if (!items.length) { el.innerHTML = ""; return; }

  const brand = esc(pick(data, "brand", "MG"));
  // I split my name at the first space to highlight the last name
  const brandParts = brand.split(" ");
  const brandHTML = brandParts.length > 1
    ? `${brandParts[0]} <strong>${brandParts.slice(1).join(" ")}</strong>`
    : brand;

  el.innerHTML = `
    <div class="timeline-track" id="timelineTrack">
      <span class="tl-brand">${brandHTML}</span>
      ${items
        .map((item) => {
          if (!item || !item.target || !item.label) return "";
          return `
        <button class="marker" data-target="${esc(item.target)}">
          <span class="tc">${esc(pick(item, "tc", ""))}</span>
          <span class="label">${esc(item.label)}</span>
        </button>`;
        })
        .join("")}
    </div>`;
}

function renderHero(data) {
  const el = document.getElementById("home");
  if (!el) return;
  if (!data) { el.innerHTML = emptyState("Hero content is missing."); return; }

  const stats        = list(data.stats);
  const ctaPrimary   = data.ctaPrimary   || {};
  const ctaSecondary = data.ctaSecondary || {};

  // Build marquee
  const rawMarquee = list(data.marquee);
  const marqueeItems = rawMarquee.length
    ? rawMarquee
    : [
        "VIRTUAL ASSISTANT",
        "VIDEO EDITOR",
        "CONTENT CREATOR",
        "CONTENT OPERATOR",
      ];

  const itemHTML = (item) =>
    `<span>${esc(item)}</span><span class="m-sep">✦</span>`;

  // I repeat items to ensure the marquee fills wide screens
  const repeatCount = 4;
  let groupItems = [];
  for (let i = 0; i < repeatCount; i++) {
    groupItems = groupItems.concat(marqueeItems);
  }

  const groupContent = groupItems.map(itemHTML).join("");

  // 2 groups create a seamless infinite loop
  const marqueeTrackHTML = `
    <div class="hero-marquee-group">${groupContent}</div>
    <div class="hero-marquee-group" aria-hidden="true">${groupContent}</div>
  `;

  el.innerHTML = `
    <div class="hero-main">
      <div class="hero-copy">
        <span class="hero-index">00 / INTRO</span>

        <div class="hero-marquee-wrap" aria-label="Role ticker">
          <div class="hero-marquee-track">
            ${marqueeTrackHTML}
          </div>
        </div>

        <h1>
          <span class="line">${esc(pick(data, "nameLine1", "MERWIN"))}</span>
          <span class="line">${esc(pick(data, "nameLine2Start", "GENE"))}<span class="accent">${esc(pick(data, "nameLine2Accent", "ROSO"))}</span></span>
        </h1>

        <p class="hero-sub">${esc(pick(data, "tagline", ""))}</p>

        <div class="hero-cta">
          ${ctaPrimary.label   ? `<a href="${esc(pick(ctaPrimary,  "href","#"))}" class="btn-primary">${esc(ctaPrimary.label)} →</a>`  : ""}
          ${ctaSecondary.label ? `<a href="${esc(pick(ctaSecondary,"href","#"))}" class="btn-ghost">${esc(ctaSecondary.label)}</a>`    : ""}
        </div>

        ${stats.length
          ? `<div class="hero-stats">
               ${stats.map((s) =>
                 `<div>
                    <strong>${esc(pick(s, "value", "N/A"))}</strong>
                    <span>${esc(pick(s, "label", ""))}</span>
                  </div>`).join("")}
             </div>`
          : ""}
      </div>
    </div>`;
}



function renderWork(data) {

  const el = document.getElementById("work");
  if (!el) return;
  if (!data) { el.innerHTML = emptyState("Work section is missing."); return; }

  const items = list(data.items);

  const cardHTML = (item) => {
    if (!item) return "";
    const hasVideo = !!item.video;
    const bg = item.image
      ? `background-image:url('${esc(item.image)}');`
      : `--c1:${esc(pick(item,"c1","#1a1b20"))}; --c2:${esc(pick(item,"c2","#0D0E10"))};`;
    return `
      <article class="case-card">
        <div class="case-frame${hasVideo ? " has-video" : ""}" style="${bg}"${
          hasVideo
            ? ` data-video="${esc(item.video)}" role="button" tabindex="0" aria-label="Play video: ${esc(pick(item,"title","project video"))}"`
            : ""
        }>
          <span class="case-badge">${esc(pick(item,"badge","Project"))}</span>
          ${hasVideo ? `<div class="play-icon"></div>` : ""}
        </div>
        <div class="case-body">
          <h3>${esc(pick(item,"title","Untitled project"))}</h3>
          ${item.stat ? `<p class="case-stat">${esc(item.stat)}</p>` : ""}
          <p>${esc(pick(item,"desc",""))}</p>
          ${item.postUrl
            ? `<a href="${esc(item.postUrl)}" target="_blank" rel="noopener" class="case-link">Watch original post →</a>`
            : ""}
        </div>
      </article>`;
  };

  el.innerHTML = `
    ${sectionHead(1, "Selected Work", data)}
    ${items.length
      ? `<div class="case-marquee" id="workMarquee">
           <div class="case-track" id="workTrack">
             ${items.map(cardHTML).join("")}
             ${items.map(cardHTML).join("")}
           </div>
         </div>`
      : emptyState("No work added yet.")}`;
}

function renderServices(data) {
  const el = document.getElementById("services");
  if (!el) return;
  if (!data) { el.innerHTML = ""; return; }

  const items   = list(data.items);
  const samples = list(data.samples);

  el.innerHTML = `
    ${sectionHead(2, "Services", data)}
    ${items.length
      ? `<div class="service-grid">
           ${items.map((it,i) => {
             if (!it) return "";
             return `
             <div class="service-card reveal" style="transition-delay:${revealDelay(i)};">
               <h4>${esc(pick(it,"title",""))}</h4>
               <p>${esc(pick(it,"desc",""))}</p>
             </div>`;
           }).join("")}
         </div>`
      : emptyState("No services added yet.")}
    ${samples.length
      ? `<div class="service-samples reveal">
           <h4>${esc(pick(data,"samplesHeading","Sample Work"))}</h4>
           <ul>${samples.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
         </div>`
      : ""}
    ${data.note ? `<p class="service-note reveal">${esc(data.note)}</p>` : ""}`;
}

function renderStats(data) {
  const el = document.getElementById("stats");
  if (!el) return;
  if (!data) { el.innerHTML = emptyState("Stats section is missing."); return; }

  const items = list(data.items);

  const statHTML = (item, i) => `
    <div class="stat-item reveal" style="transition-delay:${revealDelay(i)};">
      <div class="stat-img-card" data-img="${esc(item.image)}" onclick="openImageModal(this.dataset.img)">
        <img src="${esc(item.image)}" alt="Analytics screenshot for ${esc(item.title)}">
      </div>
      <div class="stat-info">
        <h3>${esc(item.title)}</h3>
        <p>${esc(item.context)}</p>
      </div>
    </div>
  `;

  el.innerHTML = `
    <div class="section-inner">
      ${sectionHead(3, "By The Numbers", data)}
      ${items.length
        ? `<div class="stats-marquee" id="statsMarquee">
             <div class="stats-track" id="statsTrack">
               ${items.map(statHTML).join("")}
               ${items.map(statHTML).join("")}
             </div>
           </div>`
        : emptyState("No stats screenshots added yet.")}
      ${data.note ? `<p class="service-note reveal" style="margin-top:24px;">${esc(data.note)}</p>` : ""}
    </div>`;
}

function renderTestimonials(data) {
  const el = document.getElementById("testimonials");
  if (!el) return;
  if (!data) { el.innerHTML = ""; return; }

  const items = list(data.items);

  if (!items.length) {
    if (!data.comingSoon) { el.innerHTML = ""; return; }
    el.innerHTML = `
      ${sectionHead(4, "Social Proof", data)}
      <div class="coming-soon-card reveal">
        <span class="coming-soon-badge">New Section — In Progress</span>
        <p>${esc(pick(data,"comingSoonNote","Currently collecting real feedback from clients. Check back soon."))}</p>
      </div>`;
    return;
  }

  el.innerHTML = `
    ${sectionHead(4, "Social Proof", data)}
    <div class="testimonial-grid">
      ${items.map((t,i) => {
        if (!t || !t.quote) return "";
        return `
        <figure class="testimonial-card reveal" style="transition-delay:${revealDelay(i)};">
          <blockquote>&ldquo;${esc(t.quote)}&rdquo;</blockquote>
          <figcaption>
            ${t.name ? `<span class="t-name">${esc(t.name)}</span>` : ""}
            ${t.role ? `<span class="t-role">${esc(t.role)}</span>` : ""}
          </figcaption>
        </figure>`;
      }).join("")}
    </div>`;
}

function renderAbout(data) {
  const el = document.getElementById("about");
  if (!el) return;
  if (!data) { el.innerHTML = emptyState("About section is missing."); return; }

  const paragraphs     = list(data.paragraphs);
  const education      = list(data.education);
  const certifications = list(data.certifications);
  const languages      = list(data.languages);

  const renderPairList = (title, arr) =>
    arr.length
      ? `<h4>${esc(title)}</h4><ul>${arr
          .map((e) => `<li><span>${esc(pick(e,"label",""))}</span><span>${esc(pick(e,"value",""))}</span></li>`)
          .join("")}</ul>`
      : "";

  el.innerHTML = `
    ${sectionHead(7, "About", data)}
    <div class="about-grid">
      <div class="about-copy reveal">
        ${paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}
      </div>
      <div class="about-list reveal" style="transition-delay:120ms;">
        ${renderPairList("Education", education)}
        ${renderPairList("Certifications", certifications)}
        ${renderPairList("Languages", languages)}
      </div>
    </div>`;
}

function renderContact(data) {
  const el       = document.getElementById("contact");
  const footerEl = document.getElementById("footer-root");
  if (!el) return;
  if (!data) { el.innerHTML = emptyState("Contact section is missing."); return; }

  const phoneHref = data.phone ? String(data.phone).replace(/\s+/g, "") : "";

  const metaLinks = [
    data.phone     ? `<a href="tel:${esc(phoneHref)}">${esc(data.phone)}</a>`                                       : "",
    data.linkedin  ? `<a href="${esc(data.linkedin)}"  target="_blank" rel="noopener">LinkedIn</a>`                 : "",
    data.github    ? `<a href="${esc(data.github)}"    target="_blank" rel="noopener">GitHub</a>`                   : "",
    data.tiktok    ? `<a href="${esc(data.tiktok)}"    target="_blank" rel="noopener">TikTok</a>`                   : "",
    data.instagram ? `<a href="${esc(data.instagram)}" target="_blank" rel="noopener">Instagram</a>`               : "",
    data.location  ? `<span>${esc(data.location)}</span>`                                                           : "",
  ].filter(Boolean).join("");

  el.innerHTML = `
    ${sectionHead(8, "Contact", data)}
    <div class="contact-actions reveal" style="transition-delay:80ms;">
      ${data.email    ? `<a href="mailto:${esc(data.email)}" class="btn-primary">SEND ME A MESSAGE  →</a>` : ""}
      ${data.linktree ? `<a href="${esc(data.linktree)}" class="btn-ghost" target="_blank" rel="noopener">All My Socials →</a>` : ""}
    </div>
    ${metaLinks ? `<div class="contact-meta reveal" style="transition-delay:150ms;">${metaLinks}</div>` : ""}
    ${data.availability
      ? `<div class="availability reveal" style="transition-delay:220ms;"><span class="dot-live"></span>${esc(data.availability)}</div>`
      : ""}`;

  if (footerEl) footerEl.innerHTML = esc(pick(data,"footerNote",""));
}

// Interactions

// Scroll spy
function initScrollSpy() {
  const markers = document.querySelectorAll(".marker");
  if (!markers.length) return;

  const sections = [...markers]
    .map((m) => document.querySelector(m.dataset.target))
    .filter(Boolean);

  markers.forEach((m) => {
    m.addEventListener("click", () => {
      const target = document.querySelector(m.dataset.target);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (document.activeElement === m) {
        m.blur();
      }
    });
  });

  if (!sections.length) return;

  function updateActiveNav() {
    const scrollPos = window.scrollY + 120;
    let currentSection = sections[0];

    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      if (s.offsetTop <= scrollPos) {
        currentSection = s;
      }
    }

    markers.forEach((m) => {
      const isActive = m.dataset.target === `#${currentSection.id}`;
      if (isActive) {
        m.classList.add("active");
      } else {
        m.classList.remove("active");
        if (document.activeElement === m) {
          m.blur();
        }
      }
    });
  }

  window.addEventListener("scroll", updateActiveNav, { passive: true });
  updateActiveNav();
}

// Marquee scroll
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

  marquee.addEventListener("mouseenter",  () => { paused = true; });
  marquee.addEventListener("mouseleave",  () => { 
    isDown = false; 
    setTimeout(() => marquee.classList.remove("dragging"), 0);
    clearTimeout(resumeTimer); 
    syncPosFromScroll(); 
    paused = false; 
  });
  marquee.addEventListener("touchstart",  () => { paused = true; }, { passive: true });
  marquee.addEventListener("touchend",    pauseForAWhile, { passive: true });
  marquee.addEventListener("wheel",       pauseForAWhile, { passive: true });

  // Mouse drag to scroll
  let isDown = false;
  let startX;
  let scrollLeftState;

  marquee.addEventListener("mousedown", (e) => {
    isDown = true;
    marquee.classList.remove("dragging");
    paused = true;
    clearTimeout(resumeTimer);
    startX = e.pageX - marquee.offsetLeft;
    scrollLeftState = marquee.scrollLeft;
  });

  marquee.addEventListener("mouseup", () => {
    isDown = false;
    setTimeout(() => marquee.classList.remove("dragging"), 0);
    pauseForAWhile();
  });

  marquee.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    e.preventDefault();
    marquee.classList.add("dragging");
    const x = e.pageX - marquee.offsetLeft;
    const walk = (x - startX) * 1.5;
    marquee.scrollLeft = scrollLeftState - walk;
    syncPosFromScroll();
  });

  if (reduceMotion) return;

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

// Opens the video modal when a work card with video is clicked
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


// Fade-in + slide-up as elements enter the viewport
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
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -6% 0px" }
  );
  els.forEach((el) => observer.observe(el));
}



// Count-up animation for hero stat numbers when they scroll into view
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
          const delay = i * 110; // stagger each card

          // 1. Pop-in animation
          cell.style.animationDelay = `${delay}ms`;
          cell.classList.add("stat-animate");

          if (reduceMotion) return;

          // 2. Count-up the number
          const strong = cell.querySelector("strong");
          if (!strong) return;

          const raw = strong.textContent.trim();
          // Parse e.g. "124M+" → num=124, suffix="M+"
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

// Section wrapper: catches render errors gracefully
function renderSection(name, fn, data) {
  try {
    fn(data);
  } catch (err) {
    console.error(`Failed to render "${name}":`, err);
    const id  = name === "hero" ? "home" : name;
    const el  = document.getElementById(id);
    if (el) el.innerHTML = emptyState(`This section couldn't be displayed (check data/${name}.json).`);
  }
}

// interactive effects

// Magnetic Buttons
function initMagneticButtons() {
  const magnets = document.querySelectorAll(".marker, .btn-primary, .btn-ghost, .gh-link, .contact-meta a");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  magnets.forEach((btn) => {
    btn.addEventListener("mousemove", (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const moveX = (x - centerX) * 0.2;
      const moveY = (y - centerY) * 0.3;
      
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

// 3D Card Hover Tilt
function initCardTilt() {
  const cards = document.querySelectorAll(".case-card, .service-card, .dev-card, .tool-card");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  cards.forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = ((y - centerY) / centerY) * -3.5;
      const rotateY = ((x - centerX) / centerX) * 3.5;
      
      card.classList.add("tilting");
      card.style.setProperty("--rx", rotateX + "deg");
      card.style.setProperty("--ry", rotateY + "deg");
      card.style.setProperty("--s", "1.015");
    });
    
    card.addEventListener("mouseleave", () => {
      card.classList.remove("tilting");
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
      card.style.setProperty("--s", "1");
    });
  });
}

// Phase 2: Interactivity Updates
function initScrollVelocitySkew() {
  const skewElements = document.querySelectorAll("h1, h2, .section-head h3");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || !skewElements.length) return;

  skewElements.forEach(el => el.classList.add("velocity-skew"));

  let lastScrollY = window.scrollY;
  let currentScrollY = window.scrollY;
  let skew = 0;

  function loop() {
    currentScrollY = window.scrollY;
    const delta = currentScrollY - lastScrollY;
    
    // Calculate target skew based on scroll velocity (max 5 deg)
    const targetSkew = Math.min(Math.max(delta * 0.05, -5), 5); 
    
    // Lerp for smoothness
    skew += (targetSkew - skew) * 0.1;
    
    if (Math.abs(skew) > 0.01) {
      skewElements.forEach(el => el.style.setProperty("--skew", skew + "deg"));
    } else if (skew !== 0) {
      skew = 0;
      skewElements.forEach(el => el.style.setProperty("--skew", "0deg"));
    }
    
    lastScrollY = currentScrollY;
    requestAnimationFrame(loop);
  }
  
  requestAnimationFrame(loop);
}

function initTextScramble() {
  const headers = document.querySelectorAll("h2, .section-head h3");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || !headers.length) return;

  const chars = "!<>-_\\\\/[]{}—=+*^?#________";
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      // Only trigger once per header
      if (entry.isIntersecting && !entry.target.hasAttribute('data-scrambled')) {
        entry.target.setAttribute('data-scrambled', 'true');
        entry.target.classList.add("scramble-text");
        
        const originalText = entry.target.innerText;
        let iteration = 0;
        
        clearInterval(entry.target.scrambleInterval);
        
        entry.target.scrambleInterval = setInterval(() => {
          entry.target.innerText = originalText
            .split("")
            .map((letter, index) => {
              if (index < iteration) return originalText[index];
              // Don't scramble spaces so word wrapping doesn't jump crazily
              if (originalText[index] === " ") return " ";
              return chars[Math.floor(Math.random() * chars.length)];
            })
            .join("");
          
          if (iteration >= originalText.length) {
            clearInterval(entry.target.scrambleInterval);
            entry.target.innerText = originalText;
          }
          
          // Speed up significantly based on string length so long sentences don't take forever
          iteration += Math.max(1.5, originalText.length / 10);
        }, 25);
      }
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -10% 0px" });

  headers.forEach(h => observer.observe(h));
}

function initParallaxHero() {
  // Wrap hero children in .hero-content if not already
  const heroContent = document.querySelector(".hero-content") || document.querySelector(".hero > .container");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || !heroContent) return;

  heroContent.classList.add("hero-content");

  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    if (y < window.innerHeight) {
      heroContent.style.setProperty("--hero-y", (y * 0.4) + "px");
    }
  }, { passive: true });
}

// Init

async function init() {
  const { data, failed } = await loadData();

  renderSection("nav",          renderNav,          data.nav);
  renderSection("hero",         renderHero,         data.hero);
  initStatCounters();
  renderSection("work",         renderWork,         data.work);
  initWorkVideos();
  initMarquee("workMarquee", "workTrack", 0.38);
  renderSection("services",     renderServices,     data.services);
  renderSection("stats",        renderStats,        data.stats);
  initMarquee("statsMarquee", "statsTrack", 0.20);
  renderSection("testimonials", renderTestimonials, data.testimonials);
  renderSection("about",        renderAbout,        data.about);
  renderSection("contact",      renderContact,      data.contact);

  initScrollSpy();
  initScrollReveal();
  initMagneticButtons();
  initCardTilt();
  
  // Phase 2 Interactive Effects
  initScrollVelocitySkew();
  initTextScramble();
  initParallaxHero();

  if (failed.length === Object.keys(DATA_FILES).length) {
    document.body.innerHTML = `
      <div class="load-msg error">
        I couldn't load my site content.<br>
        Please run this via a local server (like VS Code Live Server) instead of opening the file directly.
      </div>`;
  } else if (failed.length) {
    console.warn("Some sections failed to load:", failed.join(", "));
  }
}

// Modal
const imageModal = document.getElementById("imageModal");
const imageModalImg = document.getElementById("imageModalImg");

function openImageModal(src) {
  if (!imageModal || !imageModalImg) return;
  imageModalImg.src = src;
  imageModal.classList.add("open");
  imageModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeImageModal() {
  if (!imageModal || !imageModalImg) return;
  imageModal.classList.remove("open");
  imageModal.setAttribute("aria-hidden", "true");
  setTimeout(() => { imageModalImg.src = ""; }, 300);
  document.body.style.overflow = "";
}

document.addEventListener("click", (e) => {
  if (e.target.matches("[data-img-close]")) {
    closeImageModal();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && imageModal && imageModal.classList.contains("open")) {
    closeImageModal();
  }
});

init();