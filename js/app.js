"use strict";

const scrollPositionKey = `portfolio-scroll:${window.location.pathname}`;
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

function initializePortfolio() {
const menuButton = document.querySelector(".menu-button");
const navigation = document.querySelector(".site-nav");
const siteHeader = document.querySelector(".site-header");

function closeMenu() {
  if (!menuButton || !navigation) return;
  navigation.classList.remove("is-open");
  menuButton.setAttribute("aria-expanded", "false");
  document.body.classList.remove("menu-open");
}

menuButton?.addEventListener("click", () => {
  if (!navigation) return;
  const isOpen = navigation.classList.toggle("is-open");
  menuButton.setAttribute("aria-expanded", String(isOpen));
  document.body.classList.toggle("menu-open", isOpen);
});

navigation?.addEventListener("click", (event) => {
  if (event.target.closest("a")) closeMenu();
});

let navigationInputMethod = "keyboard";
navigation?.addEventListener("pointerdown", () => {
  navigationInputMethod = "pointer";
});
navigation?.addEventListener("keydown", () => {
  navigationInputMethod = "keyboard";
});

document.querySelectorAll(".nav-dropdown").forEach((dropdown) => {
  dropdown.addEventListener("pointerleave", (event) => {
    if (
      event.pointerType !== "mouse" ||
      navigationInputMethod !== "pointer" ||
      window.innerWidth <= 700
    ) return;

    const focusedElement = document.activeElement;
    if (focusedElement instanceof HTMLElement && dropdown.contains(focusedElement)) {
      focusedElement.blur();
    }
  });
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 700) closeMenu();
});

const navigationLinks = navigation
  ? Array.from(navigation.querySelectorAll(':scope > a[href^="#"], :scope > .nav-dropdown > a[href^="#"]'))
  : [];
const navigationSections = navigationLinks
  .map((link) => {
    const section = document.querySelector(link.getAttribute("href"));
    return section ? { link, section } : null;
  })
  .filter(Boolean);
let navigationFrame = null;
let scrollSaveFrame = null;

function updateActiveNavigation() {
  navigationFrame = null;
  if (!navigationSections.length) return;

  const headerHeight = siteHeader?.offsetHeight || 70;
  const marker = window.scrollY + headerHeight + window.innerHeight * 0.28;
  let activeEntry = null;

  navigationSections.forEach((entry) => {
    if (entry.section.offsetTop <= marker) activeEntry = entry;
  });

  const pageBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8;
  if (pageBottom) activeEntry = navigationSections.at(-1);

  navigationSections.forEach((entry) => {
    const isActive = entry === activeEntry;
    entry.link.classList.toggle("is-active", isActive);
    if (isActive) {
      entry.link.setAttribute("aria-current", "location");
    } else {
      entry.link.removeAttribute("aria-current");
    }
  });
}

function scheduleActiveNavigation() {
  if (navigationFrame !== null) return;
  navigationFrame = window.requestAnimationFrame(updateActiveNavigation);
}

function saveScrollPosition() {
  scrollSaveFrame = null;
  try {
    sessionStorage.setItem(scrollPositionKey, String(window.scrollY));
  } catch {
    // The portfolio still works if browser storage is unavailable.
  }
}

function scheduleScrollSave() {
  if (scrollSaveFrame !== null) return;
  scrollSaveFrame = window.requestAnimationFrame(saveScrollPosition);
}

window.addEventListener("scroll", () => {
  scheduleActiveNavigation();
  scheduleScrollSave();
}, { passive: true });
window.addEventListener("resize", scheduleActiveNavigation);
window.addEventListener("pagehide", saveScrollPosition);

const navigationEntry = performance.getEntriesByType?.("navigation")?.[0];
if (navigationEntry?.type === "reload") {
  let savedScrollPosition = Number.NaN;
  try {
    savedScrollPosition = Number.parseFloat(sessionStorage.getItem(scrollPositionKey));
  } catch {
    // Use the browser's current position when storage is unavailable.
  }

  if (Number.isFinite(savedScrollPosition)) {
    const restoreScrollPosition = () => {
      window.requestAnimationFrame(() => {
        window.scrollTo(0, savedScrollPosition);
        updateActiveNavigation();
      });
    };

    if (document.readyState === "complete") {
      restoreScrollPosition();
    } else {
      window.addEventListener("load", restoreScrollPosition, { once: true });
    }
  }
}

updateActiveNavigation();

const videoDialog = document.querySelector("#video-dialog");
const dialogVideo = videoDialog?.querySelector("video");

function closeVideo() {
  if (!videoDialog || !dialogVideo) return;
  dialogVideo.pause();
  dialogVideo.removeAttribute("src");
  dialogVideo.load();
  videoDialog.close();
}

document.querySelectorAll(".video-trigger").forEach((trigger) => {
  trigger.addEventListener("click", () => {
    if (!videoDialog || !dialogVideo || !trigger.dataset.video) return;
    dialogVideo.src = trigger.dataset.video;
    videoDialog.showModal();
    dialogVideo.play().catch(() => {
      // Autoplay may be disabled; native controls remain available.
    });
  });
});

videoDialog?.querySelector(".dialog-close")?.addEventListener("click", closeVideo);
videoDialog?.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeVideo();
});

const imageDialog = document.querySelector("#image-dialog");
const dialogImage = imageDialog?.querySelector("img");

function closeImage() {
  if (!imageDialog || !dialogImage) return;
  imageDialog.close();
  dialogImage.removeAttribute("src");
  dialogImage.alt = "";
}

document.querySelectorAll(".image-trigger").forEach((trigger) => {
  trigger.addEventListener("click", () => {
    if (!imageDialog || !dialogImage || !trigger.dataset.image) return;
    dialogImage.src = trigger.dataset.image;
    dialogImage.alt = trigger.dataset.alt || "Expanded analytics screenshot";
    imageDialog.showModal();
  });
});

imageDialog?.querySelector(".dialog-close")?.addEventListener("click", closeImage);
imageDialog?.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeImage();
});

[videoDialog, imageDialog].forEach((dialog) => {
  dialog?.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    if (dialog === videoDialog) closeVideo();
    if (dialog === imageDialog) closeImage();
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || link.classList.contains("skip-link")) return;

  const targetId = link.getAttribute("href");
  const target = targetId && targetId !== "#" ? document.querySelector(targetId) : null;
  if (!target) return;

  event.preventDefault();
  target.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start"
  });

  if (window.location.hash !== targetId) {
    history.pushState(null, "", targetId);
  }
});

document.querySelectorAll(".content-details").forEach((details) => {
  const summary = details.querySelector(":scope > summary");
  const panel = details.querySelector(":scope > .content-details-panel");

  if (!summary || !panel || !details.animate || reduceMotion) return;

  let detailsAnimation = null;
  let panelAnimation = null;
  let shouldBeOpen = details.open;
  let animationId = 0;

  function finishAnimation(open, id) {
    if (id !== animationId) return;

    details.open = open;
    details.classList.remove("is-expanding", "is-closing");
    details.style.removeProperty("height");
    details.style.removeProperty("overflow");
    panelAnimation?.cancel();
    detailsAnimation = null;
    panelAnimation = null;
  }

  function animateDetails(open) {
    animationId += 1;
    const currentAnimationId = animationId;
    const startHeight = details.getBoundingClientRect().height;

    detailsAnimation?.cancel();
    panelAnimation?.cancel();

    if (open) details.open = true;

    details.classList.toggle("is-expanding", open);
    details.classList.toggle("is-closing", !open);
    details.style.overflow = "hidden";

    const borderHeight =
      Number.parseFloat(getComputedStyle(details).borderTopWidth) +
      Number.parseFloat(getComputedStyle(details).borderBottomWidth);
    const endHeight = open
      ? summary.offsetHeight + panel.scrollHeight + borderHeight
      : summary.offsetHeight + borderHeight;
    const panelOpacity = Number.parseFloat(getComputedStyle(panel).opacity) || (open ? 0 : 1);

    detailsAnimation = details.animate(
      { height: [`${startHeight}px`, `${endHeight}px`] },
      { duration: open ? 420 : 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
    );

    panelAnimation = panel.animate(
      [
        {
          opacity: panelOpacity,
          transform: getComputedStyle(panel).transform === "none"
            ? (open ? "translateY(-8px)" : "translateY(0)")
            : getComputedStyle(panel).transform
        },
        {
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(-8px)"
        }
      ],
      {
        duration: open ? 360 : 220,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "both"
      }
    );

    detailsAnimation.addEventListener("finish", () => finishAnimation(open, currentAnimationId), { once: true });
  }

  summary.addEventListener("click", (event) => {
    event.preventDefault();
    shouldBeOpen = !shouldBeOpen;
    animateDetails(shouldBeOpen);
  });
});

document.querySelectorAll("[data-scroll-target]").forEach((button) => {
  button.addEventListener("click", () => {
    const targetId = button.dataset.scrollTarget;
    const direction = Number(button.dataset.scrollDirection);
    const track = targetId ? document.getElementById(targetId) : null;
    const items = track ? Array.from(track.children).filter((item) => item instanceof HTMLElement) : [];

    if (!track || !direction || !items.length) return;

    const trackRect = track.getBoundingClientRect();
    const nearestIndex = items.reduce((closestIndex, item, index) => {
      const itemRect = item.getBoundingClientRect();
      const closestRect = items[closestIndex].getBoundingClientRect();
      const viewportCenter = trackRect.left + track.clientWidth / 2;
      const itemDistance = Math.abs(itemRect.left + itemRect.width / 2 - viewportCenter);
      const closestDistance = Math.abs(closestRect.left + closestRect.width / 2 - viewportCenter);
      return itemDistance < closestDistance ? index : closestIndex;
    }, 0);
    const savedIndex = Number.parseInt(track.dataset.activeIndex, 10);
    const currentIndex = Number.isInteger(savedIndex) ? savedIndex : nearestIndex;
    const nextIndex = Math.max(0, Math.min(items.length - 1, currentIndex + direction));
    const nextItem = items[nextIndex];
    const nextRect = nextItem.getBoundingClientRect();
    const centeredLeft =
      track.scrollLeft +
      nextRect.left -
      trackRect.left -
      (track.clientWidth - nextRect.width) / 2;

    track.dataset.activeIndex = String(nextIndex);
    track.scrollTo({
      left: centeredLeft,
      behavior: reduceMotion ? "auto" : "smooth"
    });
  });
});

document.querySelectorAll(".horizontal-track").forEach((track) => {
  let isDragging = false;
  let startX = 0;
  let startScrollLeft = 0;
  let moved = false;
  let blockClick = false;
  let scrollSyncTimer = null;
  let lastTrackWidth = 0;

  function getItems() {
    return Array.from(track.children).filter((item) => item instanceof HTMLElement);
  }

  function nearestItemIndex() {
    const items = getItems();
    if (!items.length) return 0;

    const trackRect = track.getBoundingClientRect();
    const viewportCenter = trackRect.left + track.clientWidth / 2;
    return items.reduce((closestIndex, item, index) => {
      const itemRect = item.getBoundingClientRect();
      const closestRect = items[closestIndex].getBoundingClientRect();
      const itemDistance = Math.abs(itemRect.left + itemRect.width / 2 - viewportCenter);
      const closestDistance = Math.abs(closestRect.left + closestRect.width / 2 - viewportCenter);
      return itemDistance < closestDistance ? index : closestIndex;
    }, 0);
  }

  function updateTrackInsets() {
    const items = getItems();
    if (!items.length || !track.clientWidth) return;

    const widthChanged = Math.abs(track.clientWidth - lastTrackWidth) > 1;
    const trackWidth = track.clientWidth;
    const firstWidth = items[0].getBoundingClientRect().width;
    const lastWidth = items.at(-1).getBoundingClientRect().width;
    const centerSingleCard =
      window.innerWidth <= 700 &&
      !track.classList.contains("council-work-track");

    // Keep percentage-based card widths independent from the centering inset.
    // Track padding reduces the flex content box and can create a resize loop on
    // mobile browsers as their address bar appears or disappears while scrolling.
    track.style.paddingLeft = "0px";
    track.style.paddingRight = "0px";
    items[0].style.marginLeft = centerSingleCard
      ? `${Math.max((trackWidth - firstWidth) / 2, 0)}px`
      : "0px";
    items.at(-1).style.marginRight = centerSingleCard
      ? `${Math.max((trackWidth - lastWidth) / 2, 0)}px`
      : "0px";

    if (widthChanged) track.scrollLeft = 0;
    lastTrackWidth = trackWidth;
    track.dataset.activeIndex = String(nearestItemIndex());
  }

  function updateControls() {
    if (!track.id) return;

    const controls = document.querySelectorAll(`[data-scroll-target="${track.id}"]`);
    const atStart = track.scrollLeft <= 2;
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;

    controls.forEach((control) => {
      const direction = Number(control.dataset.scrollDirection);
      control.disabled = direction < 0 ? atStart : atEnd;
    });
  }

  track.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;

    isDragging = true;
    moved = false;
    delete track.dataset.activeIndex;
    startX = event.clientX;
    startScrollLeft = track.scrollLeft;
  });

  track.addEventListener("pointermove", (event) => {
    if (!isDragging) return;

    const distance = event.clientX - startX;
    if (Math.abs(distance) > 4 && !moved) {
      moved = true;
      track.setPointerCapture(event.pointerId);
      track.classList.add("is-dragging");
    }
    track.scrollLeft = startScrollLeft - distance;

    if (moved) event.preventDefault();
  });

  function finishDrag(event) {
    if (!isDragging) return;

    isDragging = false;
    blockClick = moved;
    track.classList.remove("is-dragging");

    if (track.hasPointerCapture(event.pointerId)) {
      track.releasePointerCapture(event.pointerId);
    }

    window.setTimeout(() => {
      blockClick = false;
    }, 0);
  }

  track.addEventListener("pointerup", finishDrag);
  track.addEventListener("pointercancel", finishDrag);
  track.addEventListener("pointerleave", (event) => {
    if (isDragging && !moved) finishDrag(event);
  });
  track.addEventListener("click", (event) => {
    if (!blockClick) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  track.addEventListener("scroll", () => {
    updateControls();
    window.clearTimeout(scrollSyncTimer);
    scrollSyncTimer = window.setTimeout(() => {
      track.dataset.activeIndex = String(nearestItemIndex());
    }, 180);
  }, { passive: true });
  track.closest("details")?.addEventListener("toggle", (event) => {
    if (event.currentTarget.open) {
      window.requestAnimationFrame(() => {
        updateTrackInsets();
        updateControls();
      });
    }
  });
  window.addEventListener("resize", () => {
    updateTrackInsets();
    updateControls();
  });
  window.addEventListener("load", () => {
    updateTrackInsets();
    updateControls();
  }, { once: true });
  updateTrackInsets();
  updateControls();
});

}

if (window.portfolioContentReady) {
  window.portfolioContentReady.finally(initializePortfolio);
} else {
  initializePortfolio();
}
