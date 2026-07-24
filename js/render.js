// render.js — all section render functions (depends on data.js)

/* ── Nav ── */
function renderNav(data) {
  const el = document.getElementById("nav-root");
  if (!el) return;
  const items = list(data && data.items);
  if (!items.length) { el.innerHTML = ""; return; }

  const brand = esc(pick(data, "brand", "MG"));
  // Bold the last name part
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
      <button class="theme-toggle-btn" id="themeToggleBtn" aria-label="Toggle light or dark theme" title="Switch Theme">
        <svg class="sun-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        <svg class="moon-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </button>
    </div>`;

  // Mobile nav toggle logic
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
        if (!timelineNav.contains(e.target)) timelineNav.classList.remove("nav-expanded");
      });
    }

    // Magnetic nav CTA
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

/* ── Hero ── */
function renderHero(data) {
  const el = document.getElementById("home");
  if (!el) return;
  if (!data) { el.innerHTML = emptyState("Hero content is missing."); return; }

  const stats        = list(data.stats);
  const ctaPrimary   = data.ctaPrimary   || {};
  const ctaSecondary = data.ctaSecondary || {};

  // Build marquee items, repeated for seamless loop
  const rawMarquee = list(data.marquee);
  const marqueeItems = rawMarquee.length
    ? rawMarquee
    : ["WEB DEVELOPMENT", "VIDEO EDITING", "VIRTUAL ASSISTANT", "CONTENT OPERATIONS", "CONTENT STRATEGY"];

  const itemHTML = (item) =>
    `<span>${esc(item)}</span><span class="m-sep">✦</span>`;

  let groupItems = [];
  for (let i = 0; i < 4; i++) groupItems = groupItems.concat(marqueeItems);

  const groupContent = groupItems.map(itemHTML).join("");
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
          <span class="line"><span class="accent">${esc(pick(data, "nameLine2", "GENEROSO"))}</span></span>
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

/* ── Work ── */
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
      : emptyState("No work added yet.")}
    <div class="section-cta reveal">
      <span class="section-cta-text">Have a video or web project in mind?</span>
      <a href="#contact" class="btn-ghost section-cta-btn">Start a Project →</a>
    </div>`;
}

/* ── Services ── */
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
    ${data.note ? `<p class="service-note reveal">${esc(data.note)}</p>` : ""}
    <div class="section-cta reveal">
      <span class="section-cta-text">Need custom web development or video production?</span>
      <a href="#contact" class="btn-ghost section-cta-btn">Request a Quote →</a>
    </div>`;
}

/* ── Skills / Toolkit ── */
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
      <div class="section-cta reveal">
        <span class="section-cta-text">Looking for a specific tech stack or software workflow?</span>
        <a href="#contact" class="btn-ghost section-cta-btn">Inquire About Stack →</a>
      </div>
    </div>`;
}

/* ── Dev / Also Builds ── */
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
      <div class="section-cta reveal">
        <span class="section-cta-text">Need a full-stack developer for your app or web tool?</span>
        <a href="#contact" class="btn-ghost section-cta-btn">Let's Build It →</a>
      </div>
    </div>`;
}

/* ── Stats (By The Numbers) ── */
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
      <div class="section-cta reveal">
        <span class="section-cta-text">Want to scale your brand's video reach to millions?</span>
        <a href="#contact" class="btn-ghost section-cta-btn">Scale Your Content →</a>
      </div>
    </div>`;
}

/* ── Testimonials ── */
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

/* ── About ── */
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
    </div>
    <div class="section-cta reveal">
      <span class="section-cta-text">Want to review my full credentials or discuss a role?</span>
      <div style="display:inline-flex; gap:10px; flex-wrap:wrap; align-items:center;">
        ${data.resume ? `<button class="btn-ghost section-cta-btn" onclick="openResumeModal('${esc(data.resume)}')">View CV (PDF) ↗</button>` : ""}
        <a href="#contact" class="btn-primary section-cta-btn">Get In Touch →</a>
      </div>
    </div>`;
}

/* ── Contact ── */
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

/* ── Render Error Wrapper ── */
// Catches individual section errors without breaking the whole page
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
