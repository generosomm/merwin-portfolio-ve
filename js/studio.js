"use strict";

window.portfolioContentReady.then(() => {
  const hover = matchMedia('(hover: hover) and (pointer: fine)');
  const pinned = new WeakSet();
  document.querySelectorAll('.experience-entry').forEach(entry => {
    const summary = entry.querySelector('summary');
    entry.addEventListener('pointerenter', () => { if (hover.matches) entry.open = true; });
    entry.addEventListener('pointerleave', () => {
      if (!pinned.has(entry) && !entry.contains(document.activeElement)) entry.open = false;
    });
    entry.addEventListener('focusin', () => { entry.open = true; });
    entry.addEventListener('focusout', event => {
      if (!entry.contains(event.relatedTarget) && !pinned.has(entry) && !entry.matches(':hover')) entry.open = false;
    });
    summary.addEventListener('click', event => {
      event.preventDefault();
      if (pinned.has(entry)) { pinned.delete(entry); entry.open = false; }
      else { pinned.add(entry); entry.open = true; }
    });
    entry.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      summary.focus();
      pinned.delete(entry);
      entry.open = false;
    });
  });
});

window.portfolioContentReady.then(() => {
  const deck = document.querySelector('.project-deck');
  if (!deck) return;
  const cards = [...deck.querySelectorAll('.deck-card')];
  const descriptions = [...deck.querySelectorAll('.deck-info')];
  const stage = deck.querySelector('.deck-stage');
  const controls = deck.querySelector('.deck-controls');
  const position = deck.querySelector('.deck-position');
  const thumbStrip = deck.querySelector('.deck-thumbs');
  const thumbs = thumbStrip ? [...thumbStrip.querySelectorAll('[data-deck-jump]')] : [];
  let index = 0;
  let pointer = null;
  let suppressClick = false;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const cue = document.createElement('span');
  cue.className = 'project-cursor-cue';
  cue.textContent = deck.dataset.visitLabel;
  cue.setAttribute('aria-hidden', 'true');
  cue.hidden = true;
  document.body.append(cue);
  let cueFrame = 0;
  let cueX = 0;
  let cueY = 0;
  function hideCue() {
    /* Runs on every scroll event: touch the DOM only when it is showing. */
    if (cue.hidden && !cueFrame) return;
    cancelAnimationFrame(cueFrame);
    cueFrame = 0;
    cue.hidden = true;
  }
  stage.querySelectorAll('.studio-project-image a').forEach(link => {
    link.addEventListener('pointermove', event => {
      if (!finePointer.matches || event.pointerType !== 'mouse' || link.closest('.deck-card').dataset.position !== 'front') return;
      cueX = event.clientX;
      cueY = event.clientY;
      if (cueFrame) return;
      cueFrame = requestAnimationFrame(() => {
        cueFrame = 0;
        cue.hidden = false;
        const x = Math.max(8, Math.min(cueX + 16, innerWidth - cue.offsetWidth - 8));
        const y = Math.max(8, Math.min(cueY + 16, innerHeight - cue.offsetHeight - 8));
        cue.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
    }, { passive: true });
    link.addEventListener('pointerleave', hideCue);
    link.addEventListener('pointerdown', hideCue, { passive: true });
  });
  finePointer.addEventListener('change', hideCue);
  document.addEventListener('keydown', hideCue);
  document.addEventListener('visibilitychange', hideCue);
  document.addEventListener('scroll', hideCue, { passive: true });
  window.addEventListener('blur', hideCue);

  function show(next) {
    hideCue();
    index = (next + cards.length) % cards.length;
    cards.forEach((card, i) => {
      const offset = (i - index + cards.length) % cards.length;
      card.dataset.position = ['front', 'next', 'back'][offset] || 'off';
      card.hidden = offset > 2;
      card.inert = i !== index;
      card.setAttribute('aria-hidden', String(i !== index));
      descriptions[i].hidden = i !== index;
    });
    position.textContent = `${index + 1} / ${cards.length}`;
    thumbs.forEach((thumb, i) => {
      if (i === index) thumb.setAttribute('aria-current', 'true');
      else thumb.removeAttribute('aria-current');
    });
  }
  show(0);
  deck.classList.add('is-enhanced');
  controls.hidden = false;
  if (thumbs.length > 1) {
    thumbStrip.hidden = false;
    deck.classList.add('has-thumbs');
  }
  thumbStrip?.addEventListener('click', event => {
    const thumb = event.target.closest('[data-deck-jump]');
    if (thumb) show(Number(thumb.dataset.deckJump));
  });
  controls.querySelectorAll('button').forEach(button => { button.disabled = cards.length < 2; });
  stage.querySelectorAll('img').forEach(image => { image.draggable = false; });

  controls.addEventListener('click', event => {
    const button = event.target.closest('[data-deck-step]');
    if (button && !button.disabled) show(index + Number(button.dataset.deckStep));
  });
  deck.addEventListener('keydown', event => {
    if (event.target.closest('a') || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    show(event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : index + (event.key === 'ArrowRight' ? 1 : -1));
  });
  stage.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick = false;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }, { passive: true });
  window.addEventListener('pointerup', event => {
    if (!pointer || event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer = null;
    if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    suppressClick = true;
    show(index + (dx < 0 ? 1 : -1));
  });
  window.addEventListener('pointercancel', () => { pointer = null; });
  stage.addEventListener('click', event => {
    if (suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
    }
  }, true);
});

/* Services: the 3D object turns toward a fine pointer, then settles. */
window.portfolioContentReady.then(() => {
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('.service-item').forEach(item => {
    const shape = item.querySelector('.shape');
    if (!shape) return;
    let frame = 0;
    item.addEventListener('pointermove', event => {
      if (!finePointer.matches || reduce.matches || event.pointerType !== 'mouse' || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const box = item.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width - .5;
        const y = (event.clientY - box.top) / box.height - .5;
        shape.style.setProperty('--tx', `${(x * 40).toFixed(1)}deg`);
        shape.style.setProperty('--ty', `${(-y * 24).toFixed(1)}deg`);
      });
    }, { passive: true });
    item.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      frame = 0;
      shape.style.removeProperty('--tx');
      shape.style.removeProperty('--ty');
    });
  });
});

/* Navbar pill: the glass capsule follows the section being read (js/site.js
   sets aria-current), and the pill tucks away while scrolling down. */
window.portfolioContentReady.then(() => {
  const nav = document.querySelector('.pill-nav');
  const indicator = nav?.querySelector('.pill-indicator');
  if (!nav || !indicator) return;
  const root = document.documentElement;

  function place() {
    const link = [...nav.querySelectorAll('.chrome-nav-link[aria-current="true"]')].find(item => item.offsetParent);
    nav.classList.toggle('has-active', Boolean(link));
    if (!link) return;
    indicator.style.setProperty('--x', `${link.offsetLeft}px`);
    indicator.style.setProperty('--w', `${link.offsetWidth}px`);
  }
  new MutationObserver(place).observe(nav, { subtree: true, attributes: true, attributeFilter: ['aria-current'] });
  new ResizeObserver(place).observe(nav);
  place();

  /* Lift the pill above browser toolbars and the software keyboard. */
  const viewport = window.visualViewport;
  if (viewport) {
    /* A variable on <html> restyles the whole page, so only on change. */
    let liftedBy = -1;
    const lift = () => {
      const covered = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
      if (covered === liftedBy) return;
      liftedBy = covered;
      root.style.setProperty('--vv-bottom', `${covered}px`);
    };
    viewport.addEventListener('resize', lift);
    viewport.addEventListener('scroll', lift);
    lift();
  }

  /* It tucks away after ~24px of scrolling down and returns
     after ~16px back up, however slowly the scroll moves. */
  let last = window.scrollY;
  let turn = last;
  let down = true;
  let frame = 0;
  window.addEventListener('scroll', () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const y = window.scrollY;
      if ((y > last) !== down) { down = y > last; turn = last; }
      const busy = root.classList.contains('menu-open') || nav.contains(document.activeElement);
      const tucked = root.classList.contains('nav-tucked');
      if (tucked && (y < 120 || busy || (!down && turn - y > 16))) root.classList.remove('nav-tucked');
      else if (!tucked && !busy && y >= 120 && down && y - turn > 24) root.classList.add('nav-tucked');
      last = y;
    });
  }, { passive: true });
  nav.addEventListener('focusin', () => root.classList.remove('nav-tucked'));
});
