"use strict";

const CONTENT_FILES = Object.freeze({
  meta: "00-meta.json",
  nav: "01-nav.json",
  hero: "02-hero.json",
  services: "03-services.json",
  work: "04-work.json",
  dev: "05-dev.json",
  operations: "06-operations.json",
  stats: "07-stats.json",
  testimonials: "08-testimonials.json",
  about: "09-about.json",
  credentials: "10-credentials.json",
  contact: "11-contact.json"
});

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const text = escapeHTML;
const attr = escapeHTML;
const list = (value) => Array.isArray(value) ? value : [];
const records = (value) => list(value).filter((item) => item && typeof item === "object" && !Array.isArray(item));
const hasText = (value) => typeof value === "string" && value.trim().length > 0;
const pad = (index) => String(index + 1).padStart(2, "0");

function setVisible(element, visible) {
  if (!element) return;
  element.hidden = !visible;
  if (!visible) element.replaceChildren();
}

function setMeta(selector, value, attribute = "content") {
  const element = document.querySelector(selector);
  if (!element || !hasText(value)) return;
  element.setAttribute(attribute, value);
}

async function loadPortfolioContent() {
  const results = await Promise.all(
    Object.entries(CONTENT_FILES).map(async ([key, filename]) => {
      try {
        const response = await fetch(`data/${filename}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { key, filename, data: await response.json() };
      } catch (error) {
        console.error(`Could not load data/${filename}.`, error);
        return { key, filename, error };
      }
    })
  );

  return {
    data: Object.fromEntries(
      results.filter((result) => !result.error).map((result) => [result.key, result.data])
    ),
    errors: results.filter((result) => result.error)
  };
}

function renderMeta(data) {
  if (!data) return;
  if (hasText(data.title)) document.title = data.title;
  setMeta('meta[name="description"]', data.description);
  setMeta('meta[property="og:title"]', data.socialTitle || data.title);
  setMeta('meta[property="og:description"]', data.socialDescription || data.description);
  setMeta('meta[property="og:url"]', data.canonicalUrl);
  setMeta('meta[property="og:image"]', data.socialImage);
  setMeta('meta[property="og:image:alt"]', data.socialImageAlt);
  setMeta('link[rel="canonical"]', data.canonicalUrl, "href");
}

function renderNavigation(data) {
  const root = document.querySelector('[data-content="nav"]');
  const links = records(data?.links).filter((link) => hasText(link.label) && hasText(link.href));
  const visible = data && (hasText(data.brand) || links.length || hasText(data.cta?.label));
  setVisible(root, visible);
  if (!visible) return;

  const cta = hasText(data.cta?.label) && hasText(data.cta?.href)
    ? `<a class="nav-cta" href="${attr(data.cta.href)}">${text(data.cta.label)} <span aria-hidden="true">&nearr;</span></a>`
    : "";

  root.innerHTML = `
    <a class="brand" href="#top" aria-label="${attr(data.brand || "Portfolio")}, home">
      <span class="brand-mark">${text(data.brandMark || "MG")}</span>
      <span>
        ${hasText(data.brand) ? `<strong>${text(data.brand)}</strong>` : ""}
        ${hasText(data.role) ? `<small>${text(data.role)}</small>` : ""}
      </span>
    </a>
    <button class="menu-button" type="button" aria-expanded="false" aria-controls="site-nav">
      <span class="sr-only">Toggle navigation</span><span></span><span></span>
    </button>
    <nav class="site-nav" id="site-nav" aria-label="Primary navigation">
      ${links.map((link) => `<a href="${attr(link.href)}">${text(link.label)}</a>`).join("")}
      ${cta}
    </nav>`;
}

function renderHero(data) {
  const root = document.querySelector('[data-content="hero"]');
  const visible = data && (hasText(data.title) || hasText(data.intro));
  setVisible(root, visible);
  if (!visible) return;

  const services = list(data.services).filter(hasText);
  const receiptStats = records(data.receipt?.stats);
  const primaryCta = hasText(data.primaryCta?.label) && hasText(data.primaryCta?.href)
    ? `<a class="button button-dark" href="${attr(data.primaryCta.href)}">${text(data.primaryCta.label)} <span aria-hidden="true">&darr;</span></a>`
    : "";
  const secondaryCta = hasText(data.secondaryCta?.label) && hasText(data.secondaryCta?.href)
    ? `<a class="button button-text" href="${attr(data.secondaryCta.href)}" target="_blank" rel="noopener">${text(data.secondaryCta.label)} <span aria-hidden="true">&nearr;</span></a>`
    : "";
  const receipt = data.receipt && (hasText(data.receipt.value) || receiptStats.length)
    ? `<aside class="hero-receipt" aria-label="Career highlights">
        <div class="receipt-top"><span>${text(data.receipt.label)}</span><span>${text(data.receipt.year)}</span></div>
        ${hasText(data.receipt.value) ? `<p class="receipt-number">${text(data.receipt.value)}<span>${text(data.receipt.suffix)}</span></p>` : ""}
        ${hasText(data.receipt.caption) ? `<p class="receipt-caption">${text(data.receipt.caption)}</p>` : ""}
        ${receiptStats.length ? `<dl class="receipt-stats">${receiptStats.map((stat) => `<div><dt>${text(stat?.label)}</dt><dd>${text(stat?.value)}</dd></div>`).join("")}</dl>` : ""}
        ${hasText(data.receipt.linkLabel) && hasText(data.receipt.linkHref) ? `<a href="${attr(data.receipt.linkHref)}">${text(data.receipt.linkLabel)} <span aria-hidden="true">&searr;</span></a>` : ""}
      </aside>`
    : "";

  root.innerHTML = `
    ${hasText(data.availability) ? `<div class="availability"><span class="status-dot" aria-hidden="true"></span>${text(data.availability)}</div>` : ""}
    <div class="hero-layout${receipt ? "" : " hero-layout-single"}">
      <div class="hero-copy">
        ${hasText(data.eyebrow) ? `<p class="eyebrow">${text(data.eyebrow)}</p>` : ""}
        <h1 id="hero-title">${text(data.title)}${hasText(data.titleAccent) ? `<br><em>${text(data.titleAccent)}</em>` : ""}</h1>
        ${hasText(data.intro) ? `<p class="hero-intro">${text(data.intro)}</p>` : ""}
        ${primaryCta || secondaryCta ? `<div class="hero-actions">${primaryCta}${secondaryCta}</div>` : ""}
        ${services.length ? `<ul class="hero-services" aria-label="Available services">${services.map((service) => `<li>${text(service)}</li>`).join("")}</ul>` : ""}
      </div>
      ${receipt}
    </div>`;
}

function renderServices(data) {
  const root = document.querySelector('[data-content="services"]');
  const items = records(data?.items);
  const visible = data && (hasText(data.heading) || items.length);
  setVisible(root, visible);
  if (!visible) return;

  root.innerHTML = `
    <div class="hire-menu-heading">
      ${hasText(data.eyebrow) ? `<p class="eyebrow">${text(data.eyebrow)}</p>` : ""}
      <div>
        ${hasText(data.heading) ? `<h3 id="hire-menu-title">${text(data.heading)}</h3>` : ""}
        ${hasText(data.summary) ? `<p class="hire-menu-summary">${text(data.summary)}</p>` : ""}
      </div>
    </div>
    ${items.length ? `<div class="hire-menu-grid">${items.map((item, index) => `
      <article>
        <span>${text(item?.index || pad(index))}${hasText(item?.category) ? ` / ${text(item.category)}` : ""}</span>
        ${hasText(item?.title) ? `<h4>${text(item.title)}</h4>` : ""}
        ${hasText(item?.description) ? `<p>${text(item.description)}</p>` : ""}
        ${hasText(item?.linkLabel) && hasText(item?.linkHref) ? `<a href="${attr(item.linkHref)}">${text(item.linkLabel)} <span aria-hidden="true">&darr;</span></a>` : ""}
      </article>`).join("")}</div>` : ""}`;
}

function galleryControls(target, label, count) {
  if (count < 2) return "";
  return `<div class="scroll-controls gallery-controls" role="group" aria-label="${attr(label)} controls">
    <button type="button" data-scroll-target="${attr(target)}" data-scroll-direction="-1" aria-label="Scroll ${attr(label)}s left">&larr;</button>
    <button type="button" data-scroll-target="${attr(target)}" data-scroll-direction="1" aria-label="Scroll ${attr(label)}s right">&rarr;</button>
  </div>`;
}

function socialIcon(name) {
  const icons = {
    tiktok: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 3v11.1a4.6 4.6 0 1 1-3.8-4.5v3.1a1.7 1.7 0 1 0 .8 1.4V3h3Zm0 0c.4 2.2 1.7 3.6 4 4.1v3.1a8.2 8.2 0 0 1-4-1.8V3Z"/></svg>`,
    youtube: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.4 6.5a2.7 2.7 0 0 0-1.9-1.9C17.8 4.2 12 4.2 12 4.2s-5.8 0-7.5.4a2.7 2.7 0 0 0-1.9 1.9A28 28 0 0 0 2.2 12c0 1.9.1 3.7.4 5.5a2.7 2.7 0 0 0 1.9 1.9c1.7.4 7.5.4 7.5.4s5.8 0 7.5-.4a2.7 2.7 0 0 0 1.9-1.9c.3-1.8.4-3.6.4-5.5s-.1-3.7-.4-5.5ZM10 15.4V8.6l5.8 3.4-5.8 3.4Z"/></svg>`,
    instagram: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M7.2 2h9.6A5.2 5.2 0 0 1 22 7.2v9.6a5.2 5.2 0 0 1-5.2 5.2H7.2A5.2 5.2 0 0 1 2 16.8V7.2A5.2 5.2 0 0 1 7.2 2Zm0 2A3.2 3.2 0 0 0 4 7.2v9.6A3.2 3.2 0 0 0 7.2 20h9.6a3.2 3.2 0 0 0 3.2-3.2V7.2A3.2 3.2 0 0 0 16.8 4H7.2Zm10.1 1.5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>`,
    facebook: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.8 22v-9h3l.5-3.5h-3.5V7.3c0-1 .3-1.8 1.8-1.8h1.9V2.4c-.3 0-1.5-.1-2.8-.1-2.8 0-4.7 1.7-4.7 4.8v2.4H7V13h3v9h3.8Z"/></svg>`,
    reels: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M5 3h14a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm0 2h2.2l2 3H4V6a1 1 0 0 1 1-1Zm4.6 0h3.1l2 3h-3.1l-2-3Zm5.5 0H19a1 1 0 0 1 1 1v2h-2.9l-2-3ZM4 10v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8H4Zm6 2.2 5 2.8-5 2.8v-5.6Z"/></svg>`
  };
  return icons[name] || icons.reels;
}

function renderWork(data) {
  const heading = document.querySelector('[data-content="work-heading"]');
  const root = document.querySelector('[data-content="work"]');
  const items = records(data?.items);
  const socialLinks = records(data?.socialLinks).filter((link) => hasText(link.label) && hasText(link.href));
  const role = data?.roleSpotlight;
  const roleLinks = records(role?.links).filter((link) => hasText(link.label) && hasText(link.href));
  const headingVisible = data && (hasText(data.sectionHeading) || hasText(data.sectionDescription));
  const contentVisible = data && (hasText(data.label) || items.length);
  setVisible(heading, headingVisible);
  setVisible(root, contentVisible);

  if (headingVisible) {
    heading.innerHTML = `
      <div>
        ${hasText(data.sectionEyebrow) ? `<p class="eyebrow">${text(data.sectionEyebrow)}</p>` : ""}
        ${hasText(data.sectionHeading) ? `<h2 id="work-title">${text(data.sectionHeading)}</h2>` : ""}
      </div>
      ${hasText(data.sectionDescription) ? `<p>${text(data.sectionDescription)}</p>` : ""}`;
  }
  if (!contentVisible) return;

  root.innerHTML = `
    <div class="subsection-title">
      <p><span>01</span> ${text(data.label)}</p>
      <div class="subsection-side">
        ${socialLinks.length ? `<div class="video-social-group">
          ${hasText(data.socialLinksLabel) ? `<span class="video-social-label">${text(data.socialLinksLabel)}</span>` : ""}
          <div class="video-social-links" aria-label="Video channels">${socialLinks.map((link) => `<a class="video-social-link" href="${attr(link.href)}" target="_blank" rel="noopener" aria-label="${attr(link.label)}" title="${attr(link.label)}">${socialIcon(link.icon)}</a>`).join("")}</div>
        </div>` : ""}
        ${items.length > 1 ? `<span class="drag-hint" aria-hidden="true">Drag to explore &rarr;</span>` : ""}
      </div>
    </div>
    ${role && (hasText(role.title) || hasText(role.organization)) ? `<aside class="role-spotlight" aria-label="${attr(role.title || "Featured role")}">
      <div class="role-spotlight-heading">
        <div>
          ${hasText(role.eyebrow) ? `<p class="eyebrow">${text(role.eyebrow)}</p>` : ""}
          ${hasText(role.title) ? `<h3>${text(role.title)}</h3>` : ""}
          ${hasText(role.organization) ? `<p class="role-organization">${text(role.organization)}</p>` : ""}
          ${hasText(role.organizationLinkLabel) && hasText(role.organizationUrl) ? `<a class="role-organization-link" href="${attr(role.organizationUrl)}" target="_blank" rel="noopener">${text(role.organizationLinkLabel)} &nearr;</a>` : ""}
        </div>
        ${hasText(role.period) ? `<span class="role-period">${text(role.period)}</span>` : ""}
      </div>
      <div class="role-spotlight-details">
        ${hasText(role.summary) ? `<p>${text(role.summary)}</p>` : ""}
        ${roleLinks.length ? `<div class="role-links">
          ${hasText(role.linksLabel) ? `<span>${text(role.linksLabel)}</span>` : ""}
          <div>${roleLinks.map((link) => `<a class="selected-role-link" href="${attr(link.href)}" target="_blank" rel="noopener">${text(link.label)} &nearr;</a>`).join("")}</div>
        </div>` : ""}
      </div>
    </aside>` : ""}
    ${items.length ? `<div class="gallery-shell">
      <div class="video-grid horizontal-track" id="video-track" tabindex="0" aria-label="Video projects. Scroll horizontally to explore.">
        ${items.map((item, index) => {
          const resultBadge = hasText(item?.result)
            ? `<span class="case-result-badge"><strong>${text(item.result)}</strong>${hasText(item.resultDetail) ? `<small>${text(item.resultDetail)}</small>` : ""}</span>`
            : "";
          const media = hasText(item?.video)
            ? `<button class="case-media video-trigger" type="button" data-video="${attr(item.video)}" aria-label="Play ${attr(item.title)}">
                <img src="${attr(item.image)}" alt="${attr(item.imageAlt)}" loading="${index ? "lazy" : "eager"}">
                ${resultBadge}
                <span class="play-pill" aria-hidden="true"><i></i></span>
              </button>`
            : hasText(item?.image) && hasText(item?.postUrl)
              ? `<a class="case-media" href="${attr(item.postUrl)}" target="_blank" rel="noopener" aria-label="${attr(item.actionLabel || "Watch original")}: ${attr(item.title)}">
                  <img src="${attr(item.image)}" alt="${attr(item.imageAlt)}" loading="${index ? "lazy" : "eager"}">
                  ${resultBadge}
                  <span class="play-pill" aria-hidden="true"><i></i></span>
                </a>`
              : "";
          return `<article class="case-study">
            ${media}
            <div class="case-copy">
              ${hasText(item?.category) ? `<p class="case-category">${text(item.category)}</p>` : ""}
              ${hasText(item?.title) ? `<h3>${text(item.title)}</h3>` : ""}
              ${hasText(item?.description) ? `<p>${text(item.description)}</p>` : ""}
              ${hasText(item?.postUrl) ? `<a href="${attr(item.postUrl)}" target="_blank" rel="noopener">${text(item.linkLabel || "Watch original")} &nearr;</a>` : ""}
            </div>
          </article>`;
        }).join("")}
      </div>
      ${galleryControls("video-track", "Video project", items.length)}
    </div>` : ""}`;
}

function renderDevelopment(data) {
  const root = document.querySelector('[data-content="dev"]');
  const projects = records(data?.projects);
  const visible = data && (hasText(data.heading) || projects.length);
  setVisible(root, visible);
  if (!visible) return;

  root.innerHTML = `
    <div class="subsection-title">
      <p><span>02</span> ${text(data.label)}</p>
      <div class="subsection-side">
        ${hasText(data.externalLabel) && hasText(data.externalUrl) ? `<a href="${attr(data.externalUrl)}" target="_blank" rel="noopener">${text(data.externalLabel)} &nearr;</a>` : ""}
        ${projects.length > 1 ? `<span class="drag-hint" aria-hidden="true">Drag to explore &rarr;</span>` : ""}
      </div>
    </div>
    ${hasText(data.heading) || hasText(data.description) ? `<div class="dev-intro">
      ${hasText(data.heading) ? `<h3>${text(data.heading)}</h3>` : ""}
      ${hasText(data.description) ? `<p>${text(data.description)}</p>` : ""}
    </div>` : ""}
    ${projects.length ? `<div class="gallery-shell">
      <div class="repo-list horizontal-track" id="project-track" tabindex="0" aria-label="Software projects. Scroll horizontally to explore.">
        ${projects.map((project, index) => `<article>
          <div class="repo-index">${pad(index)}</div>
          <div>
            ${hasText(project?.stack) ? `<p>${text(project.stack)}</p>` : ""}
            ${hasText(project?.title) ? `<h4>${text(project.title)}</h4>` : ""}
            ${hasText(project?.description) ? `<span>${text(project.description)}</span>` : ""}
            ${list(project?.features).length ? `<ul class="repo-features">${list(project.features).map((feature) => `<li>${text(feature)}</li>`).join("")}</ul>` : ""}
          </div>
          ${hasText(project?.repoUrl) || hasText(project?.liveUrl) ? `<div class="repo-links">
            ${hasText(project.liveUrl) ? `<a href="${attr(project.liveUrl)}" target="_blank" rel="noopener">${text(project.liveLabel || data.liveLabel || "View website")} &nearr;</a>` : ""}
            ${hasText(project.repoUrl) ? `<a href="${attr(project.repoUrl)}" target="_blank" rel="noopener">${text(project.repoLabel || data.repoLabel || "View code")} &nearr;</a>` : ""}
          </div>` : ""}
        </article>`).join("")}
      </div>
      ${galleryControls("project-track", "Software project", projects.length)}
    </div>` : ""}`;
}

function renderOperations(data) {
  const root = document.querySelector('[data-content="operations"]');
  const items = records(data?.items);
  const visible = data && (hasText(data.heading) || items.length);
  setVisible(root, visible);
  if (!visible) return;

  root.innerHTML = `
    <div class="subsection-title">
      <p><span>03</span> ${text(data.label)}</p>
      ${hasText(data.status) ? `<span>${text(data.status)}</span>` : ""}
    </div>
    <div class="operations-grid">
      <div class="operations-statement">
        ${hasText(data.eyebrow) ? `<p class="eyebrow">${text(data.eyebrow)}</p>` : ""}
        ${hasText(data.heading) ? `<h3>${text(data.heading)}</h3>` : ""}
        ${hasText(data.description) ? `<p>${text(data.description)}</p>` : ""}
      </div>
      ${items.length ? items.every((item) => !hasText(item.description))
        ? `<ul class="operations-tags">${items.map((item) => `<li>${text(item.title)}</li>`).join("")}</ul>`
        : `<ol class="operations-list">${items.map((item, index) => `<li>
            <span>${pad(index)}</span><div><strong>${text(item.title)}</strong>${hasText(item.description) ? `<p>${text(item.description)}</p>` : ""}</div>
          </li>`).join("")}</ol>`
        : ""}
    </div>
    ${hasText(data.tools) || hasText(data.approach) ? `<div class="operations-footer">
      ${hasText(data.tools) ? `<p class="operations-note">Tools: ${text(data.tools)}</p>` : ""}
      ${hasText(data.approach) ? `<p class="operations-disclosure"><strong>My approach:</strong> ${text(data.approach)}</p>` : ""}
    </div>` : ""}`;
}

function renderStats(data) {
  const root = document.querySelector('[data-content="stats"]');
  const items = records(data?.items);
  const visible = data && (hasText(data.heading) || items.length || hasText(data.total));
  setVisible(root, visible);
  if (!visible) return;

  root.innerHTML = `
    <div class="section-heading">
      <div>
        ${hasText(data.eyebrow) ? `<p class="eyebrow">${text(data.eyebrow)}</p>` : ""}
        ${hasText(data.heading) ? `<h2 id="proof-title">${text(data.heading)}</h2>` : ""}
      </div>
      ${hasText(data.description) ? `<div class="section-heading-aside"><p>${text(data.description)}</p></div>` : ""}
    </div>
    ${items.length ? `<div class="gallery-shell">
      <div class="proof-grid horizontal-track" id="proof-track" tabindex="0" aria-label="Analytics proof. Scroll horizontally to explore.">
        ${items.map((item) => `<button class="proof-card image-trigger" type="button" data-image="${attr(item?.image)}" data-alt="${attr(item?.alt)}">
          <span class="proof-card-top"><strong>${text(item?.value)}</strong><small>${text(item?.detail)}</small></span>
          ${hasText(item?.image) ? `<img src="${attr(item.image)}" alt="${attr(item.alt)}" loading="lazy">` : ""}
          <span class="proof-card-bottom">${text(item?.title)} <i>Expand &nearr;</i></span>
        </button>`).join("")}
      </div>
      ${galleryControls("proof-track", "Analytics proof", items.length)}
    </div>` : ""}
    ${hasText(data.total) ? `<p class="proof-total"><span>${text(data.totalLabel)}</span><strong>${text(data.total)} ${hasText(data.totalDetail) ? `<small>${text(data.totalDetail)}</small>` : ""}</strong></p>` : ""}`;
}

function renderTestimonials(data) {
  const root = document.querySelector('[data-content="testimonials"]');
  const items = records(data?.items);
  const visible = Boolean(data?.enabled && items.length);
  setVisible(root, visible);
  if (!visible) return;

  root.innerHTML = `
    <div class="section-heading">
      <div><p class="eyebrow">${text(data.eyebrow)}</p><h2 id="testimonials-title">${text(data.heading)}</h2></div>
      ${hasText(data.description) ? `<p>${text(data.description)}</p>` : ""}
    </div>
    <div class="gallery-shell">
      <div class="testimonial-track horizontal-track" id="testimonial-track" tabindex="0" aria-label="Client testimonials. Scroll horizontally to explore.">
        ${items.map((item) => `<figure class="testimonial-card">
          <blockquote>&ldquo;${text(item?.quote)}&rdquo;</blockquote>
          <figcaption><strong>${text(item?.name)}</strong>${hasText(item?.role) ? `<span>${text(item.role)}</span>` : ""}</figcaption>
        </figure>`).join("")}
      </div>
      ${galleryControls("testimonial-track", "Client testimonial", items.length)}
    </div>`;
}

function renderAbout(data) {
  const root = document.querySelector('[data-content="about"]');
  const paragraphs = list(data?.paragraphs).filter(hasText);
  const facts = records(data?.facts);
  const visible = data && (hasText(data.heading) || paragraphs.length || facts.length);
  setVisible(root, visible);
  if (!visible) return;

  root.innerHTML = `
    <div class="about-title">
      ${hasText(data.eyebrow) ? `<p class="eyebrow">${text(data.eyebrow)}</p>` : ""}
      ${hasText(data.heading) ? `<h2 id="about-title">${text(data.heading)}</h2>` : ""}
    </div>
    <div class="about-copy">
      ${paragraphs.map((paragraph) => `<p>${text(paragraph)}</p>`).join("")}
      ${facts.length ? `<div class="about-facts">${facts.map((fact) => `<div><span>${text(fact?.label)}</span><strong>${text(fact?.value)}</strong></div>`).join("")}</div>` : ""}
    </div>`;
}

function renderCredentials(data) {
  const root = document.querySelector('[data-content="credentials"]');
  const items = records(data?.items);
  const visible = data && (hasText(data.heading) || items.length);
  setVisible(root, visible);
  if (!visible) return;

  root.innerHTML = `
    <div class="credentials-heading">
      <div>
        ${hasText(data.eyebrow) ? `<p class="eyebrow">${text(data.eyebrow)}</p>` : ""}
        ${hasText(data.heading) ? `<h3 id="credentials-title">${text(data.heading)}</h3>` : ""}
      </div>
      <div class="credentials-proof">
        ${hasText(data.description) ? `<p>${text(data.description)}</p>` : ""}
        ${hasText(data.verificationLabel) && hasText(data.verificationUrl) ? `<div class="credentials-actions">
          <a href="${attr(data.verificationUrl)}" target="_blank" rel="noopener"><span class="linkedin-mark" aria-hidden="true">in</span>${text(data.verificationLabel)}<span aria-hidden="true">&nearr;</span></a>
        </div>` : ""}
      </div>
    </div>
    ${items.length ? `<div class="gallery-shell">
      <div class="certificate-grid horizontal-track" id="certificate-track" tabindex="0" aria-label="Certificates. Scroll horizontally to explore.">
        ${items.map((item) => `<button class="certificate-card image-trigger" type="button" data-image="${attr(item?.image)}" data-alt="${attr(item?.alt)}">
          <span class="certificate-image">${hasText(item?.image) ? `<img src="${attr(item.image)}" alt="${attr(item.alt)}" loading="lazy">` : ""}</span>
          <span class="certificate-meta"><span><small>${text(item?.issuer)}${hasText(item?.year) ? ` / ${text(item.year)}` : ""}</small><strong>${text(item?.title)}</strong></span><i>Expand &nearr;</i></span>
        </button>`).join("")}
      </div>
      ${galleryControls("certificate-track", "Certificate", items.length)}
    </div>` : ""}`;
}

function renderContact(data) {
  const root = document.querySelector('[data-content="contact"]');
  const footer = document.querySelector('[data-content="footer"]');
  const visible = data && (hasText(data.heading) || hasText(data.email));
  setVisible(root, visible);
  setVisible(footer, Boolean(data?.footer));
  if (!visible) return;

  const subject = encodeURIComponent(data.emailSubject || "");
  const body = encodeURIComponent(data.emailBody || "");
  const links = records(data.links).filter((link) => hasText(link.label) && hasText(link.href));
  const locationLines = list(data.locationLines).filter(hasText);

  root.innerHTML = `<div class="contact-inner">
    ${hasText(data.eyebrow) ? `<p class="eyebrow">${text(data.eyebrow)}</p>` : ""}
    ${hasText(data.heading) ? `<h2 id="contact-title">${text(data.heading)}${hasText(data.headingAccent) ? `<br><em>${text(data.headingAccent)}</em>` : ""}</h2>` : ""}
    ${hasText(data.description) ? `<p>${text(data.description)}</p>` : ""}
    ${hasText(data.email) ? `<a class="contact-email" href="mailto:${attr(data.email)}?subject=${subject}&amp;body=${body}"><span>${text(data.emailAction || "Start a conversation")}</span><strong>${text(data.emailLabel || data.email)}</strong><i aria-hidden="true">&nearr;</i></a>` : ""}
    ${links.length || locationLines.length ? `<div class="contact-meta">
      ${links.length ? `<div>${links.map((link) => `<a href="${attr(link.href)}" target="_blank" rel="noopener">${text(link.label)} &nearr;</a>`).join("")}</div>` : ""}
      ${locationLines.length ? `<p>${locationLines.map(text).join("<br>")}</p>` : ""}
    </div>` : ""}
  </div>`;

  if (data.footer && footer) {
    footer.innerHTML = `
      <p>&copy; <span id="year">${new Date().getFullYear()}</span> ${text(data.footer.copyright)}</p>
      <p>${text(data.footer.note)}</p>
      ${hasText(data.footer.backToTop) ? `<a href="#top">${text(data.footer.backToTop)} &uarr;</a>` : ""}`;
  }
}

function updateCompositeSections() {
  const work = document.querySelector("#work");
  const workChildren = ["work-heading", "services", "work", "dev", "operations"]
    .map((key) => document.querySelector(`[data-content="${key}"]`));
  if (work) work.hidden = !workChildren.some((child) => child && !child.hidden);

  const about = document.querySelector("#about");
  const aboutChildren = ["about", "credentials"]
    .map((key) => document.querySelector(`[data-content="${key}"]`));
  if (about) about.hidden = !aboutChildren.some((child) => child && !child.hidden);
}

function renderPortfolio(payload) {
  const { data, errors } = payload;
  const renderers = [
    ["meta", renderMeta],
    ["nav", renderNavigation],
    ["hero", renderHero],
    ["services", renderServices],
    ["work", renderWork],
    ["dev", renderDevelopment],
    ["operations", renderOperations],
    ["stats", renderStats],
    ["testimonials", renderTestimonials],
    ["about", renderAbout],
    ["credentials", renderCredentials],
    ["contact", renderContact]
  ];

  renderers.forEach(([key, renderer]) => {
    try {
      renderer(data[key]);
    } catch (error) {
      console.error(`Could not render the ${key} section.`, error);
    }
  });

  updateCompositeSections();

  if (errors.length) {
    const status = document.querySelector("#content-status");
    if (status) {
      status.textContent = "Some portfolio content could not be loaded. Please refresh the page.";
      status.hidden = false;
    }
  }
}

window.portfolioContentReady = loadPortfolioContent().then(renderPortfolio);
