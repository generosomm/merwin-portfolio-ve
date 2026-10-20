"use strict";

window.portfolioContentReady.then(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const touch = matchMedia('(hover: none), (pointer: coarse)');
  const light = touch.matches || navigator.connection?.saveData || navigator.hardwareConcurrency <= 4;
  const active = new Set();
  const current = new WeakMap();
  let keyboard = false;

  document.addEventListener('keydown', () => {
    keyboard = true;
    document.documentElement.classList.add('keyboard-input');
  }, { capture: true });
  document.addEventListener('pointerdown', () => {
    keyboard = false;
    document.documentElement.classList.remove('keyboard-input');
  }, { capture: true, passive: true });
  document.addEventListener('pointermove', event => {
    if (!keyboard || event.pointerType !== 'mouse') return;
    keyboard = false;
    document.documentElement.classList.remove('keyboard-input');
  }, { passive: true });

  function reveal(element, delay = 0, switching = false) {
    if (!element?.animate || reduce.matches || document.hidden || (switching && keyboard)) return;
    current.get(element)?.cancel();
    const animation = element.animate([
      { opacity: switching ? .45 : 0, transform: `translateY(${light ? 6 : 14}px)` },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: switching ? (light ? 160 : 220) : (light ? 260 : 460), delay, easing: 'cubic-bezier(.23, 1, .32, 1)' });
    active.add(animation);
    current.set(element, animation);
    animation.onfinish = animation.oncancel = () => active.delete(animation);
  }

  const intro = document.querySelectorAll('.portrait-first, .portrait-solid, .portrait-outline, .portrait-foot > *');
  intro.forEach((element, index) => reveal(element, (element.matches('.portrait-outline') ? 1 : index) * (light ? 25 : 50)));

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      reveal(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: .15 });
  document.querySelectorAll('.project-deck, .work-archive, #edits .edit-card:nth-child(-n+3), .github-head').forEach(element => observer.observe(element));

  function cancel() { [...active].forEach(animation => animation.cancel()); }
  reduce.addEventListener('change', () => { if (reduce.matches) cancel(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
});
