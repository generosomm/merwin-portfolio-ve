/* ----------------------------------------------------------------
   Interface sounds: a soft tick on hover and a tock on click, made
   with the Web Audio API so there are no audio files to load.

   - Browsers keep audio locked until the visitor's first click or
     key press, so hover ticks start after that.
   - Hover ticks need a real mouse and play at most once every 70ms;
     touch screens only hear clicks on links and buttons.
   - The sound button in the nav mutes everything; the choice is
     remembered in this browser (localStorage, guarded).
---------------------------------------------------------------- */
(() => {
  const KEY = "soundMuted";
  const TARGETS = "a[href], button, summary, [role='button']";
  const HOVER_GAP = 70;

  let muted = false;
  try { muted = localStorage.getItem(KEY) === "1"; } catch {}

  let audio = null;
  let lastHover = 0;
  let hovered = null;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");

  /* Created on the first gesture, the only time browsers allow it. */
  function unlock() {
    if (audio || muted) return;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    audio = new Context();
  }

  /* One short enveloped tone: freq glides to `to` over `length` seconds. */
  function tone(freq, to, length, volume, type = "sine") {
    if (muted || !audio) return;
    if (audio.state === "suspended") audio.resume();
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(to, now + length);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length);
    osc.connect(gain).connect(audio.destination);
    osc.start(now);
    osc.stop(now + length + 0.02);
  }

  const hoverTick = () => tone(2400, 1800, 0.035, 0.018, "triangle");
  const clickTock = () => tone(820, 420, 0.07, 0.05);

  function setMuted(value) {
    muted = value;
    try { localStorage.setItem(KEY, value ? "1" : "0"); } catch {}
    document.querySelectorAll(".sound-toggle").forEach((button) => {
      button.setAttribute("aria-pressed", String(!value));
    });
    if (!value) { unlock(); clickTock(); }
  }

  document.addEventListener("pointerdown", unlock, { capture: true, passive: true });
  document.addEventListener("keydown", unlock, { capture: true });

  document.addEventListener("pointerover", (event) => {
    if (event.pointerType !== "mouse" || !finePointer.matches) return;
    const target = event.target.closest?.(TARGETS);
    if (!target || target === hovered) return;
    hovered = target;
    const now = performance.now();
    if (now - lastHover < HOVER_GAP) return;
    lastHover = now;
    hoverTick();
  }, { passive: true });

  document.addEventListener("pointerout", (event) => {
    if (hovered && !hovered.contains(event.relatedTarget)) hovered = null;
  }, { passive: true });

  document.addEventListener("click", (event) => {
    const target = event.target.closest?.(TARGETS);
    if (!target) return;
    if (target.closest(".sound-toggle")) {
      setMuted(!muted);
      return;
    }
    clickTock();
  });

  /* The toggle is drawn by js/content.js; sync it once it exists. */
  Promise.resolve(window.portfolioContentReady).then(() => {
    document.querySelectorAll(".sound-toggle").forEach((button) => {
      button.setAttribute("aria-pressed", String(!muted));
    });
  });
})();
