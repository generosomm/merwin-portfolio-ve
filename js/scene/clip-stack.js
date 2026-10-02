/* =============================================================
   CLIP STACK — the hero's 3D layer.
   Six thin slabs fanned front-to-back like frames pulled off an
   editing timeline. A green playhead travels back through the deck
   as the hero scrolls away; the clip it touches lifts and catches
   the green light. Everything else is graphite, bone and fog.

   This module only builds and runs the scene. Deciding WHETHER to
   run it (WebGL, device, reduced motion, poster fallback) lives in
   ./boot.js.
   ============================================================= */

import {
  AdditiveBlending,
  AmbientLight,
  CanvasTexture,
  Color,
  DirectionalLight,
  Fog,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  TextureLoader,
  WebGLRenderer
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/* ---- Composition ---------------------------------------------
   World units. The camera frames a 2:1 window roughly 10 units
   wide, matching the .hero-scene box and the poster.
---------------------------------------------------------------- */

/* 9:16, like the short-form clips they stand for. Tall enough that
   the front clip shows above and below the name, not just between
   its letters. */
const SLAB = { width: 1.62, height: 2.88, depth: 0.07, radius: 0.06 };
/* The face covers nearly all of the front: only a hairline of the
   body shows around it, which is where the green edge light lives. */
const FACE_INSET = { x: 0.955, y: 0.97 };

/* Each clip steps right, up and back from the one before it. */
const FAN = { x: 0.82, y: 0.16, z: -0.85, turn: -0.4, roll: 0.018 };

/* The deck sits left of centre: the front clip fills the empty
   corner under the first line and beside the second, and the back
   of the fan recedes into fog behind the portrait. */
const DECK_OFFSET = { x: -1.55, y: 0.18 };

const LIFT = 0.22;
const TILT_MAX = { x: 0.05, y: 0.06 }; /* ~3 degrees */
const INTRO_SECONDS = 1.8;

/* Rest state, shared by the first live frame and the poster, so the
   fallback image is exactly what the scene shows before scrolling. */
const REST_PROGRESS = 0;

export function createClipStack(host, config, tokens, { onContextLost } = {}) {
  const count = MathUtils.clamp(Math.round(config.slabs || 6), 5, 7);
  const accentIntensity = MathUtils.clamp(Number(config.accentIntensity ?? 1), 0, 1.5);

  const colors = {
    ink: new Color(tokens.ink),
    graphite: new Color(tokens.graphite),
    face: new Color(tokens.face),
    bone: new Color(tokens.bone),
    accent: new Color(tokens.accent)
  };

  /* ---- Renderer ---------------------------------------------- */

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  const renderer = new WebGLRenderer({
    alpha: true,
    /* Above 1x the extra pixels already smooth the edges; MSAA on top
       of that is cost without a visible return. */
    antialias: pixelRatio < 1.25,
    powerPreference: "low-power"
  });
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);

  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  canvas.tabIndex = -1;
  host.appendChild(canvas);

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    stop();
    onContextLost?.();
  });

  /* ---- Scene + camera ---------------------------------------- */

  const scene = new Scene();
  /* Fog in the page colour: the back of the deck dissolves into the
     canvas rather than ending at a hard edge. */
  scene.fog = new Fog(colors.ink, 8.8, 15);

  const camera = new PerspectiveCamera(28, 2, 0.1, 40);
  camera.position.set(0, 0.2, 10);
  camera.lookAt(0, 0, -1.4);

  /* ---- Lights: one soft key, one green rim ------------------- */

  scene.add(new AmbientLight(colors.bone, 0.22));

  const key = new DirectionalLight(colors.bone, 1.5);
  key.position.set(-4, 5, 6);
  scene.add(key);

  const rim = new DirectionalLight(colors.accent, 1.1 * accentIntensity);
  rim.position.set(5, 1.5, -6);
  scene.add(rim);


  /* ---- Slabs --------------------------------------------------- */

  const rig = new Group(); /* cursor tilt + scroll drift */
  const deck = new Group(); /* the fan itself */
  rig.add(deck);
  scene.add(rig);

  const slabGeometry = new RoundedBoxGeometry(SLAB.width, SLAB.height, SLAB.depth, 3, SLAB.radius);
  const faceGeometry = new PlaneGeometry(SLAB.width * FACE_INSET.x, SLAB.height * FACE_INSET.y);
  const plainFaceMaterial = new MeshStandardMaterial({ color: colors.face, roughness: 0.95, metalness: 0 });

  const ownedMaterials = [plainFaceMaterial];
  const ownedTextures = [];
  const slabs = [];
  const middle = (count - 1) / 2;

  for (let index = 0; index < count; index += 1) {
    const step = index - middle;
    const slab = new Group();
    slab.position.set(step * FAN.x, step * FAN.y, index * FAN.z);
    slab.rotation.set(0, FAN.turn, step * FAN.roll);

    /* One body material per clip: the face plane covers the front,
       so emissive on the body shows only along the rounded edges.
       That edge is where the playhead's green lands. */
    const bodyMaterial = new MeshStandardMaterial({
      color: colors.graphite,
      emissive: colors.accent,
      emissiveIntensity: 0,
      roughness: 0.82,
      metalness: 0
    });
    ownedMaterials.push(bodyMaterial);
    const body = new Mesh(slabGeometry, bodyMaterial);
    const face = new Mesh(faceGeometry, plainFaceMaterial);
    face.position.z = SLAB.depth / 2 + 0.002;
    slab.add(body, face);
    deck.add(slab);

    slabs.push({ group: slab, face, body: bodyMaterial, base: slab.position.clone(), lift: 0, glow: 0, seed: index * 1.7 });
  }

  /* Centre the deck on its own depth so the fan rotates about its
     middle, not its front clip. */
  deck.position.set(DECK_OFFSET.x, DECK_OFFSET.y, -((count - 1) * FAN.z) / 2 - 1.4);

  /* ---- Edit frames on chosen faces ----------------------------
     Loaded after the first frame is up; until then those faces are
     plain graphite, which is also a fine end state if they fail. */

  function loadFrames() {
    const loader = new TextureLoader();
    (config.frames || []).forEach((frame) => {
      const target = slabs[frame?.slab];
      if (!target || !frame.src) return;
      loader.load(frame.src, (texture) => {
        texture.colorSpace = SRGBColorSpace;
        ownedTextures.push(texture);
        const material = new MeshStandardMaterial({
          map: texture,
          /* Dimmed so a frame reads as a frame, never as a photo
             competing with the portrait. */
          color: new Color(0.3, 0.3, 0.3),
          roughness: 1,
          metalness: 0
        });
        ownedMaterials.push(material);
        target.face.material = material;
        renderOnce();
      });
    });
  }

  /* ---- Playhead: a hairline plus a soft additive glow --------- */

  const playhead = new Group();
  const lineMaterial = new MeshBasicMaterial({
    color: colors.accent,
    transparent: true,
    opacity: Math.min(1, 0.9 * accentIntensity),
    fog: false,
    depthWrite: false
  });
  const line = new Mesh(new PlaneGeometry(0.014, SLAB.height), lineMaterial);

  const glowTexture = makeGlowTexture();
  ownedTextures.push(glowTexture);
  const glowMaterial = new MeshBasicMaterial({
    color: colors.accent,
    map: glowTexture,
    transparent: true,
    opacity: 0.22 * accentIntensity,
    blending: AdditiveBlending,
    fog: false,
    depthWrite: false
  });
  const glow = new Mesh(new PlaneGeometry(0.3, SLAB.height), glowMaterial);
  playhead.add(glow, line);
  playhead.rotation.y = FAN.turn;
  deck.add(playhead);
  ownedMaterials.push(lineMaterial, glowMaterial);

  /* ---- Contact shadow on an invisible floor -------------------
     A blurred dark ellipse under the deck. On a near-black page it
     reads as weight rather than as a visible shape, which is the
     point: it grounds the fan without adding a floor line. */

  const shadowTexture = makeShadowTexture();
  ownedTextures.push(shadowTexture);
  const shadowMaterial = new MeshBasicMaterial({
    map: shadowTexture,
    color: 0x000000,
    transparent: true,
    opacity: 0.7,
    depthWrite: false
  });
  ownedMaterials.push(shadowMaterial);
  const shadow = new Mesh(new PlaneGeometry(count * FAN.x + 2.6, 3.2), shadowMaterial);
  shadow.rotation.set(-Math.PI / 2, 0, -0.12);
  shadow.position.set(0, -SLAB.height / 2 - middle * FAN.y - 0.32, 0);
  deck.add(shadow);

  /* ---- State --------------------------------------------------- */

  const state = {
    progress: REST_PROGRESS,
    shownProgress: REST_PROGRESS,
    pointer: { x: 0, y: 0 },
    tilt: { x: 0, y: 0 },
    intro: 0,
    startedAt: 0,
    running: false,
    frameId: 0
  };

  /* Playhead position in "slab units": -0.4 sits just in front of
     the first clip, count - 0.6 just behind the last. */
  function playheadAt(progress) {
    return MathUtils.lerp(-0.4, count - 0.6, progress);
  }

  function update(time, { settle = false } = {}) {
    const ease = settle ? 1 : 0.08;

    state.shownProgress += (state.progress - state.shownProgress) * (settle ? 1 : 0.1);
    state.tilt.x += (state.pointer.y * TILT_MAX.x - state.tilt.x) * (settle ? 1 : 0.05);
    state.tilt.y += (state.pointer.x * TILT_MAX.y - state.tilt.y) * (settle ? 1 : 0.05);

    const intro = settle ? 1 : easeOutCubic(state.intro);
    const progress = state.shownProgress;
    const head = playheadAt(progress);

    /* Scroll moves the whole rig a little, so the deck drifts with
       the type as the hero leaves rather than sitting pinned. */
    rig.rotation.set(state.tilt.x, state.tilt.y + progress * 0.22, 0);
    rig.position.y = progress * -0.5 + (settle ? 0 : Math.sin(time * 0.4) * 0.025);

    slabs.forEach((slab, index) => {
      const touch = Math.max(0, 1 - Math.abs(head - index));
      const reach = smoothstep(touch);
      slab.lift += (reach * LIFT - slab.lift) * ease;
      slab.glow += (reach - slab.glow) * ease;
      slab.body.emissiveIntensity = slab.glow * 0.16 * accentIntensity * intro;

      const float = settle ? 0 : Math.sin(time * 0.3 + slab.seed) * 0.012;
      const arrive = (1 - intro) * (0.5 + index * 0.08);
      slab.group.position.set(
        slab.base.x,
        slab.base.y + slab.lift + float - arrive,
        slab.base.z - arrive * 0.6
      );
    });

    /* Interpolate along the fan so the playhead follows the same
       diagonal as the clips, sitting between them in depth. */
    const step = head - middle;
    playhead.position.set(step * FAN.x, step * FAN.y + 0.02, head * FAN.z);

    const fade = intro;
    lineMaterial.opacity = Math.min(1, 0.9 * accentIntensity) * fade;
    glowMaterial.opacity = 0.22 * accentIntensity * fade;
  }

  function render() {
    renderer.render(scene, camera);
  }

  function renderOnce() {
    if (state.running) return;
    update(performance.now() / 1000, { settle: true });
    render();
  }

  function frame(now) {
    if (!state.running) return;
    state.frameId = requestAnimationFrame(frame);

    if (!state.startedAt) state.startedAt = now;
    state.intro = Math.min(1, (now - state.startedAt) / 1000 / INTRO_SECONDS);

    update(now / 1000);
    render();
  }

  function start() {
    if (state.running) return;
    state.running = true;
    state.frameId = requestAnimationFrame(frame);
  }

  function stop() {
    state.running = false;
    cancelAnimationFrame(state.frameId);
  }

  /* ---- Sizing ------------------------------------------------- */

  function resize() {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (!state.running) renderOnce();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();
  loadFrames();

  /* ---- Poster export -------------------------------------------
     Renders the rest state at a fixed size and hands back an image.
     Same camera, same framing as the live canvas: the poster is the
     scene's first frame, not an approximation of it.
  ---------------------------------------------------------------- */

  function exportPoster({ width = 1600, height = 800, type = "image/webp", quality = 0.86 } = {}) {
    const wasRunning = state.running;
    stop();

    const saved = {
      progress: state.progress,
      shownProgress: state.shownProgress,
      pointer: { ...state.pointer },
      tilt: { ...state.tilt },
      lifts: slabs.map((slab) => slab.lift),
      glows: slabs.map((slab) => slab.glow)
    };

    state.progress = REST_PROGRESS;
    state.shownProgress = REST_PROGRESS;
    state.pointer = { x: 0, y: 0 };
    state.tilt = { x: 0, y: 0 };
    const head = playheadAt(REST_PROGRESS);
    slabs.forEach((slab, index) => {
      const reach = smoothstep(Math.max(0, 1 - Math.abs(head - index)));
      slab.lift = reach * LIFT;
      slab.glow = reach;
    });

    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    update(0, { settle: true });
    render();
    const url = canvas.toDataURL(type, quality);

    Object.assign(state, {
      progress: saved.progress,
      shownProgress: saved.shownProgress,
      pointer: saved.pointer,
      tilt: saved.tilt
    });
    slabs.forEach((slab, index) => {
      slab.lift = saved.lifts[index];
      slab.glow = saved.glows[index];
    });
    renderer.setPixelRatio(pixelRatio);
    resize();
    if (wasRunning) start();
    return url;
  }

  /* ---- Teardown ----------------------------------------------- */

  function dispose() {
    stop();
    resizeObserver.disconnect();
    scene.traverse((object) => object.geometry?.dispose());
    ownedMaterials.forEach((material) => material.dispose());
    ownedTextures.forEach((texture) => texture.dispose());
    renderer.dispose();
    canvas.remove();
  }

  return {
    canvas,
    start,
    stop,
    dispose,
    exportPoster,
    setProgress(value) {
      state.progress = MathUtils.clamp(value, 0, 1);
      if (!state.running) renderOnce();
    },
    /* -1..1 across the viewport. */
    setPointer(x, y) {
      state.pointer.x = MathUtils.clamp(x, -1, 1);
      state.pointer.y = MathUtils.clamp(y, -1, 1);
    }
  };
}

/* ---- Helpers ---------------------------------------------------- */

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

/* Horizontal falloff for the playhead glow: bright core, soft edges,
   with the top and bottom faded so the line has no hard ends. */
function makeGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const context = canvas.getContext("2d");

  const across = context.createLinearGradient(0, 0, 64, 0);
  across.addColorStop(0, "rgba(255,255,255,0)");
  across.addColorStop(0.5, "rgba(255,255,255,1)");
  across.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = across;
  context.fillRect(0, 0, 64, 128);

  context.globalCompositeOperation = "destination-in";
  const along = context.createLinearGradient(0, 0, 0, 128);
  along.addColorStop(0, "rgba(0,0,0,0)");
  along.addColorStop(0.2, "rgba(0,0,0,1)");
  along.addColorStop(0.8, "rgba(0,0,0,1)");
  along.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = along;
  context.fillRect(0, 0, 64, 128);

  return new CanvasTexture(canvas);
}

function makeShadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  /* Used as an alpha mask: MeshBasicMaterial multiplies colour by the
     map, and black times anything is black, so alpha does the work. */
  return new CanvasTexture(canvas);
}
