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
