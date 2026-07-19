// main.js
// Loads content from /data/*.json and renders each section.
// To change site content, just edit the JSON files — no need to touch this file.
// If a JSON file is missing/broken, that section just shows a fallback message instead of breaking the page.

const DATA_FILES = {
  nav: "data/nav.json",
  hero: "data/hero.json",
  work: "data/work.json",
  stats: "data/stats.json",
  skills: "data/skills.json",
  dev: "data/dev.json",
  about: "data/about.json",
  contact: "data/contact.json",
};

// helper functions

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
  return `${Math.min(i, 7) * 70}ms`;
}

// fetch all the JSON data files

async function loadData() {
  const results = await Promise.allSettled(
    Object.entries(DATA_FILES).map(async ([key, path]) => {
      const res = await fetch(path, { cache: "no-store" });
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

// render functions - one per section

function renderNav(data) {
  const el = document.getElementById("nav-root");
  if (!el) return;
  const items = list(data && data.items);

  if (!items.length) {
    el.innerHTML = "";
    return;
  }

  el.innerHTML = `
    <div class="timeline-track" id="timelineTrack">
      <span class="tl-brand">${esc(pick(data, "brand", "Portfolio"))}</span>
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

  const f = data.frame || {};
  const image = f.image || null;
  const frameStyle = image ? ` style="background-image:url('${esc(image)}');"` : "";
  const stats = list(data.stats);
  const ctaPrimary = data.ctaPrimary || {};
  const ctaSecondary = data.ctaSecondary || {};

  const link = f.linkUrl || null;
  const frameTag = link ? "a" : "div";
  const frameLinkAttrs = link
    ? ` href="${esc(link)}" target="_blank" rel="noopener" aria-label="Watch on TikTok"`
    : "";

  el.innerHTML = `
    <${frameTag} class="hero-frame reveal"${frameStyle}${frameLinkAttrs}>
      <div class="frame-chrome-top">
        <span class="rec-dot"></span> ${esc(pick(f, "recLabel", "REC"))} &nbsp;·&nbsp; ${esc(pick(f, "ratio", ""))} &nbsp;·&nbsp; ${esc(pick(f, "handle", ""))}
      </div>
      <div class="frame-body">
        ${image ? "" : `<div class="initials">${esc(pick(f, "initials", ""))}</div>`}
        <p class="frame-tagline">${image ? "" : esc(pick(f, "placeholderNote", ""))}</p>
      </div>
      <div class="frame-chrome-bottom">
        <div class="scrubber"><div class="scrubber-fill" style="width:${Number(f.scrubberPercent) || 0}%;"></div></div>
        <div class="frame-tc"><span>${esc(pick(f, "tcStart", "00:00:00:00"))}</span><span>${esc(pick(f, "tcEnd", "00:00:00:00"))}</span></div>
      </div>
    </${frameTag}>
    <div class="hero-copy reveal" style="transition-delay:120ms;">
      <span class="eyebrow">${esc(pick(data, "eyebrow", ""))}</span>
      <h1>${esc(pick(data, "nameLine1", ""))}<br>${esc(pick(data, "nameLine2Start", ""))}<span>${esc(pick(data, "nameLine2Accent", ""))}</span></h1>
      <p class="hero-sub">${esc(pick(data, "tagline", ""))}</p>
      <div class="hero-cta">
        ${ctaPrimary.label ? `<a href="${esc(pick(ctaPrimary, "href", "#"))}" class="btn-primary">${esc(ctaPrimary.label)}</a>` : ""}
        ${ctaSecondary.label ? `<a href="${esc(pick(ctaSecondary, "href", "#"))}" class="btn-ghost">${esc(ctaSecondary.label)}</a>` : ""}
      </div>
      ${stats.length
        ? `<div class="hero-stats">
            ${stats
              .map((s) => `<div><strong>${esc(pick(s, "value", "—"))}</strong><span>${esc(pick(s, "label", ""))}</span></div>`)
              .join("")}
          </div>`
        : ""}
    </div>`;
}

function renderWork(data) {
  const el = document.getElementById("work");
  if (!el) return;
  if (!data) { el.innerHTML = emptyState("Work section is missing."); return; }

  const items = list(data.items);

  el.innerHTML = `
    <div class="section-head reveal">
      <span class="eyebrow">${esc(pick(data, "sectionEyebrow", ""))}</span>
      <h2>${esc(pick(data, "heading", ""))}</h2>
      <p>${esc(pick(data, "sub", ""))}</p>
    </div>
    ${
      items.length
        ? `<div class="case-grid">
      ${items
        .map((item, i) => {
          if (!item) return "";
          const hasVideo = !!item.video;
          const bg = item.image
            ? `background-image:url('${esc(item.image)}');`
            : `--c1:${esc(pick(item, "c1", "#1a1b20"))}; --c2:${esc(pick(item, "c2", "#0D0E10"))};`;
          return `
        <article class="case-card reveal" style="transition-delay:${revealDelay(i)};">
          <div class="case-frame${hasVideo ? " has-video" : ""}" style="${bg}"${
            hasVideo
              ? ` data-video="${esc(item.video)}" role="button" tabindex="0" aria-label="Play video: ${esc(pick(item, "title", "project video"))}"`
              : ""
          }>
            <span class="case-badge">${esc(pick(item, "badge", "Project"))}</span>
            <div class="play-icon"></div>
          </div>
          <div class="case-body">
            <h3>${esc(pick(item, "title", "Untitled project"))}</h3>
            ${item.stat ? `<p class="case-stat">${esc(item.stat)}</p>` : ""}
            <p>${esc(pick(item, "desc", ""))}</p>
            ${item.postUrl ? `<a href="${esc(item.postUrl)}" target="_blank" rel="noopener" class="case-link">Watch original post →</a>` : ""}
          </div>
        </article>`;
        })
        .join("")}
    </div>`
        : emptyState("No work added yet — add items to data/work.json.")
    }`;
}

function renderStats(data) {
  const el = document.getElementById("stats");
  if (!el) return;
  if (!data) { el.innerHTML = emptyState("Stats section is missing."); return; }

  const rows = list(data.rows);
  const bars = list(data.bars);

  el.innerHTML = `
    <div class="section-head reveal">
      <span class="eyebrow">${esc(pick(data, "sectionEyebrow", ""))}</span>
      <h2>${esc(pick(data, "heading", ""))}</h2>
    </div>
    ${
      rows.length || bars.length
        ? `<div class="stats-cols">
      <div>
        ${rows
          .map((r, i) => `<div class="stat-row reveal" style="transition-delay:${revealDelay(i)};"><span>${esc(pick(r, "label", ""))}</span><span>${esc(pick(r, "value", ""))}</span></div>`)
          .join("")}
      </div>
      <div>
        ${bars
          .map((b, i) => {
            const pct = Math.max(0, Math.min(100, Number(b.percent) || 0));
            return `
        <div class="reveal" style="margin-bottom:20px; transition-delay:${revealDelay(i)};">
          <div class="stat-row" style="border:none; padding-bottom:4px;"><span>${esc(pick(b, "label", ""))}</span><span>${esc(pick(b, "value", ""))}</span></div>
          <div class="demo-bar"><div class="demo-fill" style="width:${pct}%;"></div></div>
        </div>`;
          })
          .join("")}
      </div>
    </div>`
        : emptyState("No stats added yet — add rows or bars to data/stats.json.")
    }`;
}

function renderSkills(data) {
  const el = document.getElementById("skills");
  if (!el) return;
  if (!data) { el.innerHTML = emptyState("Toolkit section is missing."); return; }

  const groups = list(data.groups);

  el.innerHTML = `
    <div class="section-head reveal">
      <span class="eyebrow">${esc(pick(data, "sectionEyebrow", ""))}</span>
      <h2>${esc(pick(data, "heading", ""))}</h2>
    </div>
    ${
      groups.length
        ? `<div class="toolkit-grid">
      ${groups
        .map((g, i) => {
          if (!g) return "";
          const items = list(g.items);
          return `
        <div class="tool-card reveal" style="transition-delay:${revealDelay(i)};">
          <h4>${esc(pick(g, "title", "Tools"))}</h4>
          ${items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}
        </div>`;
        })
        .join("")}
    </div>`
        : emptyState("No toolkit groups added yet — add groups to data/skills.json.")
    }`;
}

function renderDev(data) {
  const el = document.getElementById("dev");
  if (!el) return;
  if (!data) { el.innerHTML = ""; return; }

  const projects = list(data.projects);
  const hasGithub = data.githubUrl && data.githubLabel;

  el.innerHTML = `
    <div class="dev-section reveal">
      <div class="dev-inner">
        <div class="dev-head">
          <div>
            <span class="eyebrow">${esc(pick(data, "sectionEyebrow", ""))}</span>
            <h2>${esc(pick(data, "heading", ""))}</h2>
            <p>${esc(pick(data, "sub", ""))}</p>
          </div>
          ${hasGithub ? `<a class="gh-link" href="${esc(data.githubUrl)}" target="_blank" rel="noopener">${esc(data.githubLabel)}</a>` : ""}
        </div>
        ${
          projects.length
            ? `<div class="dev-grid">
          ${projects
            .map((p, i) => {
              if (!p) return "";
              const links = [
                p.liveUrl ? `<a href="${esc(p.liveUrl)}" target="_blank" rel="noopener">Live site →</a>` : "",
                p.repoUrl ? `<a href="${esc(p.repoUrl)}" target="_blank" rel="noopener">Repo →</a>` : "",
              ].filter(Boolean).join("");
              return `
          <div class="dev-card reveal" style="transition-delay:${revealDelay(i)};">
            ${p.stack ? `<div class="stack">${esc(p.stack)}</div>` : ""}
            <h4>${esc(pick(p, "title", "Untitled project"))}</h4>
            <p>${esc(pick(p, "desc", ""))}</p>
            ${links ? `<div class="dev-card-links">${links}</div>` : ""}
          </div>`;
            })
            .join("")}
        </div>`
            : emptyState("No projects added yet — add projects to data/dev.json.")
        }
      </div>
    </div>`;
}

function renderAbout(data) {
  const el = document.getElementById("about");
  if (!el) return;
  if (!data) { el.innerHTML = emptyState("About section is missing."); return; }

  const paragraphs = list(data.paragraphs);
  const education = list(data.education);
  const certifications = list(data.certifications);
  const languages = list(data.languages);

  const renderPairList = (title, arr) =>
    arr.length
      ? `<h4>${esc(title)}</h4><ul>${arr
          .map((e) => `<li><span>${esc(pick(e, "label", ""))}</span><span>${esc(pick(e, "value", ""))}</span></li>`)
          .join("")}</ul>`
      : "";

  el.innerHTML = `
    <div class="about-grid">
      <div class="about-copy reveal">
        <span class="eyebrow">${esc(pick(data, "sectionEyebrow", ""))}</span>
        <h2 style="font-size:34px; margin-bottom:20px;">${esc(pick(data, "heading", ""))}</h2>
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
  const el = document.getElementById("contact");
  const footerEl = document.getElementById("footer-root");
  if (!el) return;
  if (!data) { el.innerHTML = emptyState("Contact section is missing."); return; }

  const phoneHref = data.phone ? String(data.phone).replace(/\s+/g, "") : "";

  const metaLinks = [
    data.phone ? `<a href="tel:${esc(phoneHref)}">${esc(data.phone)}</a>` : "",
    data.linkedin ? `<a href="${esc(data.linkedin)}" target="_blank" rel="noopener">LinkedIn</a>` : "",
    data.github ? `<a href="${esc(data.github)}" target="_blank" rel="noopener">GitHub</a>` : "",
    data.tiktok ? `<a href="${esc(data.tiktok)}" target="_blank" rel="noopener">TikTok</a>` : "",
    data.instagram ? `<a href="${esc(data.instagram)}" target="_blank" rel="noopener">Instagram</a>` : "",
    data.location ? `<span>${esc(data.location)}</span>` : "",
  ]
    .filter(Boolean)
    .join("");

  el.innerHTML = `
    <div class="reveal">
      <span class="eyebrow">Get In Touch</span>
      <h2>${esc(pick(data, "heading", ""))}</h2>
      <p>${esc(pick(data, "sub", ""))}</p>
    </div>
    <div class="contact-actions reveal" style="transition-delay:80ms;">
      ${data.email ? `<a href="mailto:${esc(data.email)}" class="btn-primary">${esc(data.email)}</a>` : ""}
      ${data.linktree ? `<a href="${esc(data.linktree)}" class="btn-ghost" target="_blank" rel="noopener">View All My Socials</a>` : ""}
    </div>
    ${metaLinks ? `<div class="contact-meta reveal" style="transition-delay:150ms;">${metaLinks}</div>` : ""}
    ${data.availability ? `<div class="availability reveal" style="transition-delay:220ms;"><span class="dot-live"></span> ${esc(data.availability)}</div>` : ""}`;

  if (footerEl) footerEl.innerHTML = esc(pick(data, "footerNote", ""));
}

// highlights the active nav link as you scroll

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
    });
  });

  if (!sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const idx = sections.indexOf(entry.target);
        if (idx === -1) return;
        markers.forEach((m) => m.classList.remove("active"));
        const activeMarker = [...markers].find((m) => m.dataset.target === `#${entry.target.id}`);
        if (activeMarker) activeMarker.classList.add("active");
      });
    },
    { rootMargin: "-40% 0px -50% 0px", threshold: 0 }
  );

  sections.forEach((s) => observer.observe(s));
}

// opens the video modal when a work card with a video is clicked

function initWorkVideos() {
  const frames = document.querySelectorAll(".case-frame[data-video]");
  const modal = document.getElementById("videoModal");
  const modalVideo = document.getElementById("videoModalPlayer");
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
    frame.addEventListener("click", () => {
      const src = frame.dataset.video;
      if (src) openModal(src);
    });
    frame.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const src = frame.dataset.video;
        if (src) openModal(src);
      }
    });
  });

  modal.querySelectorAll("[data-modal-close]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("open")) closeModal();
  });
}

// fade-in animation for elements as they enter the viewport

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
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );

  els.forEach((el) => observer.observe(el));
}

// runs everything on page load

function renderSection(name, fn, data) {
  try {
    fn(data);
  } catch (err) {
    console.error(`Failed to render "${name}":`, err);
    const el = document.getElementById(name === "hero" ? "home" : name);
    if (el) el.innerHTML = emptyState(`This section couldn't be displayed (check data/${name}.json).`);
  }
}

async function init() {
  const { data, failed } = await loadData();

  renderSection("nav", renderNav, data.nav);
  renderSection("hero", renderHero, data.hero);
  renderSection("work", renderWork, data.work);
  initWorkVideos();
  renderSection("stats", renderStats, data.stats);
  renderSection("skills", renderSkills, data.skills);
  renderSection("dev", renderDev, data.dev);
  renderSection("about", renderAbout, data.about);
  renderSection("contact", renderContact, data.contact);

  initScrollSpy();
  initScrollReveal();

  if (failed.length === Object.keys(DATA_FILES).length) {
    document.body.innerHTML = `
      <div class="load-msg error">
        Couldn't load any site content.<br><br>
        This usually means the page was opened directly as a file.<br>
        Run a local server instead — e.g. the VS Code "Live Server" extension,
        or <code>python -m http.server</code> in this folder — then reload.
      </div>`;
  } else if (failed.length) {
    console.warn("Some sections failed to load:", failed.join(", "));
  }
}

init();