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
  }
  show(0);
  deck.classList.add('is-enhanced');
  controls.hidden = false;
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
