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
      <div class="nav-highlighter" id="navHighlighter"></div>
      <span class="tl-brand">${brandHTML}</span>
      <button class="mobile-nav-toggle" id="mobileNavToggle" aria-label="Toggle Menu">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        <span>Menu</span>
      </button>
      <div class="nav-links-wrap" id="navLinksWrap">
        ${items
          .map((item) => {
            if (!item || !item.target || !item.label) return "";
            return `
          <button class="marker" data-target="${esc(item.target)}">
            <span class="label">${esc(item.label)}</span>
          </button>`;
          })
          .join("")}
      </div>
      ${data.cta ? `<a href="${esc(data.cta.target)}" class="btn-primary nav-cta" style="margin-left:auto; font-size:12px; padding:8px 16px;">${esc(data.cta.label)}</a>` : ""}
    </div>`;

  // Mobile Nav Toggle Logic
  setTimeout(() => {
    const mobileNavToggle = document.getElementById("mobileNavToggle");
    const timelineNav = document.querySelector(".timeline-nav");
    
    if (mobileNavToggle && timelineNav) {
      mobileNavToggle.addEventListener("click", () => {
        timelineNav.classList.toggle("nav-expanded");
      });
      
      const markers = timelineNav.querySelectorAll(".marker");
      markers.forEach(m => {
        m.addEventListener("click", () => timelineNav.classList.remove("nav-expanded"));
      });

      document.addEventListener("click", (e) => {
        if (!timelineNav.contains(e.target)) {
          timelineNav.classList.remove("nav-expanded");
        }
      });
    }

    // Magnetic CTA Button
    const navCta = timelineNav ? timelineNav.querySelector(".nav-cta") : null;
    if (navCta) {
      navCta.addEventListener("mousemove", (e) => {
        const rect = navCta.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        navCta.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
      });
      navCta.addEventListener("mouseleave", () => {
        navCta.style.transform = `translate(0px, 0px)`;
      });
    }
  }, 0);
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
      ? `<div class="marquee-wrapper">
           <button class="nav-arrow nav-arrow-left" aria-label="Scroll left">←</button>
           <div class="case-marquee" id="workMarquee">
             <div class="case-track" id="workTrack">
               ${items.map(cardHTML).join("")}
               ${items.map(cardHTML).join("")}
             </div>
           </div>
           <button class="nav-arrow nav-arrow-right" aria-label="Scroll right">→</button>
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

function renderSkills(data) {
  const el = document.getElementById("skills");
  if (!el) return;
  if (!data) { el.innerHTML = emptyState("Skills section is missing."); return; }

  const groups = list(data.groups);

  el.innerHTML = `
    <div class="section-inner">
      ${sectionHead(3, "Toolkit", data)}
      <div class="toolkit-grid">
        ${groups.map((g, i) => `
          <div class="tool-card reveal" style="transition-delay:${revealDelay(i)};">
            <h4>${esc(g.title)}</h4>
            <ul>
              ${list(g.items).map(item => `<li>${esc(item)}</li>`).join("")}
            </ul>
          </div>
        `).join("")}
      </div>
    </div>`;
}

function renderDev(data) {
  const el = document.getElementById("dev");
  if (!el) return;
  if (!data) { el.innerHTML = ""; return; }

  const projects = list(data.projects);
  if (!projects.length) { el.innerHTML = ""; return; }

  el.innerHTML = `
    <div class="section-inner">
      ${sectionHead(4, "Also Builds", data)}
      <div class="dev-section reveal">
        <div class="dev-inner">
          ${data.githubUrl ? `<div class="dev-gh-row"><a href="${esc(data.githubUrl)}" target="_blank" rel="noopener" class="gh-link">${esc(pick(data, "githubLabel", "GitHub →"))}</a></div>` : ""}
          <div class="dev-grid">
            ${projects.map((p, i) => `
              <div class="dev-card reveal" style="transition-delay:${revealDelay(i)};">
                ${p.stack ? `<div class="stack">${esc(p.stack)}</div>` : ""}
                <h4>${esc(p.title)}</h4>
                <p>${esc(p.desc)}</p>
                <div class="dev-card-links">
                  ${p.repoUrl ? `<a href="${esc(p.repoUrl)}" target="_blank" rel="noopener">Repo →</a>` : ""}
                  ${p.liveUrl ? `<a href="${esc(p.liveUrl)}" target="_blank" rel="noopener">Live →</a>` : ""}
                </div>
              </div>`).join("")}
          </div>
        </div>
      </div>
    </div>`;
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
      ${sectionHead(4, "By The Numbers", data)}
      ${items.length
        ? `<div class="marquee-wrapper">
             <button class="nav-arrow nav-arrow-left" aria-label="Scroll left" onclick="document.getElementById('statsMarquee').scrollBy({left: -682, behavior: 'smooth'})">←</button>
             <div class="stats-marquee" id="statsMarquee">
               <div class="stats-track" id="statsTrack">
                 ${items.map(statHTML).join("")}
               </div>
             </div>
             <button class="nav-arrow nav-arrow-right" aria-label="Scroll right" onclick="document.getElementById('statsMarquee').scrollBy({left: 682, behavior: 'smooth'})">→</button>
             <div class="swipe-indicator"><span>← Swipe to explore →</span></div>
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
      ${sectionHead(5, "Social Proof", data)}
      <div class="coming-soon-card reveal">
        <span class="coming-soon-badge">New Section — In Progress</span>
        <p>${esc(pick(data,"comingSoonNote","Currently collecting real feedback from clients. Check back soon."))}</p>
      </div>`;
    return;
  }

  el.innerHTML = `
    ${sectionHead(5, "Social Proof", data)}
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

  const hasSidebar = education.length || certifications.length || languages.length;

  el.innerHTML = `
    ${sectionHead(7, "About", data)}
    <div class="about-body${hasSidebar ? "" : " about-body--full"}">
      <div class="about-points reveal">
        ${paragraphs.map((p, i) => `
          <div class="about-point" style="transition-delay:${i * 60}ms;">
            <span class="about-point-num">${String(i + 1).padStart(2, "0")}</span>
            <p>${esc(p)}</p>
          </div>`).join("")}
      </div>
      ${hasSidebar ? `
      <aside class="about-sidebar reveal" style="transition-delay:180ms;">
        ${renderPairList("Languages", languages)}
        ${renderPairList("Education", education)}
        ${renderPairList("Certifications", certifications)}
      </aside>` : ""}
    </div>`;
}

function renderContact(data) {
  const el       = document.getElementById("contact");
  const footerEl = document.getElementById("footer-root");
  if (!el) return;
  if (!data) { el.innerHTML = emptyState("Contact section is missing."); return; }

  const phoneHref = data.phone ? String(data.phone).replace(/\s+/g, "") : "";

  const socialLinks = [
    data.linkedin  ? `<a href="${esc(data.linkedin)}"  target="_blank" rel="noopener" class="social-btn" title="LinkedIn" aria-label="LinkedIn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg></a>` : "",
    data.github    ? `<a href="${esc(data.github)}"    target="_blank" rel="noopener" class="social-btn" title="GitHub" aria-label="GitHub"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg></a>` : "",
    data.facebook  ? `<a href="${esc(data.facebook)}"  target="_blank" rel="noopener" class="social-btn" title="Facebook" aria-label="Facebook"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>` : "",
    data.instagram ? `<a href="${esc(data.instagram)}" target="_blank" rel="noopener" class="social-btn" title="Instagram" aria-label="Instagram"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>` : "",
    data.tiktok    ? `<a href="${esc(data.tiktok)}"    target="_blank" rel="noopener" class="social-btn" title="TikTok" aria-label="TikTok"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 1 1-5.2-1.74 2.89 2.89 0 0 1 2.31-1.4V8.95a6.34 6.34 0 0 0-5.11 6.2 6.34 6.34 0 1 0 11.45-3.8V8.75a8.28 8.28 0 0 0 4.77 1.49V6.75a4.85 4.85 0 0 1-1-.06z"/></svg></a>` : "",
    data.threads   ? `<a href="${esc(data.threads)}"   target="_blank" rel="noopener" class="social-btn" title="Threads" aria-label="Threads"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24.004c-3.149 0-5.882-1.026-7.727-2.889C2.46 19.103 1.5 16.035 1.5 12.33 1.5 8.784 2.477 5.86 4.41 3.927 6.344 1.993 9.176 1 12.84 1c3.81 0 6.786 1.05 8.845 3.12 1.83 1.84 2.81 4.47 2.81 7.52 0 3.03-.89 5.56-2.58 7.33-1.63 1.7-3.9 2.56-6.75 2.56-2.6 0-4.66-.75-5.96-2.17-1.25-1.37-1.78-3.21-1.54-5.32.25-2.22 1.34-4.05 3.15-5.29 1.76-1.2 4.09-1.73 6.94-1.57.17.01.35.02.52.04.01-.76-.08-1.42-.28-1.97-.48-1.34-1.75-2.02-3.77-2.02-1.63 0-3.05.35-4.23 1.04l-.84-1.72C10.74 1.46 12.78 1 14.94 1c3.08 0 5.16.92 6.19 2.74.52.92.76 2.05.74 3.36l-.01 5.92c0 1.25.13 2.14.39 2.65l-1.92.83c-.3-.6-.44-1.52-.45-2.77-.92 1.15-2.04 1.98-3.35 2.48-1.3.5-2.72.75-4.23.75zm1.19-9.15c-1.97-.11-3.52.24-4.61 1.04-.98.72-1.52 1.76-1.64 3.01-.13 1.31.2 2.4.98 3.18.78.78 1.97 1.18 3.54 1.18 1.86 0 3.33-.55 4.38-1.64 1.06-1.1 1.59-2.64 1.59-4.57v-.55c-.17-.03-.35-.06-.54-.08-1.2-.14-2.54-.26-3.7-.57z"/></svg></a>` : "",
  ].filter(Boolean).join("");

  const infoPills = [
    data.phone    ? `<a href="tel:${esc(phoneHref)}" class="info-pill"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> ${esc(data.phone)}</a>` : "",
    data.location ? `<span class="info-pill"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ${esc(data.location)}</span>` : "",
  ].filter(Boolean).join("");

  el.innerHTML = `
    ${sectionHead(8, "Contact", data)}
    <div class="contact-actions reveal" style="transition-delay:80ms;">
      ${data.email    ? `<a href="mailto:${esc(data.email)}" class="btn-primary">EMAIL ME →</a>` : ""}
      ${data.resume   ? `<button class="btn-ghost" onclick="openResumeModal('${esc(data.resume)}')">VIEW CV</button>` : ""}
    </div>
    <div class="time-widget reveal" id="timeWidget" style="transition-delay:120ms;"></div>
    <div class="contact-meta reveal" style="transition-delay:150ms;">
      ${socialLinks ? `<div class="social-links">${socialLinks}</div>` : ""}
      ${infoPills   ? `<div class="contact-info-pills">${infoPills}</div>` : ""}
    </div>
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
    m.addEventListener("mouseleave", () => {
      if (activeMarker) moveHighlighter(activeMarker);
    });
  });

  function updateActiveNav() {
    const scrollPos = window.scrollY + 120;
    let currentSection = sections[0];

    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      if (s.offsetTop <= scrollPos) {
        currentSection = s;
      }
    }

    // Force active state to last section if scrolled to the very bottom
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 10) {
      currentSection = sections[sections.length - 1];
    }

    markers.forEach((m) => {
      const isActive = m.dataset.target === `#${currentSection.id}`;
      if (isActive) {
        m.classList.add("active");
        activeMarker = m;
        if (!track.matches(":hover")) {
          moveHighlighter(m);
        }
      } else {
        m.classList.remove("active");
        if (document.activeElement === m) {
          m.blur();
        }
      }
    });
  }

  window.addEventListener("scroll", updateActiveNav, { passive: true });
  
  // Need to wait slightly for layout to be ready for initial highlight
  setTimeout(updateActiveNav, 100);
  window.addEventListener("resize", () => {
    if (activeMarker) moveHighlighter(activeMarker);
  });
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

  // Nav Arrows
  const wrapper = marquee.closest('.marquee-wrapper');
  if (wrapper) {
    const scrollAmount = marqueeId === 'statsMarquee' ? 650 : 340;
    const leftBtn = wrapper.querySelector('.nav-arrow-left');
    const rightBtn = wrapper.querySelector('.nav-arrow-right');
    
    if (leftBtn) {
      leftBtn.addEventListener('click', () => {
        marquee.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        pauseForAWhile();
      });
    }
    if (rightBtn) {
      rightBtn.addEventListener('click', () => {
        marquee.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        pauseForAWhile();
      });
    }
  }

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
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        } else {
          entry.target.classList.remove("is-visible");
        }
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
  const magnets = document.querySelectorAll(".marker, .btn-primary, .btn-ghost, .gh-link, .contact-meta a, .timeline-nav a");
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

// Spotlight Flashlight Cards
function initSpotlightCards() {
  const cards = document.querySelectorAll(".case-card, .service-card, .dev-card");
  cards.forEach(card => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty("--mouse-x", `${x}px`);
      card.style.setProperty("--mouse-y", `${y}px`);
    });
  });
}

function initClock() {
  // Clock widget removed as requested
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
      card.style.setProperty("--x", x + "px");
      card.style.setProperty("--y", y + "px");
    });
    
    card.addEventListener("mouseleave", () => {
      card.classList.remove("tilting");
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
      card.style.setProperty("--s", "1");
    });
  });
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
  initLoader();
  const { data, failed } = await loadData();

  renderSection("nav",          renderNav,          data.nav);
  renderSection("hero",         renderHero,         data.hero);
  initStatCounters();
  renderSection("work",         renderWork,         data.work);
  initWorkVideos();
  initMarquee("workMarquee", "workTrack", 0.38);
  renderSection("services",     renderServices,     data.services);
  renderSection("skills",       renderSkills,       data.skills);
  renderSection("stats",        renderStats,        data.stats);
  renderSection("testimonials", renderTestimonials, data.testimonials);
  renderSection("about",        renderAbout,        data.about);
  renderSection("dev",          renderDev,          data.dev);
  renderSection("contact",      renderContact,      data.contact);

  initScrollSpy();
  initScrollReveal();
  initMagneticButtons();
  initCardTilt();
  
  // Phase 2 Interactive Effects
  initParallaxHero();

  // Phase 3 Creative Effects
  initCustomCursor();
  initScrollProgress();
  initCursorGlow();
  initTimeWidget();
  initStaggeredText();
  initSoundDesign();
  initDynamicTitle();
  initSpotlightCards();
  initClock();

  // Scroll Progress for CV Knob
  window.addEventListener("scroll", () => {
    const scrollPx = document.documentElement.scrollTop;
    const winHeight = document.documentElement.clientHeight;
    const docHeight = document.documentElement.scrollHeight;
    const progress = scrollPx / (docHeight - winHeight);
    document.documentElement.style.setProperty("--scroll-progress", progress * 100 + "%");
  }, { passive: true });
  initDeveloperMode();
  initMinimap();
  initPullString(data);

  dismissLoader();

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

// Resume Modal
const resumeModal = document.getElementById("resumeModal");
const resumeModalIframe = document.getElementById("resumeModalIframe");
const resumeDownloadBtn = document.getElementById("resumeDownloadBtn");
const resumeFallbackBtn = document.getElementById("resumeFallbackBtn");

window.openResumeModal = function(src) {
  if (!resumeModal || !resumeModalIframe) return;

  // Build the absolute URL (needed for Google Docs Viewer)
  const absoluteUrl = new URL(src, window.location.href).href;

  // Detect mobile/tablet — iOS Safari and Android Chrome don't support inline PDF iframes
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    // Google Docs Viewer renders PDFs inline on mobile without forcing a download
    const gdocsUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(absoluteUrl)}`;
    resumeModalIframe.src = gdocsUrl;
  } else {
    resumeModalIframe.src = src + "#toolbar=0";
  }

  if (resumeDownloadBtn) resumeDownloadBtn.href = src;
  if (resumeFallbackBtn) resumeFallbackBtn.href = src;

  resumeModal.classList.add("open");
  resumeModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeResumeModal() {
  if (!resumeModal || !resumeModalIframe) return;
  resumeModal.classList.remove("open");
  resumeModal.setAttribute("aria-hidden", "true");
  setTimeout(() => { resumeModalIframe.src = ""; }, 300);
  document.body.style.overflow = "";
}

document.addEventListener("click", (e) => {
  if (e.target.matches("[data-resume-close]")) {
    closeResumeModal();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && resumeModal && resumeModal.classList.contains("open")) {
    closeResumeModal();
  }
});

// ── Loading Screen ───────────────────────────────────────────────────────────

function initLoader() {
  const bar = document.getElementById("loaderBar");
  if (!bar) return;
  // Start filling the bar artificially while data loads
  bar.style.width = "40%";
  setTimeout(() => {
    if (bar.style.width !== "100%") bar.style.width = "75%";
  }, 600);
}

function dismissLoader() {
  const loader = document.getElementById("loader");
  const bar = document.getElementById("loaderBar");
  if (!loader) return;
  
  setTimeout(() => {
    if (bar) bar.style.width = "100%";
    
    setTimeout(() => {
      // Restore scroll position right before the loader fades out
      const savedScroll = sessionStorage.getItem("merwin_scroll_pos");
      if (savedScroll !== null) {
        window.scrollTo(0, parseInt(savedScroll, 10));
      }

      loader.classList.add("is-hidden");
      
      setTimeout(() => loader.remove(), 850);
    }, 450);
  }, 1200);
}

// Ensure the browser doesn't try to native-scroll while the page is still 0px tall
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

window.addEventListener("beforeunload", () => {
  sessionStorage.setItem("merwin_scroll_pos", window.scrollY);
});

// ── Creative Effects ─────────────────────────────────────────────────────────

// 0. Staggered Text Reveal
function initStaggeredText() {
  const paragraphs = document.querySelectorAll(".about-point p, .contact p");
  if (!paragraphs.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      }
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

// 0.5 Time Widget
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

// 0.75 Sound Design
function initSoundDesign() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  
  const ctx = new AudioContext();
  
  function playTick() {
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.05);
    
    // very low volume
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.06);
  }

  const interactives = document.querySelectorAll(".marker, .btn-primary, .btn-ghost, .gh-link, .contact-meta a, .timeline-nav a");
  interactives.forEach(el => {
    el.addEventListener("mouseenter", playTick);
  });
}

// 0.85 Dynamic Tab Title
function initDynamicTitle() {
  const originalTitle = document.title;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      document.title = "👀 Miss you! - Merwin";
    } else {
      document.title = originalTitle;
    }
  });
}

// 0.95 Secret Developer Mode
function initDeveloperMode() {
  let buffer = "";
  document.addEventListener("keydown", (e) => {
    buffer += e.key.toLowerCase();
    if (buffer.length > 5) buffer = buffer.slice(-5);
    if (buffer.includes("dev")) {
      document.body.classList.toggle("dev-mode");
      buffer = "";
      
      // Play a little beep sound if AudioContext is available
      if (window.AudioContext || window.webkitAudioContext) {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.type = "square";
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      }
    }
  });
}

// 0.98 Section Minimap Scrollbar
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
  
  targets.forEach((sec, i) => {
    const dot = document.createElement("div");
    dot.className = "minimap-dot";
    dot.addEventListener("click", () => {
      sec.scrollIntoView({ behavior: "smooth" });
    });
    track.appendChild(dot);
  });
  
  minimap.appendChild(track);
  document.body.appendChild(minimap);

  const dots = track.querySelectorAll(".minimap-dot");

  const observer = new IntersectionObserver((entries) => {
    let activeIndex = -1;
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        activeIndex = targets.indexOf(entry.target);
      }
    });
    
    if (activeIndex !== -1) {
      dots.forEach((dot, i) => dot.classList.toggle("active", i === activeIndex));
      const activeDot = dots[activeIndex];
      if (activeDot) {
        // center the indicator over the dot
        indicator.style.top = (activeDot.offsetTop + (activeDot.offsetHeight / 2) - 8) + "px";
      }
    }
  }, { threshold: 0.2 });

  targets.forEach(t => observer.observe(t));
}

// 0.99 Physics-Based Resume Pull String
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

  let isDragging = false;
  let startY = 0, currentY = 0;
  let startX = 0, currentX = 0;
  const maxPull = 120; 
  const baseHeight = 100;

  const onDown = (e) => {
    isDragging = true;
    const evt = e.touches ? e.touches[0] : e;
    startY = evt.clientY;
    startX = evt.clientX;
    wrap.style.transition = "none";
    string.style.transition = "none";
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
    
    if (currentY > 50) {
      window.open(resumeUrl, "_blank");
    }

    wrap.style.transition = "transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)";
    string.style.transition = "height 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)";
    wrap.style.transform = "rotate(0deg)";
    string.style.height = baseHeight + "px";
    currentY = 0;
    currentX = 0;
  };

  wrap.addEventListener("mousedown", onDown);
  wrap.addEventListener("touchstart", onDown, {passive: true});
  window.addEventListener("mousemove", onMove);
  window.addEventListener("touchmove", onMove, {passive: true});
  window.addEventListener("mouseup", onUp);
  window.addEventListener("touchend", onUp);
}

// 1. Custom Cursor (desktop/mouse only)
function initCustomCursor() {
  const dot  = document.getElementById("cursorDot");
  const ring = document.getElementById("cursorRing");
  if (!dot || !ring) return;

  // Only activate on devices with a fine pointer (mouse, not touch)
  if (!window.matchMedia("(pointer: fine)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  document.body.classList.add("custom-cursor-active");

  let ringX = 0, ringY = 0;
  let dotX  = 0, dotY  = 0;
  let raf;

  document.addEventListener("mousemove", (e) => {
    dotX  = e.clientX;
    dotY  = e.clientY;
    dot.style.left = dotX + "px";
    dot.style.top  = dotY + "px";
  });

  function animateCursor() {
    // Ring follows the dot quickly and smoothly
    ringX += (dotX - ringX) * 0.45;
    ringY += (dotY - ringY) * 0.45;

    ring.style.left = ringX + "px";
    ring.style.top  = ringY + "px";
    raf = requestAnimationFrame(animateCursor);
  }
  raf = requestAnimationFrame(animateCursor);

  // Hover state on interactive elements
  const interactives = "a, button, [onclick], input, textarea, .case-frame, .stat-img-card, .marker";
  document.addEventListener("mouseover", (e) => {
    if (e.target.closest(interactives)) {
      dot.classList.add("is-hovering");
      ring.classList.add("is-hovering");
    }
  });
  document.addEventListener("mouseout", (e) => {
    if (e.target.closest(interactives)) {
      dot.classList.remove("is-hovering");
      ring.classList.remove("is-hovering");
    }
  });

  // Click state
  document.addEventListener("mousedown", () => {
    dot.classList.add("is-clicking");
    ring.classList.add("is-clicking");
  });
  document.addEventListener("mouseup", () => {
    dot.classList.remove("is-clicking");
    ring.classList.remove("is-clicking");
  });

  // Hide when leaving window
  document.addEventListener("mouseleave", () => {
    dot.style.opacity  = "0";
    ring.style.opacity = "0";
  });
  document.addEventListener("mouseenter", () => {
    dot.style.opacity  = "1";
    ring.style.opacity = "1";
  });
}

// 2. Scroll Progress Bar
function initScrollProgress() {
  const bar = document.getElementById("scrollProgress");
  if (!bar) return;
  window.addEventListener("scroll", () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = pct + "%";
  }, { passive: true });
}


// 4. Mouse-tracking spotlight glow
function initCursorGlow() {
  const glow = document.querySelector(".bg-cursor-glow");
  if (!glow) return;
  if (!window.matchMedia("(pointer: fine)").matches) return;

  let glowX = window.innerWidth / 2;
  let glowY = window.innerHeight / 2;
  let currentX = glowX, currentY = glowY;

  document.addEventListener("mousemove", (e) => {
    glowX = e.clientX;
    glowY = e.clientY;
    glow.style.opacity = "1";
  }, { passive: true });

  function animateGlow() {
    currentX += (glowX - currentX) * 0.06;
    currentY += (glowY - currentY) * 0.06;
    glow.style.transform = `translate(${currentX - 250}px, ${currentY - 250}px)`;
    requestAnimationFrame(animateGlow);
  }
  animateGlow();
}

init();