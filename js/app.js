"use strict";

const menuButton = document.querySelector(".menu-button");
const navigation = document.querySelector(".site-nav");

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

window.addEventListener("resize", () => {
  if (window.innerWidth > 700) closeMenu();
});

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

const revealTargets = document.querySelectorAll(
  ".section-heading, .case-study, .repo-list article, .operations-grid, .proof-card, .about-layout, .credentials"
);

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.querySelectorAll("[data-scroll-target]").forEach((button) => {
  button.addEventListener("click", () => {
    const targetId = button.dataset.scrollTarget;
    const direction = Number(button.dataset.scrollDirection);
    const track = targetId ? document.getElementById(targetId) : null;

    if (!track || !direction) return;

    track.scrollBy({
      left: direction * Math.max(track.clientWidth * 0.82, 280),
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

  track.addEventListener("scroll", updateControls, { passive: true });
  window.addEventListener("resize", updateControls);
  window.addEventListener("load", updateControls, { once: true });
  updateControls();
});

if ("IntersectionObserver" in window && !reduceMotion) {
  revealTargets.forEach((target) => target.classList.add("reveal"));

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -30px" });

  revealTargets.forEach((target) => revealObserver.observe(target));
}

const year = document.querySelector("#year");
if (year) year.textContent = String(new Date().getFullYear());
