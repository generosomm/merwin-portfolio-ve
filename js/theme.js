// Theme Switcher & Persistence (Dark / Light Mode)

function initTheme() {
  const savedTheme = localStorage.getItem("portfolio-theme");
  const modal = document.getElementById("themePromptModal");

  // Apply saved preference if present
  if (savedTheme === "light") {
    document.body.setAttribute("data-theme", "light");
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.body.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme");
  }

  // First visit theme selection prompt
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
      if (selectBtn) {
        applyChoice(selectBtn.getAttribute("data-select-theme"));
      } else if (e.target.classList.contains("theme-prompt-backdrop")) {
        applyChoice("dark");
      }
    });
  }

  // Toggle button listener in navbar
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
