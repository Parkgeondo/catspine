import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CATS, CAT_BY_ID } from './cats.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  score: 0,
  angle: 0, // current roll in radians (0 = lying down)
  angularVelocity: 0, // rad/s — momentum from taps, bled off by friction
  awardedTurns: 0, // full rotations already scored
  settling: false, // easing back to a lying pose after coming to rest
  lastInteraction: performance.now(),
  catId: localStorage.getItem('catId') || CATS[0].id,
  session: null, // { sessionId, token } from server
  submitted: false,
};

const TWO_PI = Math.PI * 2;
// Spin physics: each tap is an impulse that adds angular velocity; friction
// slowly bleeds it off. A point is scored every time a full turn completes,
// so a fast flurry of taps spins longer and scores more.
const SPIN_IMPULSE = 9; // rad/s added per tap (~1.4 turns of starting speed)
const MAX_VELOCITY = 34; // cap so mashing can't spin infinitely fast
const FRICTION = 6; // rad/s² deceleration
const TANTRUM_AFTER_MS = 4500;

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const stage = $('#stage');
const scoreEl = $('#score');
const moodEl = $('#mood');
const spinBtn = $('#spin');
const loadingEl = $('#loading');
const srLive = $('#sr-live');
const catListEl = $('#cat-list');

function announce(msg) {
  srLive.textContent = msg;
}

// ---------------------------------------------------------------------------
// Three.js scene
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 2.2, 5.4);
camera.lookAt(0, 0.6, 0);

// lights
scene.add(new THREE.HemisphereLight(0xfff1d6, 0x3a2f5a, 0.9));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
keyLight.position.set(3, 6, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 20;
scene.add(keyLight);

// soft ground (a cushion for the lying cat)
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(3.2, 48),
  new THREE.MeshStandardMaterial({ color: 0x3a2f63, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.02;
ground.receiveShadow = true;
scene.add(ground);

// pivot holds the cat; we roll the pivot so the cat spins around its body axis
const pivot = new THREE.Group();
scene.add(pivot);

const loader = new GLTFLoader();
let catModel = null;
let loadToken = 0; // guards against out-of-order async loads

function loadCat(catId) {
  const myToken = ++loadToken;
  loadingEl.style.display = '';
  loader.load(
    `assets/cats/${catId}.glb`,
    (gltf) => {
      if (myToken !== loadToken) return; // a newer load superseded this one
      if (catModel) {
        pivot.remove(catModel);
        disposeObject(catModel);
      }
      catModel = gltf.scene;
      catModel.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      // center on the spin (Y) axis and rest the cat on the cushion
      const box = new THREE.Box3().setFromObject(catModel);
      const center = box.getCenter(new THREE.Vector3());
      catModel.position.x -= center.x;
      catModel.position.z -= center.z;
      catModel.position.y -= box.min.y; // bottom sits on y = 0
      pivot.add(catModel);
      loadingEl.style.display = 'none';
    },
    undefined,
    (err) => {
      console.error('GLB load failed:', err);
      loadingEl.textContent = '고양이를 불러오지 못했어요 😿';
    }
  );
}

function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.geometry?.dispose();
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material?.dispose();
    }
  });
}

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------
function resize() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  if (w === 0 || h === 0) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------------------
// Spin mechanic
// ---------------------------------------------------------------------------
function spin() {
  // give the cat a kick of angular velocity (impulse), not a fixed +1
  state.angularVelocity = Math.min(MAX_VELOCITY, state.angularVelocity + SPIN_IMPULSE);
  state.settling = false;
  state.lastInteraction = performance.now();
  clearTantrum();
}

// Award a point for each newly completed full turn (never deducts).
function scoreCompletedTurns() {
  const completed = Math.floor(state.angle / TWO_PI + 1e-9);
  if (completed > state.awardedTurns) {
    const gained = completed - state.awardedTurns;
    state.awardedTurns = completed;
    setScore(state.score + gained);
    state.submitted = false;
    announce(`${state.score}점`);
  }
}

function setScore(n) {
  state.score = n;
  scoreEl.textContent = String(n);
  if (!reduceMotion) {
    scoreEl.classList.remove('bump');
    // reflow to restart animation
    void scoreEl.offsetWidth;
    scoreEl.classList.add('bump');
  }
}

// ---------------------------------------------------------------------------
// Tantrum (떼쓰기) when the cat is ignored
// ---------------------------------------------------------------------------
const TANTRUM_LINES = [
  '냐옹… 심심해요 🐾',
  '야옹!! 빨리 돌려줘요 😾',
  '흥! 더 무시하면 할퀼 거예요 🙀',
];
let tantrumLevel = 0;

function clearTantrum() {
  if (tantrumLevel !== 0) {
    tantrumLevel = 0;
    moodEl.classList.remove('angry');
    moodEl.textContent = '좋아요! 한 번 더? 🌀';
  }
}

function updateTantrum(now, dt) {
  const idle = now - state.lastInteraction;
  const spinning = state.angularVelocity > 0 || state.settling;
  if (spinning || idle < TANTRUM_AFTER_MS) {
    if (tantrumLevel === 0) {
      // gentle idle wobble back to rest
      pivot.position.x *= 0.85;
      pivot.position.y *= 0.85;
      pivot.rotation.z *= 0.85;
    }
    return;
  }
  const level = Math.min(3, 1 + Math.floor((idle - TANTRUM_AFTER_MS) / 3500));
  if (level !== tantrumLevel) {
    tantrumLevel = level;
    moodEl.textContent = TANTRUM_LINES[level - 1];
    moodEl.classList.add('angry');
    announce(TANTRUM_LINES[level - 1]);
  }
  if (!reduceMotion) {
    const t = now / 1000;
    const intensity = 0.04 * level;
    pivot.position.x = Math.sin(t * 22) * intensity;
    pivot.position.y = Math.abs(Math.sin(t * 9)) * 0.05 * level; // little hops
    pivot.rotation.z = Math.sin(t * 26) * intensity * 1.5;
  }
}

// ---------------------------------------------------------------------------
// Animation loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();

  // physics-driven roll about the cat's long axis
  if (state.angularVelocity > 0) {
    state.angle += state.angularVelocity * dt;
    state.angularVelocity = Math.max(0, state.angularVelocity - FRICTION * dt);
    pivot.rotation.y = state.angle;
    scoreCompletedTurns();
    if (state.angularVelocity === 0) state.settling = true; // come to rest lying down
  } else if (state.settling) {
    // gently finish the roll into the nearest lying pose (multiple of 2π)
    const target = Math.round(state.angle / TWO_PI) * TWO_PI;
    state.angle += (target - state.angle) * Math.min(1, dt * 8);
    if (Math.abs(target - state.angle) < 1e-3) {
      state.angle = target;
      state.settling = false;
    }
    pivot.rotation.y = state.angle;
    scoreCompletedTurns(); // settling forward may complete one last turn
  }

  updateTantrum(now, dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// ---------------------------------------------------------------------------
// Cat picker UI
// ---------------------------------------------------------------------------
function buildCatPicker() {
  catListEl.innerHTML = '';
  for (const cat of CATS) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cat-chip';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(cat.id === state.catId));
    btn.setAttribute('aria-label', `${cat.name} 고양이`);
    btn.dataset.catId = cat.id;
    btn.innerHTML = `<span class="chip-emoji" aria-hidden="true">${cat.emoji}</span>
      <span class="chip-name">${cat.name}</span>`;
    btn.addEventListener('click', () => selectCat(cat.id));
    li.appendChild(btn);
    catListEl.appendChild(li);
  }
}

function selectCat(catId) {
  if (!CAT_BY_ID[catId]) return;
  state.catId = catId;
  localStorage.setItem('catId', catId);
  for (const btn of catListEl.querySelectorAll('.cat-chip')) {
    btn.setAttribute('aria-checked', String(btn.dataset.catId === catId));
  }
  state.lastInteraction = performance.now();
  clearTantrum();
  announce(`${CAT_BY_ID[catId].name} 고양이를 선택했어요`);
  loadCat(catId);
}

// ---------------------------------------------------------------------------
// Input wiring (tap / click / keyboard) — keep the spin target large & accessible
// ---------------------------------------------------------------------------
spinBtn.addEventListener('click', spin);
renderer.domElement.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  spin();
});
// global keyboard: Space / Enter spins, unless focus is in an input/dialog field
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (document.querySelector('#rank-dialog')?.open) return;
  // Let native activation handle focused interactive controls (buttons, links,
  // inputs) — only treat Space/Enter as "spin" when focus isn't on one of them.
  const tag = (e.target.tagName || '').toLowerCase();
  if (['input', 'textarea', 'button', 'a', 'select'].includes(tag)) return;
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    spin();
  }
});

// ---------------------------------------------------------------------------
// Ranking + server integration (see ranking.js)
// ---------------------------------------------------------------------------
import { initRanking } from './ranking.js';
initRanking(state);

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
buildCatPicker();
loadCat(state.catId);
resize();
// a second resize after layout settles (mobile address bars, fonts)
requestAnimationFrame(resize);
tick();
