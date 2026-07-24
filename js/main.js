// Main Orchestration & Bootstrapper

async function init() {
  initTheme();
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
  initParallaxHero();

  initCustomCursor();
  initScrollProgress();
  initCursorGlow();
  initTimeWidget();
  initStaggeredText();
  initSoundDesign();
  initDynamicTitle();
  initSpotlightCards();
  initDeveloperMode();
  initMinimap();
  initPullString(data);

  // Scroll Progress for CV Knob
  window.addEventListener("scroll", () => {
    const scrollPx = document.documentElement.scrollTop;
    const winHeight = document.documentElement.clientHeight;
    const docHeight = document.documentElement.scrollHeight;
    const progress = scrollPx / (docHeight - winHeight);
    document.documentElement.style.setProperty("--scroll-progress", progress * 100 + "%");
  }, { passive: true });

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

// Launch portfolio initialization
init();