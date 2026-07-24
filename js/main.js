// main.js — entry point: loader, modals, init (depends on data.js, render.js, interactions.js)

/* ── Scroll Restoration ── */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.addEventListener("beforeunload", () => {
  sessionStorage.setItem("merwin_scroll_pos", window.scrollY);
});

/* ── Loading Screen ── */
function initLoader() {
  const bar = document.getElementById("loaderBar");
  if (!bar) return;
  bar.style.width = "40%";
  setTimeout(() => { if (bar.style.width !== "100%") bar.style.width = "75%"; }, 600);
}

function dismissLoader() {
  const loader = document.getElementById("loader");
  const bar = document.getElementById("loaderBar");
  if (!loader) return;

  setTimeout(() => {
    if (bar) bar.style.width = "100%";
    setTimeout(() => {
      // Restore scroll position before loader fades out
      const savedScroll = sessionStorage.getItem("merwin_scroll_pos");
      if (savedScroll !== null) window.scrollTo(0, parseInt(savedScroll, 10));
      loader.classList.add("is-hidden");
      setTimeout(() => loader.remove(), 850);
    }, 450);
  }, 1200);
}

/* ── Image Modal ── */
const imageModal    = document.getElementById("imageModal");
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

document.addEventListener("click", (e) => { if (e.target.matches("[data-img-close]")) closeImageModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && imageModal && imageModal.classList.contains("open")) closeImageModal(); });

/* ── Resume Modal ── */
const resumeModal      = document.getElementById("resumeModal");
const resumeModalIframe = document.getElementById("resumeModalIframe");
const resumeDownloadBtn = document.getElementById("resumeDownloadBtn");
const resumeFallbackBtn = document.getElementById("resumeFallbackBtn");

window.openResumeModal = function(src) {
  if (!resumeModal || !resumeModalIframe) return;

  const absoluteUrl = new URL(src, window.location.href).href;
  // Google Docs Viewer for mobile (no native inline PDF on iOS/Android)
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  resumeModalIframe.src = isMobile
    ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(absoluteUrl)}`
    : src + "#toolbar=0";

  if (resumeDownloadBtn) resumeDownloadBtn.href = src;
  if (resumeFallbackBtn) resumeFallbackBtn.href = src;

  resumeModal.classList.add("open");
  resumeModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
};

function closeResumeModal() {
  if (!resumeModal || !resumeModalIframe) return;
  resumeModal.classList.remove("open");
  resumeModal.setAttribute("aria-hidden", "true");
  setTimeout(() => { resumeModalIframe.src = ""; }, 300);
  document.body.style.overflow = "";
}

document.addEventListener("click", (e) => { if (e.target.matches("[data-resume-close]")) closeResumeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && resumeModal && resumeModal.classList.contains("open")) closeResumeModal(); });

/* ── Main Init ── */
async function init() {
  initTheme();
  initLoader();

  const { data, failed } = await loadData();

  // Render all sections
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

  // Initialize all interactions & effects
  initScrollSpy();
  initScrollReveal();
  initMagneticButtons();
  initCardTilt();
  initParallaxHero();
  initCustomCursor();
  initScrollProgress();
  initCursorGlow();
  initTimeWidget();
  initStaggeredText();
  initSoundDesign();
  initDynamicTitle();
  initSpotlightCards();

  // CV knob scroll progress
  window.addEventListener("scroll", () => {
    const scrollPx = document.documentElement.scrollTop;
    const winHeight = document.documentElement.clientHeight;
    const docHeight = document.documentElement.scrollHeight;
    document.documentElement.style.setProperty("--scroll-progress", (scrollPx / (docHeight - winHeight)) * 100 + "%");
  }, { passive: true });

  initDeveloperMode();
  initMinimap();
  initPullString(data);

  dismissLoader();

  // Fatal error fallback
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

init();