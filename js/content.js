"use strict";

const CONTENT_FILES = Object.freeze({
  meta: "00-meta.json",
  nav: "01-nav.json",
  hero: "02-hero.json",
  work: "04-work.json",
  dev: "05-dev.json",
  operations: "06-operations.json",
  stats: "07-stats.json",
  testimonials: "08-testimonials.json",
  about: "09-about.json",
  credentials: "10-credentials.json",
  contact: "11-contact.json",
  ui: "12-ui.json"
});

let interfaceText = {};

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
const ui = (path) => {
  const value = path.split(".").reduce((current, key) => current?.[key], interfaceText);
  return hasText(value) ? value : "";
};
const formatUi = (path, values = {}) =>
  Object.entries(values).reduce(
    (output, [key, value]) => output.replaceAll(`{${key}}`, String(value)),
    ui(path)
  );

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

function renderInterface(data) {
  interfaceText = data || {};

  const skipLink = document.querySelector("#skip-link");
  if (skipLink) skipLink.textContent = ui("skipLink");

  const videoDialog = document.querySelector("#video-dialog");
  const imageDialog = document.querySelector("#image-dialog");
  const videoClose = document.querySelector("#video-dialog-close");
  const imageClose = document.querySelector("#image-dialog-close");

  if (videoDialog) videoDialog.setAttribute("aria-label", ui("dialogs.videoLabel"));
  if (imageDialog) imageDialog.setAttribute("aria-label", ui("dialogs.imageLabel"));
  if (videoClose) {
    videoClose.setAttribute("aria-label", ui("dialogs.closeVideoLabel"));
    videoClose.innerHTML = `${text(ui("dialogs.closeButton"))} &times;`;
  }
  if (imageClose) {
    imageClose.setAttribute("aria-label", ui("dialogs.closeImageLabel"));
    imageClose.innerHTML = `${text(ui("dialogs.closeButton"))} &times;`;
  }
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
    <a class="brand" href="#top" aria-label="${attr(data.brand || ui("navigation.brandFallback"))}, ${attr(ui("navigation.homeSuffix"))}">
      <span class="brand-mark">${hasText(data.brandImage) ? `<img src="${attr(data.brandImage)}" alt="${attr(data.brandImageAlt || "")}">` : text(data.brandMark || ui("navigation.brandMarkFallback"))}</span>
      <span>
        ${hasText(data.brand) ? `<strong>${text(data.brand)}</strong>` : ""}
        ${hasText(data.role) ? `<small>${text(data.role)}</small>` : ""}
      </span>
    </a>
    <button class="menu-button" type="button" aria-expanded="false" aria-controls="site-nav">
      <span class="sr-only">${text(ui("navigation.toggleLabel"))}</span><span></span><span></span>
    </button>
    <nav class="site-nav" id="site-nav" aria-label="${attr(ui("navigation.primaryLabel"))}">
      ${links.map((link) => {
        const children = records(link.children).filter((child) => hasText(child.label) && hasText(child.href));
        if (!children.length) return `<a href="${attr(link.href)}">${text(link.label)}</a>`;

        return `<div class="nav-dropdown">
          <a class="nav-dropdown-trigger" href="${attr(link.href)}" aria-haspopup="true">
            <span>${text(link.label)}</span><i aria-hidden="true">&darr;</i>
          </a>
          <div class="nav-dropdown-menu" aria-label="${attr(link.label)} ${attr(ui("navigation.sectionsSuffix"))}">
            ${children.map((child) => `<a href="${attr(child.href)}">
              ${hasText(child.index) ? `<span>${text(child.index)}</span>` : ""}
              <strong>${text(child.label)}</strong>
              <i aria-hidden="true">&darr;</i>
            </a>`).join("")}
          </div>
        </div>`;
      }).join("")}
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
    ? `<aside class="hero-receipt" aria-label="${attr(ui("labels.careerHighlights"))}">
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
        ${services.length ? `<ul class="hero-services" aria-label="${attr(ui("labels.availableServices"))}">${services.map((service) => `<li>${text(service)}</li>`).join("")}</ul>` : ""}
      </div>
      ${receipt}
    </div>`;
}

function galleryControls(target, label, count) {
  if (count < 2) return "";
  return `<div class="scroll-controls gallery-controls" role="group" aria-label="${attr(formatUi("gallery.controlsTemplate", { label }))}">
    <button type="button" data-scroll-target="${attr(target)}" data-scroll-direction="-1" aria-label="${attr(formatUi("gallery.scrollLeftTemplate", { label }))}">&larr;</button>
    <button type="button" data-scroll-target="${attr(target)}" data-scroll-direction="1" aria-label="${attr(formatUi("gallery.scrollRightTemplate", { label }))}">&rarr;</button>
  </div>`;
}

function socialIcon(name) {
  const icons = {
    linkedin: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.4 7.8H2.2V22h3.2V7.8ZM3.8 2A1.9 1.9 0 1 0 3.8 5.8 1.9 1.9 0 0 0 3.8 2ZM22 13.8c0-4.3-2.3-6.3-5.4-6.3a4.7 4.7 0 0 0-4.2 2.3v-2H9.2V22h3.2v-7c0-1.8.4-3.6 2.7-3.6 2.3 0 2.3 2.1 2.3 3.7V22h3.2l1.4-8.2Z"/></svg>`,
    tiktok: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 3v11.1a4.6 4.6 0 1 1-3.8-4.5v3.1a1.7 1.7 0 1 0 .8 1.4V3h3Zm0 0c.4 2.2 1.7 3.6 4 4.1v3.1a8.2 8.2 0 0 1-4-1.8V3Z"/></svg>`,
    youtube: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.4 6.5a2.7 2.7 0 0 0-1.9-1.9C17.8 4.2 12 4.2 12 4.2s-5.8 0-7.5.4a2.7 2.7 0 0 0-1.9 1.9A28 28 0 0 0 2.2 12c0 1.9.1 3.7.4 5.5a2.7 2.7 0 0 0 1.9 1.9c1.7.4 7.5.4 7.5.4s5.8 0 7.5-.4a2.7 2.7 0 0 0 1.9-1.9c.3-1.8.4-3.6.4-5.5s-.1-3.7-.4-5.5ZM10 15.4V8.6l5.8 3.4-5.8 3.4Z"/></svg>`,
    instagram: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M7.2 2h9.6A5.2 5.2 0 0 1 22 7.2v9.6a5.2 5.2 0 0 1-5.2 5.2H7.2A5.2 5.2 0 0 1 2 16.8V7.2A5.2 5.2 0 0 1 7.2 2Zm0 2A3.2 3.2 0 0 0 4 7.2v9.6A3.2 3.2 0 0 0 7.2 20h9.6a3.2 3.2 0 0 0 3.2-3.2V7.2A3.2 3.2 0 0 0 16.8 4H7.2Zm10.1 1.5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>`,
    facebook: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.8 22v-9h3l.5-3.5h-3.5V7.3c0-1 .3-1.8 1.8-1.8h1.9V2.4c-.3 0-1.5-.1-2.8-.1-2.8 0-4.7 1.7-4.7 4.8v2.4H7V13h3v9h3.8Z"/></svg>`,
    github: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.9c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 0 1.6 1 1.6 1 .9 1.6 2.4 1.1 2.9.9.1-.7.4-1.1.7-1.3-2.2-.3-4.6-1.1-4.6-4.9 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.5 9.5 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.8-2.3 4.6-4.6 4.9.4.3.7.9.7 1.8V21c0 .3.2.6.7.5A10 10 0 0 0 12 2Z"/></svg>`,
    reels: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M5 3h14a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm0 2h2.2l2 3H4V6a1 1 0 0 1 1-1Zm4.6 0h3.1l2 3h-3.1l-2-3Zm5.5 0H19a1 1 0 0 1 1 1v2h-2.9l-2-3ZM4 10v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8H4Zm6 2.2 5 2.8-5 2.8v-5.6Z"/></svg>`
  };
  return icons[name] || icons.reels;
}

function technologyIcon(name) {
  const icons = {
    html: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 3h22l-2 23-9 3-9-3L5 3Z"/><path class="tech-icon-detail" d="M10 9h12l-.3 3H13l.2 3h8.2l-.7 8-4.7 1.6-4.7-1.6-.3-4h3l.2 1.8 1.8.6 1.8-.6.2-2.8H10.4L10 9Z"/></svg>`,
    css: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 3h22l-2 23-9 3-9-3L5 3Z"/><path class="tech-icon-detail" d="M10 9h12l-.3 3-7.6 3h7.3l-.7 8-4.7 1.6-4.7-1.6-.3-4h3l.2 1.8 1.8.6 1.8-.6.2-2.8h-8.2l-.2-3 7.7-3H10.3L10 9Z"/></svg>`,
    javascript: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="3" width="26" height="26" rx="3"/><path class="tech-icon-detail" d="M16.8 22.7c.7 1.2 1.6 1.8 2.8 1.8s1.9-.6 1.9-1.4c0-1-.8-1.3-2.1-1.9l-.7-.3c-2.1-.9-3.5-2-3.5-4.3 0-2.1 1.6-3.8 4.2-3.8 1.8 0 3.1.6 4.1 2.3l-2.2 1.4c-.5-.9-1.1-1.2-1.9-1.2-.9 0-1.4.5-1.4 1.2 0 .8.5 1.2 1.8 1.8l.7.3c2.5 1.1 3.9 2.2 3.9 4.5 0 2.6-2 4-4.8 4-2.7 0-4.4-1.3-5.2-3.1l2.4-1.3ZM7.8 13h2.9v9.2c0 2.4-1 3-3.3 2.6v-2.3c.8.1 1.1 0 1.1-.7V13Z"/></svg>`,
    node: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m16 2.5 12 6.8v13.4l-12 6.8-12-6.8V9.3L16 2.5Z"/><path class="tech-icon-detail" d="M12 22V10h3l5 7.3V10h3v12h-3l-5-7.2V22h-3Z"/></svg>`,
    express: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="7" width="26" height="18" rx="5"/><path class="tech-icon-detail" d="M8 12h8v2.4h-5v1.5h4.5v2.3H11v1.5h5.2V22H8V12Zm9.5 0h3l1.7 2.7 1.7-2.7h3l-3.2 4.8L27 22h-3l-1.9-3-1.9 3h-3l3.4-5.2-3.1-4.8Z"/></svg>`,
    mysql: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3C9.4 3 4 5.2 4 8v16c0 2.8 5.4 5 12 5s12-2.2 12-5V8c0-2.8-5.4-5-12-5Z"/><path class="tech-icon-detail" d="M16 6c5.5 0 9 1.5 9 2s-3.5 2-9 2-9-1.5-9-2 3.5-2 9-2Zm-9 6c2.2.9 5.4 1.4 9 1.4s6.8-.5 9-1.4v3.3c-.6.7-3.8 1.8-9 1.8s-8.4-1.1-9-1.8V12Zm0 7.2c2.2.9 5.4 1.4 9 1.4s6.8-.5 9-1.4v4.4c-.6.7-3.8 1.8-9 1.8s-8.4-1.1-9-1.8v-4.4Z"/></svg>`,
    php: `<svg viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="16" rx="14" ry="9"/><path class="tech-icon-detail" d="M6.8 12h4.6c2.7 0 4.1 1.2 3.7 3.5-.4 2.6-2 3.7-4.8 3.7H9.1L8.7 22H5.8l1-10Zm3.6 2.2h-1l-.3 2.9h1c1.2 0 1.8-.4 2-1.5.2-1-.3-1.4-1.7-1.4Zm5.7-4h2.8l-.3 2.5c.8-.6 1.7-.9 2.8-.9 2.1 0 3.1 1.1 2.8 3.2l-.7 4.2h-2.9l.6-3.7c.2-1-.2-1.4-1.1-1.4-1.1 0-1.8.6-2 1.8l-.5 3.3h-2.9l1.4-9Z"/></svg>`
  };
  return icons[name] || `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="3" width="26" height="26" rx="5"/><path class="tech-icon-detail" d="m13 10-6 6 6 6 2-2-4-4 4-4-2-2Zm6 0-2 2 4 4-4 4 2 2 6-6-6-6Z"/></svg>`;
}

function technologyKey(value) {
  return hasText(value) ? value.toLowerCase().replace(/[^a-z0-9-]/g, "") : "code";
}

function renderWork(data) {
  const heading = document.querySelector('[data-content="work-heading"]');
  const root = document.querySelector('[data-content="work"]');
  const items = records(data?.items);
  const socialLinks = records(data?.socialLinks).filter((link) => hasText(link.label) && hasText(link.href));
  const creator = data?.creatorSpotlight;
  const creatorProofs = list(creator?.proofs).filter(hasText);
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

  const councilDetails = roleLinks.length ? `<details class="content-details council-details">
    <summary><span>${text(role.linksSummary || role.linksLabel || ui("labels.browseCouncilWork"))} <b>${roleLinks.length}</b></span></summary>
    <div class="content-details-panel role-links">
      ${creator && (hasText(role.summary) || (hasText(role.organizationLinkLabel) && hasText(role.organizationUrl))) ? `<div class="council-details-copy">
        ${hasText(role.summary) ? `<p class="council-details-summary">${text(role.summary)}</p>` : ""}
        ${hasText(role.organizationLinkLabel) && hasText(role.organizationUrl) ? `<a class="role-organization-link" href="${attr(role.organizationUrl)}" target="_blank" rel="noopener">${hasText(role.organizationLinkIcon) ? `<span class="role-organization-icon" aria-hidden="true">${socialIcon(role.organizationLinkIcon)}</span>` : ""}<span>${text(role.organizationLinkLabel)}</span> <span aria-hidden="true">&nearr;</span></a>` : ""}
      </div>` : ""}
      <div class="role-links-header">
        ${roleLinks.length > 1 ? `<div class="scroll-controls council-work-controls" role="group" aria-label="${attr(ui("labels.councilWorkControls"))}">
          <button type="button" data-scroll-target="council-work-track" data-scroll-direction="-1" aria-label="${attr(ui("labels.scrollCouncilWorkLeft"))}">&larr;</button>
          <button type="button" data-scroll-target="council-work-track" data-scroll-direction="1" aria-label="${attr(ui("labels.scrollCouncilWorkRight"))}">&rarr;</button>
        </div>` : ""}
      </div>
      <div class="role-links-track council-work-track horizontal-track" id="council-work-track" tabindex="0" aria-label="${attr(ui("labels.councilWorkTrack"))}">${roleLinks.map((link) => `<a class="selected-role-link" href="${attr(link.href)}" target="_blank" rel="noopener">${text(link.label)} &nearr;</a>`).join("")}</div>
    </div>
  </details>` : "";

  root.innerHTML = `
    <div class="subsection-title">
      <p><span>${text(ui("sectionIndexes.video"))}</span> ${text(data.label)}</p>
      <div class="subsection-side">
        ${socialLinks.length ? `<div class="video-social-group">
          ${hasText(data.socialLinksLabel) ? `<span class="video-social-label">${text(data.socialLinksLabel)}</span>` : ""}
          <div class="video-social-links" aria-label="${attr(ui("labels.videoChannels"))}">${socialLinks.map((link) => `<a class="video-social-link" href="${attr(link.href)}" target="_blank" rel="noopener" aria-label="${attr(link.label)}" title="${attr(link.label)}">${socialIcon(link.icon)}</a>`).join("")}</div>
        </div>` : ""}
      </div>
    </div>
    ${role && (hasText(role.title) || hasText(role.organization)) ? `<aside class="role-spotlight header-card${creator && hasText(creator.title) ? " video-spotlight" : ""}" aria-label="${attr(creator?.title || role.title || ui("labels.featuredRole"))}">
      <div class="role-spotlight-heading header-card-primary">
        ${creator && hasText(creator.title) ? `
        ${hasText(creator.eyebrow) ? `<p class="eyebrow">${text(creator.eyebrow)}</p>` : ""}
        <div class="role-title-row">
          <h3>${text(creator.title)}</h3>
          ${hasText(creator.period) ? `<span class="role-period">${text(creator.period)}</span>` : ""}
        </div>
        ${hasText(creator.organization) ? `<p class="role-organization">${text(creator.organization)}</p>` : ""}
        ${hasText(creator.actionLabel) && hasText(creator.actionHref) ? `<div class="creator-action-row"><a class="header-card-action" href="${attr(creator.actionHref)}">${text(creator.actionLabel)} <span aria-hidden="true">&darr;</span></a></div>` : ""}
        ${creatorProofs.length ? `<ul class="creator-proof-list" aria-label="${attr(ui("labels.creatorResults"))}">${creatorProofs.map((proof) => `<li class="creator-proof">${text(proof)}</li>`).join("")}</ul>` : ""}` : `
        ${hasText(role.eyebrow) ? `<p class="eyebrow">${text(role.eyebrow)}</p>` : ""}
        <div class="role-title-row">
          ${hasText(role.title) ? `<h3>${text(role.title)}</h3>` : ""}
          ${hasText(role.period) ? `<span class="role-period">${text(role.period)}</span>` : ""}
        </div>
        ${hasText(role.organization) ? `<p class="role-organization">${text(role.organization)}</p>` : ""}
        ${hasText(role.organizationLinkLabel) && hasText(role.organizationUrl) ? `<a class="role-organization-link" href="${attr(role.organizationUrl)}" target="_blank" rel="noopener">${hasText(role.organizationLinkIcon) ? `<span class="role-organization-icon" aria-hidden="true">${socialIcon(role.organizationLinkIcon)}</span>` : ""}<span>${text(role.organizationLinkLabel)}</span> <span aria-hidden="true">&nearr;</span></a>` : ""}
        `}
      </div>
      <div class="role-spotlight-details header-card-secondary${creator && hasText(creator.title) ? " video-role-details" : ""}">
        ${creator && hasText(creator.title) ? `
        ${hasText(role.eyebrow) ? `<p class="eyebrow">${text(role.eyebrow)}</p>` : ""}
        <div class="role-title-row header-card-secondary-title">
          ${hasText(role.title) ? `<h4>${text(role.title)}</h4>` : ""}
          ${hasText(role.period) ? `<span class="role-period">${text(role.period)}</span>` : ""}
        </div>
        ${hasText(role.organization) ? `<p class="role-organization">${text(role.organization)}</p>` : ""}
        ${councilDetails}
        ` : ""}
        ${!creator && hasText(role.summary) ? `<p>${text(role.summary)}</p>` : ""}
      </div>
      ${!creator ? councilDetails : ""}
    </aside>` : ""}
    ${hasText(data.galleryLabel) ? `<p class="gallery-kicker">${text(data.galleryLabel)}</p>` : ""}
    ${items.length ? `<div class="gallery-shell">
      <div class="video-grid horizontal-track" id="video-track" tabindex="0" aria-label="${attr(ui("labels.videoProjectsTrack"))}">
        ${items.map((item, index) => {
          const resultBadge = hasText(item?.result)
            ? `<span class="case-result-badge"><strong>${text(item.result)}</strong>${hasText(item.resultDetail) ? `<small>${text(item.resultDetail)}</small>` : ""}</span>`
            : "";
          const media = hasText(item?.video)
            ? `<button class="case-media video-trigger" type="button" data-video="${attr(item.video)}" aria-label="${attr(ui("labels.playPrefix"))} ${attr(item.title)}">
                <img src="${attr(item.image)}" alt="${attr(item.imageAlt)}" loading="${index ? "lazy" : "eager"}">
                ${resultBadge}
                <span class="play-pill" aria-hidden="true"><i></i></span>
              </button>`
            : hasText(item?.image) && hasText(item?.postUrl)
              ? `<a class="case-media" href="${attr(item.postUrl)}" target="_blank" rel="noopener" aria-label="${attr(item.actionLabel || ui("labels.watchOriginal"))}: ${attr(item.title)}">
                  <img src="${attr(item.image)}" alt="${attr(item.imageAlt)}" loading="${index ? "lazy" : "eager"}">
                  ${resultBadge}
                  <span class="play-pill" aria-hidden="true"><i></i></span>
                </a>`
            : "";
          return `<article class="case-study">
            ${media}
            <div class="case-copy">
              ${hasText(item?.category) || hasText(item?.postUrl) ? `<div class="case-meta-row">
                ${hasText(item?.category) ? `<p class="case-category">${hasText(item.platform) ? `<span class="case-platform-icon case-platform-${attr(technologyKey(item.platform))}" role="img" aria-label="${attr(item.platform)}" title="${attr(item.platform)}">${socialIcon(technologyKey(item.platform))}</span>` : ""}<span>${text(item.category)}</span></p>` : ""}
                ${hasText(item?.postUrl) ? `<a class="case-original-link" href="${attr(item.postUrl)}" target="_blank" rel="noopener" aria-label="${attr(ui("labels.watchOriginal"))}: ${attr(item.title)}">${text(item.linkLabel || data.watchLabel || ui("labels.watch"))} <span aria-hidden="true">&nearr;</span></a>` : ""}
              </div>` : ""}
              ${hasText(item?.title) ? `<h3>${text(item.title)}</h3>` : ""}
              ${hasText(item?.description) ? `<p>${text(item.description)}</p>` : ""}
            </div>
          </article>`;
        }).join("")}
      </div>
      ${galleryControls("video-track", ui("gallery.videoProject"), items.length)}
    </div>` : ""}`;
}

function renderDevelopment(data) {
  const root = document.querySelector('[data-content="dev"]');
  const projects = records(data?.projects);
  const role = data?.roleSpotlight;
  const roleLinks = records(role?.links).filter((link) => hasText(link.label) && hasText(link.href));
  const visible = data && (hasText(data.heading) || projects.length || hasText(role?.title) || hasText(role?.organization));
  setVisible(root, visible);
  if (!visible) return;

  root.innerHTML = `
    <div class="subsection-title">
      <p><span>${text(ui("sectionIndexes.development"))}</span> ${text(data.label)}</p>
      <div class="subsection-side">
        ${hasText(data.externalLabel) && hasText(data.externalUrl) ? `<a class="external-project-link" href="${attr(data.externalUrl)}" target="_blank" rel="noopener">${hasText(data.externalIcon) ? `<span class="external-project-icon" aria-hidden="true">${socialIcon(data.externalIcon)}</span>` : ""}<span>${text(data.externalLabel)}</span><span aria-hidden="true">&nearr;</span></a>` : ""}
      </div>
    </div>
    ${role && (hasText(role.title) || hasText(role.organization)) ? `<aside class="role-spotlight header-card development-role" aria-label="${attr(role.title || ui("labels.featuredWebRole"))}">
      <div class="role-spotlight-heading header-card-primary">
        ${hasText(role.eyebrow) ? `<p class="eyebrow">${text(role.eyebrow)}</p>` : ""}
        <div class="role-title-row">
          ${hasText(role.title) ? `<h3>${text(role.title)}</h3>` : ""}
          ${hasText(role.period) ? `<span class="role-period">${text(role.period)}</span>` : ""}
        </div>
        ${hasText(role.organization) ? `<p class="role-organization">${text(role.organization)}</p>` : ""}
        ${hasText(role.organizationLinkLabel) && hasText(role.organizationUrl) ? `<a class="role-organization-link" href="${attr(role.organizationUrl)}" target="_blank" rel="noopener">${hasText(role.organizationLinkIcon) ? `<span class="role-organization-icon" aria-hidden="true">${socialIcon(role.organizationLinkIcon)}</span>` : ""}<span>${text(role.organizationLinkLabel)}</span> <span aria-hidden="true">&nearr;</span></a>` : ""}
      </div>
      <div class="role-spotlight-details header-card-secondary">
        ${hasText(role.detailEyebrow) ? `<p class="eyebrow">${text(role.detailEyebrow)}</p>` : ""}
        ${hasText(role.detailTitle) ? `<div class="role-title-row header-card-secondary-title"><h4>${text(role.detailTitle)}</h4></div>` : ""}
        ${hasText(role.summary) ? `<p>${text(role.summary)}</p>` : ""}
        ${roleLinks.length ? `<div class="role-links">
          ${hasText(role.linksLabel) ? `<span>${text(role.linksLabel)}</span>` : ""}
          <div>${roleLinks.map((link) => `<a href="${attr(link.href)}" target="_blank" rel="noopener">${text(link.label)} &nearr;</a>`).join("")}</div>
        </div>` : ""}
      </div>
    </aside>` : ""}
    ${hasText(data.heading) || hasText(data.description) ? `<div class="dev-intro">
      ${hasText(data.heading) ? `<h3>${text(data.heading)}</h3>` : ""}
      ${hasText(data.description) ? `<p>${text(data.description)}</p>` : ""}
    </div>` : ""}
    ${hasText(data.galleryLabel) ? `<p class="gallery-kicker">${text(data.galleryLabel)}</p>` : ""}
    ${projects.length ? `<div class="gallery-shell">
      <div class="repo-list horizontal-track" id="project-track" tabindex="0" aria-label="${attr(ui("labels.softwareProjectsTrack"))}">
        ${projects.map((project, index) => {
          const technologies = records(project?.technologies).filter((technology) => hasText(technology.name));
          return `<article>
          <div class="repo-index">${pad(index)}</div>
          <div>
            ${technologies.length ? `<ul class="tech-icons" aria-label="${attr(ui("labels.technologiesUsed"))}">${technologies.map((technology) => {
              const iconKey = technologyKey(technology.icon);
              return `<li class="tech-icon tech-icon-${attr(iconKey)}" aria-label="${attr(technology.name)}" title="${attr(technology.name)}">${technologyIcon(iconKey)}</li>`;
            }).join("")}</ul>` : ""}
            ${hasText(project?.title) ? `<h4>${text(project.title)}</h4>` : ""}
            ${hasText(project?.description) ? `<span>${text(project.description)}</span>` : ""}
            ${list(project?.features).length ? `<details class="content-details repo-details">
              <summary>${text(project.detailsLabel || data.detailsLabel || ui("labels.projectDetails"))}</summary>
              <div class="content-details-panel"><ul class="repo-features">${list(project.features).map((feature) => `<li>${text(feature)}</li>`).join("")}</ul></div>
            </details>` : ""}
          </div>
          ${hasText(project?.repoUrl) || hasText(project?.liveUrl) ? `<div class="repo-links">
            ${hasText(project.liveUrl) ? `<a href="${attr(project.liveUrl)}" target="_blank" rel="noopener">${text(project.liveLabel || data.liveLabel || ui("labels.viewWebsite"))} &nearr;</a>` : ""}
            ${hasText(project.repoUrl) ? `<a href="${attr(project.repoUrl)}" target="_blank" rel="noopener">${text(project.repoLabel || data.repoLabel || ui("labels.viewCode"))} &nearr;</a>` : ""}
          </div>` : ""}
        </article>`;
        }).join("")}
      </div>
      ${galleryControls("project-track", ui("gallery.softwareProject"), projects.length)}
    </div>` : ""}`;
}

function vaToolIcon(name) {
  const latestIcons = {
    shopify: "https://api.iconify.design/logos:shopify.svg",
    sheets: "https://api.iconify.design/simple-icons:googlesheets.svg?color=%2334A853",
    gmail: "https://api.iconify.design/logos:google-gmail.svg",
    canva: "https://api.iconify.design/devicon:canva.svg",
    calendar: "https://api.iconify.design/logos:google-calendar.svg",
    trello: "https://api.iconify.design/logos:trello.svg",
    drive: "https://api.iconify.design/logos:google-drive.svg",
    meta: "https://api.iconify.design/logos:meta-icon.svg",
    capcut: "https://api.iconify.design/hugeicons:capcut.svg?color=%23111111"
  };
  if (latestIcons[name]) {
    return `<img src="${attr(latestIcons[name])}" alt="" width="20" height="20" loading="lazy" decoding="async">`;
  }

  const icons = {
    shopify: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#95BF47" d="m5 7 2-1.2C7.7 3.4 9.1 2 11 2c.5 0 1 .2 1.3.5.5-.2.9-.3 1.4-.3 1.5 0 2.5 1.2 3 3.2L19 7l-1.5 14.5L6.2 19.4 5 7Z"/><path fill="#5E8E3E" d="m16.7 6.4 2.3.6-1.5 14.5-2.2-.4 1.4-14.7Z"/><path fill="#fff" d="M13.8 8.8c-.5-.3-1.2-.5-1.8-.5-1.4 0-1.5.9-1.5 1.1 0 1.2 3.2 1.7 3.2 4.5 0 2.2-1.4 3.6-3.4 3.6-2.4 0-3.6-1.5-3.6-1.5l.7-2.1s1.2 1.1 2.2 1.1c.7 0 .9-.5.9-.9 0-1.6-2.6-1.7-2.6-4.3 0-2.2 1.6-4.3 4.8-4.3 1.2 0 1.8.4 1.8.4l-.7 2.9Z"/></svg>`,
    sheets: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#0F9D58" d="M5 2h9l5 5v15H5V2Z"/><path fill="#87CEAC" d="M14 2v5h5l-5-5Z"/><path fill="#fff" d="M8 10h8v8H8v-8Zm1.5 1.5v1.2h2v-1.2h-2Zm3.4 0v1.2h1.6v-1.2h-1.6Zm-3.4 2.6v1.2h2v-1.2h-2Zm3.4 0v1.2h1.6v-1.2h-1.6Zm-3.4 2.6v.8h2v-.8h-2Zm3.4 0v.8h1.6v-.8h-1.6Z"/></svg>`,
    gmail: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M3 6.5 7 9.4V19H4a1 1 0 0 1-1-1V6.5Z"/><path fill="#34A853" d="M17 9.4 21 6.5V18a1 1 0 0 1-1 1h-3V9.4Z"/><path fill="#EA4335" d="M3.7 5.1A2 2 0 0 1 6 5.3l6 4.4 6-4.4a2 2 0 0 1 3 .9l-9 6.6-9-6.6c.1-.4.3-.8.7-1.1Z"/><path fill="#FBBC04" d="m3 6.2 4 3v3.1l-4-3V6.2Z"/><path fill="#C5221F" d="m21 6.2-4 3v3.1l4-3V6.2Z"/></svg>`,
    canva: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#00C4CC"/><path fill="#fff" d="M15.7 15.4c-1.1 1.1-2.3 1.7-3.7 1.7-2.7 0-4.5-1.8-4.5-4.6 0-3.2 2.3-5.7 5.5-5.7 1.4 0 2.6.5 3.4 1.4l-1.2 1.6c-.7-.6-1.4-.9-2.2-.9-1.8 0-3.1 1.5-3.1 3.5 0 1.6.9 2.6 2.4 2.6.9 0 1.7-.4 2.5-1.1l.9 1.5Z"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path fill="#fff" d="M7 8h10v9H7V8Z"/><path fill="#EA4335" d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3H3V5Z"/><path fill="#188038" d="M3 14h4v7H5a2 2 0 0 1-2-2v-5Z"/><path fill="#FBBC04" d="M17 14h4v5a2 2 0 0 1-2 2h-2v-7Z"/><path fill="#4285F4" d="M9 10h6v5H9v-5Z"/><path fill="#fff" d="M11 11h2v3h-2v-3Z"/></svg>`,
    trello: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="4" fill="#0052CC"/><rect x="6" y="6" width="5" height="11" rx="1" fill="#fff"/><rect x="13" y="6" width="5" height="8" rx="1" fill="#fff"/></svg>`,
    drive: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#0F9D58" d="m8.2 3 3.1 5.4L5.2 19H2l6.2-10.7L5.1 3h3.1Z"/><path fill="#F4B400" d="M8.2 3h7.5l3.1 5.4h-7.5L8.2 3Z"/><path fill="#4285F4" d="M11.3 8.4h7.5L22 14l-3 5H5.2l6.1-10.6Z"/></svg>`,
    meta: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#0668E1"/><path fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" d="M5.5 14.8c1.4-5.2 3-7.5 4.6-7.5 2.4 0 3.9 8.5 6.4 8.5 1.1 0 1.8-1 2-2.3.4-2.4-.4-5.8-2.5-5.8-2.7 0-5.2 8.1-8 8.1-1.2 0-2.1-.6-2.5-1Z"/></svg>`,
    capcut: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="4" fill="#111"/><path fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M6 8h12l-4 4 4 4H6l4-4-4-4Zm0-2 12 12M18 6 6 18"/></svg>`
  };
  return icons[name] || technologyIcon("code");
}

function renderOperations(data) {
  const root = document.querySelector('[data-content="operations"]');
  const items = records(data?.items);
  const role = data?.roleSpotlight;
  const visible = data && (hasText(data.heading) || items.length || hasText(role?.title));
  setVisible(root, visible);
  if (!visible) return;

  root.innerHTML = `
    <div class="subsection-title">
      <p><span>${text(ui("sectionIndexes.operations"))}</span> <span class="operations-label-full">${text(data.label)}</span>${hasText(data.mobileLabel) ? `<span class="operations-label-mobile">${text(data.mobileLabel)}</span>` : ""}</p>
      ${hasText(data.status) ? `<span class="operations-status-full">${text(data.status)}</span>` : ""}
      ${hasText(data.mobileStatus) ? `<span class="operations-status-mobile">${text(data.mobileStatus)}</span>` : ""}
    </div>
    ${role && hasText(role.title) ? `<aside class="role-spotlight header-card operations-role" aria-label="${attr(role.title)}">
      <div class="role-spotlight-heading header-card-primary">
        ${hasText(role.eyebrow) ? `<p class="eyebrow">${text(role.eyebrow)}</p>` : ""}
        <div class="role-title-row">
          <h3>${text(role.title)}</h3>
          ${hasText(role.period) ? `<span class="role-period">${text(role.period)}</span>` : ""}
        </div>
        ${hasText(role.organization) ? `<p class="role-organization">${text(role.organization)}</p>` : ""}
      </div>
      <div class="role-spotlight-details header-card-secondary">
        ${hasText(role.detailEyebrow) ? `<p class="eyebrow">${text(role.detailEyebrow)}</p>` : ""}
        ${hasText(role.detailTitle) ? `<div class="role-title-row header-card-secondary-title"><h4>${text(role.detailTitle)}</h4></div>` : ""}
        ${hasText(role.summary) ? `<p>${text(role.summary)}</p>` : ""}
        ${items.length && hasText(role.actionLabel) && hasText(role.actionHref) ? `<a class="role-organization-link" href="${attr(role.actionHref)}">${text(role.actionLabel)} <span aria-hidden="true">&darr;</span></a>` : ""}
      </div>
    </aside>` : ""}
    ${hasText(data.eyebrow) || hasText(data.heading) || hasText(data.description) ? `<div class="operations-intro">
      <div class="operations-statement">
        ${hasText(data.eyebrow) ? `<p class="eyebrow">${text(data.eyebrow)}</p>` : ""}
        ${hasText(data.heading) ? `<h3>${text(data.heading)}</h3>` : ""}
      </div>
      ${hasText(data.description) ? `<p>${text(data.description)}</p>` : ""}
    </div>` : ""}
    ${hasText(data.galleryLabel) ? `<p class="gallery-kicker">${text(data.galleryLabel)}</p>` : ""}
    ${items.length ? `<div class="gallery-shell" id="operations-workflows">
      <div class="operations-cards horizontal-track" id="operations-track" tabindex="0" aria-label="${attr(ui("labels.workflowSamplesTrack"))}">${items.map((item, index) => {
      const deliverables = list(item?.deliverables).filter(hasText);
      const tools = records(item?.tools).filter((tool) => hasText(tool.name));
      return `<article class="operations-card">
        <div class="operations-card-top">
          <span class="operations-card-number">${pad(index)}</span>
          ${hasText(data.sampleLabel) ? `<span class="operations-sample-label">${text(data.sampleLabel)}</span>` : ""}
        </div>
        ${hasText(item.category) ? `<p class="operations-category">${text(item.category)}</p>` : ""}
        ${hasText(item.title) ? `<h4>${text(item.title)}</h4>` : ""}
        ${hasText(item.problem) ? `<p class="operations-scope">${text(item.problem)}</p>` : ""}
        ${hasText(item.outcome) ? `<p class="operations-outcome">${text(item.outcome)}</p>` : ""}
        ${deliverables.length ? `<details class="content-details operations-details">
          <summary>${text(item.deliverablesLabel || ui("labels.viewDetails"))}</summary>
          <div class="content-details-panel operations-deliverables">
            <ul>${deliverables.map((deliverable) => `<li>${text(deliverable)}</li>`).join("")}</ul>
          </div>
        </details>` : ""}
        ${tools.length ? `<ul class="operations-tools" aria-label="${attr(ui("labels.toolsUsed"))}">${tools.map((tool) => {
          const iconKey = technologyKey(tool.icon);
          return `<li class="operations-tool operations-tool-${attr(iconKey)}" aria-label="${attr(tool.name)}" title="${attr(tool.name)}"><span class="operations-tool-icon" aria-hidden="true">${vaToolIcon(iconKey)}</span><span class="sr-only">${text(tool.name)}</span></li>`;
        }).join("")}</ul>` : ""}
      </article>`;
    }).join("")}</div>
      ${galleryControls("operations-track", ui("gallery.workflow"), items.length)}
    </div>` : ""}
    ${hasText(data.tools) || hasText(data.approach) ? `<div class="operations-footer">
      ${hasText(data.tools) ? `<p class="operations-note">${text(ui("labels.toolsPrefix"))} ${text(data.tools)}</p>` : ""}
      ${hasText(data.approach) ? `<p class="operations-disclosure">${text(data.approach)}</p>` : ""}
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
      <div class="proof-grid horizontal-track" id="proof-track" tabindex="0" aria-label="${attr(ui("labels.analyticsProofTrack"))}">
        ${items.map((item) => `<button class="proof-card image-trigger" type="button" data-image="${attr(item?.image)}" data-alt="${attr(item?.alt)}">
          <span class="proof-card-top"><strong>${text(item?.value)}</strong><small>${text(item?.detail)}</small></span>
          ${hasText(item?.image) ? `<img src="${attr(item.image)}" alt="${attr(item.alt)}" loading="lazy">` : ""}
          <span class="proof-card-bottom">${text(item?.title)} <i>${text(ui("labels.expand"))} &nearr;</i></span>
        </button>`).join("")}
      </div>
      ${galleryControls("proof-track", ui("gallery.analyticsProof"), items.length)}
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
      <div class="testimonial-track horizontal-track" id="testimonial-track" tabindex="0" aria-label="${attr(ui("labels.clientTestimonialsTrack"))}">
        ${items.map((item) => `<figure class="testimonial-card">
          <blockquote>&ldquo;${text(item?.quote)}&rdquo;</blockquote>
          <figcaption><strong>${text(item?.name)}</strong>${hasText(item?.role) ? `<span>${text(item.role)}</span>` : ""}</figcaption>
        </figure>`).join("")}
      </div>
      ${galleryControls("testimonial-track", ui("gallery.clientTestimonial"), items.length)}
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
      ${paragraphs.length ? `<p>${text(paragraphs[0])}</p>` : ""}
      ${paragraphs.length > 1 ? `<details class="content-details about-details">
        <summary>${text(data.detailsLabel || ui("labels.moreAboutMe"))}</summary>
        <div class="content-details-panel">${paragraphs.slice(1).map((paragraph) => `<p>${text(paragraph)}</p>`).join("")}</div>
      </details>` : ""}
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
      <div class="credentials-kicker-row">
        ${hasText(data.eyebrow) ? `<p class="eyebrow">${text(data.eyebrow)}</p>` : ""}
        ${hasText(data.verificationLabel) && hasText(data.verificationUrl) ? `<div class="credentials-actions">
          <a href="${attr(data.verificationUrl)}" target="_blank" rel="noopener"><span class="linkedin-mark" aria-hidden="true">${text(ui("labels.linkedinMark"))}</span>${text(data.verificationLabel)}<span aria-hidden="true">&nearr;</span></a>
        </div>` : ""}
      </div>
      ${hasText(data.heading) ? `<h3 id="credentials-title">${text(data.heading)}</h3>` : ""}
      ${hasText(data.description) ? `<div class="credentials-proof">
        ${hasText(data.description) ? `<p>${text(data.description)}</p>` : ""}
      </div>` : ""}
    </div>
    ${items.length ? `<div class="gallery-shell">
      <div class="certificate-grid horizontal-track" id="certificate-track" tabindex="0" aria-label="${attr(ui("labels.certificatesTrack"))}">
        ${items.map((item) => `<button class="certificate-card image-trigger" type="button" data-image="${attr(item?.image)}" data-alt="${attr(item?.alt)}">
          <span class="certificate-image">${hasText(item?.image) ? `<img src="${attr(item.image)}" alt="${attr(item.alt)}" loading="lazy">` : ""}</span>
          <span class="certificate-meta"><span><small>${text(item?.issuer)}${hasText(item?.year) ? ` / ${text(item.year)}` : ""}</small><strong>${text(item?.title)}</strong></span><i>${text(ui("labels.expand"))} &nearr;</i></span>
        </button>`).join("")}
      </div>
      ${galleryControls("certificate-track", ui("gallery.certificate"), items.length)}
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
  const cvLink = links.find((link) => technologyKey(link.icon || link.label) === "cv");
  const socialLinks = links.filter((link) => link !== cvLink);
  const locationLines = list(data.locationLines).filter(hasText);

  root.innerHTML = `<div class="contact-inner">
    ${hasText(data.eyebrow) ? `<p class="eyebrow">${text(data.eyebrow)}</p>` : ""}
    ${hasText(data.heading) ? `<h2 id="contact-title">${text(data.heading)}${hasText(data.headingAccent) ? `<br><em>${text(data.headingAccent)}</em>` : ""}</h2>` : ""}
    ${hasText(data.description) ? `<p>${text(data.description)}</p>` : ""}
    ${hasText(data.email) ? `<a class="contact-email" href="mailto:${attr(data.email)}?subject=${subject}&amp;body=${body}"><span>${text(data.emailAction || ui("labels.startConversation"))}</span><strong>${text(data.emailLabel || data.email)}</strong><i aria-hidden="true">&nearr;</i></a>` : ""}
    ${links.length || locationLines.length ? `<div class="contact-meta">
      ${links.length ? `<div class="contact-link-group">
        <span class="contact-links-label">${text(ui("labels.connectWithMe"))}</span>
        <div class="contact-link-row">
          ${socialLinks.length ? `<div class="contact-social-links" aria-label="${attr(ui("labels.socialProfiles"))}">${socialLinks.map((link) => {
            const iconKey = technologyKey(link.icon || link.label);
            return `<a class="contact-social-link contact-social-${attr(iconKey)}" href="${attr(link.href)}" target="_blank" rel="noopener" aria-label="${attr(link.label)}" title="${attr(link.label)}">${socialIcon(iconKey)}</a>`;
          }).join("")}</div>` : ""}
          ${cvLink ? `<a class="contact-cv-link" href="${attr(cvLink.href)}" target="_blank" rel="noopener">${text(cvLink.label || ui("labels.viewCv"))} <span aria-hidden="true">&nearr;</span></a>` : ""}
        </div>
      </div>` : ""}
      ${locationLines.length ? `<p>${locationLines.map(text).join("<br>")}</p>` : ""}
    </div>` : ""}
  </div>`;

  if (data.footer && footer) {
    footer.innerHTML = `
      <p>&copy; <span id="year">${text(data.footer.year)}</span> ${text(data.footer.copyright)}</p>
      <p>${text(data.footer.note)}</p>
      ${hasText(data.footer.backToTop) ? `<a href="#top">${text(data.footer.backToTop)} &uarr;</a>` : ""}`;
  }
}

function updateCompositeSections() {
  const work = document.querySelector("#work");
  const workChildren = ["work-heading", "work", "dev", "operations"]
    .map((key) => document.querySelector(`[data-content="${key}"]`));
  if (work) work.hidden = !workChildren.some((child) => child && !child.hidden);

  const about = document.querySelector("#about");
  const aboutChildren = ["about", "credentials"]
    .map((key) => document.querySelector(`[data-content="${key}"]`));
  if (about) about.hidden = !aboutChildren.some((child) => child && !child.hidden);
}

function renderPortfolio(payload) {
  const { data, errors } = payload;
  renderInterface(data.ui);
  const renderers = [
    ["meta", renderMeta],
    ["nav", renderNavigation],
    ["hero", renderHero],
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
      status.textContent = ui("contentError");
      status.hidden = false;
    }
  }
}

window.portfolioContentReady = loadPortfolioContent().then(renderPortfolio);
