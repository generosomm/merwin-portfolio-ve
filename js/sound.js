/* ----------------------------------------------------------------
   Interface sounds: a light keyboard tick on hover and a mouse
   click on click, made from short noise bursts with the Web Audio
   API so there are no audio files to load.

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

  /* 60ms of white noise, made once and reused for every click. */
  let noise = null;
  function noiseBuffer() {
    if (noise) return noise;
    const length = Math.floor(audio.sampleRate * 0.06);
    noise = audio.createBuffer(1, length, audio.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return noise;
  }

  function ready() {
    if (muted || !audio) return false;
    if (audio.state === "suspended") audio.resume();
    return true;
  }

  /* A mechanical snap: a burst of noise, band-passed around `freq`,
     gone in `decay` seconds. `at` delays it from now. */
  function snap(freq, decay, volume, at = 0) {
    const start = audio.currentTime + at;
    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    source.buffer = noiseBuffer();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = 1.4;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
    source.connect(filter).connect(gain).connect(audio.destination);
    source.start(start);
    source.stop(start + decay + 0.01);
  }

  /* The low knock of a switch bottoming out under the snap. */
  function body(freq, decay, volume) {
    const start = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.6, start + decay);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(start + decay + 0.01);
  }

  /* Hover: one light key tick. */
  const hoverTick = () => {
    if (!ready()) return;
    snap(5200, 0.012, 0.09);
  };

  /* Click: a mouse button, press then release. */
  const clickTock = () => {
    if (!ready()) return;
    snap(3200, 0.018, 0.32);
    body(190, 0.03, 0.12);
    snap(4200, 0.012, 0.14, 0.055);
  };

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
