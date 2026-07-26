"use strict";

const CONTENT_FILES = {
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
};

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
const pad = (index) => String(index + 1).padStart(2, "0");

function setMeta(selector, value) {
  const element = document.querySelector(selector);
  if (element && value) element.setAttribute("content", value);
}

async function loadPortfolioContent() {
  const entries = await Promise.all(
    Object.entries(CONTENT_FILES).map(async ([key, filename]) => {
      const response = await fetch(`data/${filename}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`data/${filename} returned ${response.status}`);
      return [key, await response.json()];
    })
  );
  return Object.fromEntries(entries);
}

function renderNavigation(data) {
  const header = document.querySelector(".site-header");
  if (!header) return;
  header.innerHTML = `
    <a class="brand" href="#top" aria-label="${attr(data.brand)}, home">
      <span class="brand-mark">MG</span>
      <span><strong>${text(data.brand)}</strong><small>${text(data.role)}</small></span>
    </a>
    <button class="menu-button" type="button" aria-expanded="false" aria-controls="site-nav">
      <span class="sr-only">Toggle navigation</span><span></span><span></span>
    </button>
    <nav class="site-nav" id="site-nav" aria-label="Primary navigation">
      ${data.links.map((link) => `<a href="${attr(link.href)}">${text(link.label)}</a>`).join("")}
      <a class="nav-cta" href="${attr(data.cta.href)}">${text(data.cta.label)} <span aria-hidden="true">↗</span></a>
    </nav>`;
}

function renderMeta(data) {
  if (!data) return;
  document.title = data.title;
  setMeta('meta[name="description"]', data.description);
  setMeta('meta[property="og:title"]', data.socialTitle);
  setMeta('meta[property="og:description"]', data.socialDescription);
  setMeta('meta[property="og:image"]', data.socialImage);
}

function renderHero(data) {
  const root = document.querySelector("#top");
  if (!root) return;
  root.innerHTML = `
    <div class="availability"><span class="status-dot" aria-hidden="true"></span>${text(data.availability)}</div>
    <div class="hero-layout">
      <div class="hero-copy">
        <p class="eyebrow">${text(data.eyebrow)}</p>
        <h1 id="hero-title">${text(data.title)}<br><em>${text(data.titleAccent)}</em></h1>
        <p class="hero-intro">${text(data.intro)}</p>
        <div class="hero-actions">
          <a class="button button-dark" href="${attr(data.primaryCta.href)}">${text(data.primaryCta.label)} <span aria-hidden="true">↓</span></a>
          <a class="button button-text" href="${attr(data.secondaryCta.href)}" target="_blank" rel="noopener">${text(data.secondaryCta.label)} <span aria-hidden="true">↗</span></a>
        </div>
        <ul class="hero-services" aria-label="Available services">
          ${data.services.map((service) => `<li>${text(service)}</li>`).join("")}
        </ul>
      </div>
      <aside class="hero-receipt" aria-label="Career highlights">
        <div class="receipt-top"><span>${text(data.receipt.label)}</span><span>${text(data.receipt.year)}</span></div>
        <p class="receipt-number">${text(data.receipt.value)}<span>${text(data.receipt.suffix)}</span></p>
        <p class="receipt-caption">${text(data.receipt.caption)}</p>
        <dl class="receipt-stats">${data.receipt.stats.map((stat) => `<div><dt>${text(stat.label)}</dt><dd>${text(stat.value)}</dd></div>`).join("")}</dl>
        <a href="${attr(data.receipt.linkHref)}">${text(data.receipt.linkLabel)} <span aria-hidden="true">↘</span></a>
      </aside>
    </div>`;
}

function renderServices(data) {
  const root = document.querySelector(".hire-menu");
  if (!root) return;
  root.innerHTML = `
    <div class="hire-menu-heading">
      <p class="eyebrow">${text(data.eyebrow)}</p>
      <div>
        <h3 id="hire-menu-title">${text(data.heading)}</h3>
        <p class="hire-menu-summary">${text(data.summary)}</p>
      </div>
    </div>
    <div class="hire-menu-grid">${data.items.map((item) => `
      <article>
        <span>${text(item.index)} / ${text(item.category)}</span>
        <h4>${text(item.title)}</h4><p>${text(item.description)}</p>
        <a href="${attr(item.linkHref)}">${text(item.linkLabel)} <span aria-hidden="true">↓</span></a>
      </article>`).join("")}</div>`;
}

function renderWork(data) {
  const heading = document.querySelector("#work > .section-heading");
  if (heading) heading.innerHTML = `
    <div><p class="eyebrow">${text(data.sectionEyebrow)}</p><h2 id="work-title">${text(data.sectionHeading)}</h2></div>
    <p>${text(data.sectionDescription)}</p>`;

  const root = document.querySelector("#editing");
  if (!root) return;
  root.innerHTML = `
    <div class="subsection-title">
      <p><span>01</span> ${text(data.label)}</p>
      <div class="subsection-side"><a href="${attr(data.externalUrl)}" target="_blank" rel="noopener">${text(data.externalLabel)} ↗</a><span class="drag-hint" aria-hidden="true">Drag to explore →</span></div>
    </div>
    <div class="gallery-shell">
      <div class="video-grid horizontal-track" id="video-track" tabindex="0" aria-label="Video projects. Scroll horizontally to explore.">
        ${data.items.map((item, index) => `
          <article class="case-study">
            ${item.video ? `
              <button class="case-media video-trigger" type="button" data-video="${attr(item.video)}" aria-label="Play ${attr(item.title)}">
                <img src="${attr(item.image)}" alt="${attr(item.imageAlt)}" loading="${index ? "lazy" : "eager"}">
                <span class="play-pill" aria-hidden="true"><i></i> ${text(item.actionLabel || "Play edit")}</span>
              </button>` : `
              <a class="case-media" href="${attr(item.postUrl)}" target="_blank" rel="noopener" aria-label="${attr(item.actionLabel || "Watch original")} — ${attr(item.title)}">
                <img src="${attr(item.image)}" alt="${attr(item.imageAlt)}" loading="${index ? "lazy" : "eager"}">
                <span class="play-pill" aria-hidden="true"><i></i> ${text(item.actionLabel || "Watch")}</span>
              </a>`}
            <div class="case-copy">
              <div class="case-label"><span>${text(item.category)}</span><span>${pad(index)} / ${String(data.items.length).padStart(2, "0")}</span></div>
              <h3>${text(item.title)}</h3><p>${text(item.description)}</p>
              <p class="case-scope"><strong>Focus</strong> ${text(item.focus)}</p>
              <strong class="case-result">${text(item.result)} <small>${text(item.resultDetail)}</small></strong>
              <a href="${attr(item.postUrl)}" target="_blank" rel="noopener">Watch original ↗</a>
            </div>
          </article>`).join("")}
      </div>
      ${galleryControls("video-track", "Video project")}
    </div>`;
}

function galleryControls(target, label) {
  return `<div class="scroll-controls gallery-controls" role="group" aria-label="${attr(label)} controls">
    <button type="button" data-scroll-target="${attr(target)}" data-scroll-direction="-1" aria-label="Scroll ${attr(label)}s left">←</button>
    <button type="button" data-scroll-target="${attr(target)}" data-scroll-direction="1" aria-label="Scroll ${attr(label)}s right">→</button>
  </div>`;
}

function renderDevelopment(data) {
  const root = document.querySelector("#development");
  if (!root) return;
  root.innerHTML = `
    <div class="subsection-title">
      <p><span>02</span> ${text(data.label)}</p>
      <div class="subsection-side"><a href="${attr(data.externalUrl)}" target="_blank" rel="noopener">${text(data.externalLabel)} ↗</a><span class="drag-hint" aria-hidden="true">Drag to explore →</span></div>
    </div>
    <div class="dev-intro"><h3>${text(data.heading)}</h3><p>${text(data.description)}</p></div>
    <div class="gallery-shell">
      <div class="repo-list horizontal-track" id="project-track" tabindex="0" aria-label="Software projects. Scroll horizontally to explore.">
        ${data.projects.map((project, index) => `
          <article>
            <div class="repo-index">${pad(index)}</div>
            <div><p>${text(project.stack)}</p><h4>${text(project.title)}</h4><span>${text(project.description)}</span>
              <ul class="repo-features">${project.features.map((feature) => `<li>${text(feature)}</li>`).join("")}</ul>
            </div>
            <div class="repo-links">
              <a href="${attr(project.repoUrl)}" target="_blank" rel="noopener">Repository ↗</a>
              ${project.liveUrl ? `<a href="${attr(project.liveUrl)}" target="_blank" rel="noopener">Live site ↗</a>` : ""}
            </div>
          </article>`).join("")}
      </div>
      ${galleryControls("project-track", "Software project")}
    </div>`;
}

function renderOperations(data) {
  const root = document.querySelector("#operations");
  if (!root) return;
  root.innerHTML = `
    <div class="subsection-title"><p><span>03</span> ${text(data.label)}</p><span>${text(data.status)}</span></div>
    <div class="operations-grid">
      <div class="operations-statement"><p class="eyebrow">${text(data.eyebrow)}</p><h3>${text(data.heading)}</h3><p>${text(data.description)}</p></div>
      <ol class="operations-list">${data.items.map((item, index) => `<li><span>${pad(index)}</span><div><strong>${text(item.title)}</strong><p>${text(item.description)}</p></div></li>`).join("")}</ol>
    </div>
    <div class="operations-footer">
      <p class="operations-note">Tools: ${text(data.tools)}</p>
      <p class="operations-disclosure"><strong>My approach:</strong> ${text(data.approach)}</p>
    </div>`;
}

function renderStats(data) {
  const root = document.querySelector("#proof");
  if (!root) return;
  root.innerHTML = `
    <div class="section-heading">
      <div><p class="eyebrow">${text(data.eyebrow)}</p><h2 id="proof-title">${text(data.heading)}</h2></div>
      <div class="section-heading-aside"><p>${text(data.description)}</p></div>
    </div>
    <div class="gallery-shell">
      <div class="proof-grid horizontal-track" id="proof-track" tabindex="0" aria-label="Analytics proof. Scroll horizontally to explore.">
        ${data.items.map((item) => `<button class="proof-card image-trigger" type="button" data-image="${attr(item.image)}" data-alt="${attr(item.alt)}">
          <span class="proof-card-top"><strong>${text(item.value)}</strong><small>${text(item.detail)}</small></span>
          <img src="${attr(item.image)}" alt="${attr(item.alt)}" loading="lazy">
          <span class="proof-card-bottom">${text(item.title)} <i>Expand ↗</i></span>
        </button>`).join("")}
      </div>
      ${galleryControls("proof-track", "Analytics proof")}
    </div>
    <p class="proof-total"><span>${text(data.totalLabel)}</span><strong>${text(data.total)} <small>${text(data.totalDetail)}</small></strong></p>`;
}

function renderAbout(data) {
  const root = document.querySelector(".about-layout");
  if (!root) return;
  root.innerHTML = `
    <div class="about-title"><p class="eyebrow">${text(data.eyebrow)}</p><h2 id="about-title">${text(data.heading)}</h2></div>
    <div class="about-copy">${data.paragraphs.map((paragraph) => `<p>${text(paragraph)}</p>`).join("")}
      <div class="about-facts">${data.facts.map((fact) => `<div><span>${text(fact.label)}</span><strong>${text(fact.value)}</strong></div>`).join("")}</div>
    </div>`;
}

function renderTestimonials(data) {
  const root = document.querySelector("#testimonials");
  if (!root || !data?.enabled || !data.items?.length) return;
  root.hidden = false;
  root.innerHTML = `
    <div class="section-heading">
      <div><p class="eyebrow">${text(data.eyebrow || "Client feedback")}</p><h2 id="testimonials-title">${text(data.heading || "What collaborators say.")}</h2></div>
      ${data.description ? `<p>${text(data.description)}</p>` : ""}
    </div>
    <div class="gallery-shell">
      <div class="testimonial-track horizontal-track" id="testimonial-track" tabindex="0" aria-label="Client testimonials. Scroll horizontally to explore.">
        ${data.items.map((item) => `<figure class="testimonial-card"><blockquote>“${text(item.quote)}”</blockquote><figcaption><strong>${text(item.name)}</strong><span>${text(item.role)}</span></figcaption></figure>`).join("")}
      </div>
      ${galleryControls("testimonial-track", "Client testimonial")}
    </div>`;
}

function renderCredentials(data) {
  const root = document.querySelector(".credentials");
  if (!root) return;
  root.innerHTML = `
    <div class="credentials-heading">
      <div><p class="eyebrow">${text(data.eyebrow)}</p><h3 id="credentials-title">${text(data.heading)}</h3></div>
      <div class="credentials-proof"><p>${text(data.description)}</p><div class="credentials-actions">
        <a href="${attr(data.verificationUrl)}" target="_blank" rel="noopener"><span class="linkedin-mark" aria-hidden="true">in</span>${text(data.verificationLabel)}<span aria-hidden="true">↗</span></a>
      </div></div>
    </div>
    <div class="gallery-shell">
      <div class="certificate-grid horizontal-track" id="certificate-track" tabindex="0" aria-label="Certificates. Scroll horizontally to explore.">
        ${data.items.map((item) => `<button class="certificate-card image-trigger" type="button" data-image="${attr(item.image)}" data-alt="${attr(item.alt)}">
          <span class="certificate-image"><img src="${attr(item.image)}" alt="${attr(item.alt)}" loading="lazy"></span>
          <span class="certificate-meta"><span><small>${text(item.issuer)} / ${text(item.year)}</small><strong>${text(item.title)}</strong></span><i>Expand ↗</i></span>
        </button>`).join("")}
      </div>
      ${galleryControls("certificate-track", "Certificate")}
    </div>`;
}

function renderContact(data) {
  const root = document.querySelector("#contact");
  const subject = encodeURIComponent(data.emailSubject);
  const body = encodeURIComponent(data.emailBody);
  if (root) root.innerHTML = `<div class="contact-inner">
    <p class="eyebrow">${text(data.eyebrow)}</p>
    <h2 id="contact-title">${text(data.heading)}<br><em>${text(data.headingAccent)}</em></h2>
    <p>${text(data.description)}</p>
    <a class="contact-email" href="mailto:${attr(data.email)}?subject=${subject}&amp;body=${body}"><span>Start a conversation</span><strong>${text(data.emailLabel)}</strong><i aria-hidden="true">↗</i></a>
    <div class="contact-meta"><div>${data.links.map((link) => `<a href="${attr(link.href)}" target="_blank" rel="noopener">${text(link.label)} ↗</a>`).join("")}</div><p>${data.locationLines.map(text).join("<br>")}</p></div>
  </div>`;

  const footer = document.querySelector(".site-footer");
  if (footer) footer.innerHTML = `<p>© <span id="year">${new Date().getFullYear()}</span> ${text(data.footer.copyright)}</p><p>${text(data.footer.note)}</p><a href="#top">${text(data.footer.backToTop)} ↑</a>`;
}

function renderPortfolio(data) {
  renderMeta(data.meta);
  renderNavigation(data.nav);
  renderHero(data.hero);
  renderServices(data.services);
  renderWork(data.work);
  renderDevelopment(data.dev);
  renderOperations(data.operations);
  renderStats(data.stats);
  renderTestimonials(data.testimonials);
  renderAbout(data.about);
  renderCredentials(data.credentials);
  renderContact(data.contact);
}

window.portfolioContentReady = loadPortfolioContent()
  .then(renderPortfolio)
  .catch((error) => {
    console.warn("JSON content could not be loaded; using the HTML fallback.", error);
  });
