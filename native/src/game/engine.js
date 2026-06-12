// Spin physics, ported 1:1 from the web client's main.js.
//
// Each tap is an impulse that adds angular velocity; friction bleeds it off. A
// point is scored every time a full turn completes, so a fast flurry of taps
// spins longer and scores more. State is a plain mutable object so the render
// loop (useFrame) can mutate it every frame without React re-renders.
export const TWO_PI = Math.PI * 2;
export const SPIN_IMPULSE = 9; // rad/s added per tap (~1.4 turns of starting speed)
export const MAX_VELOCITY = 34; // cap so mashing can't spin infinitely fast
export const FRICTION = 6; // rad/s² deceleration
export const TANTRUM_AFTER_MS = 4500;

export const TANTRUM_LINES = [
  '냐옹… 심심해요 🐾',
  '야옹!! 빨리 돌려줘요 😾',
  '흥! 더 무시하면 할퀼 거예요 🙀',
];

export function createGameState(now) {
  return {
    score: 0,
    angle: 0, // current roll in radians (0 = lying down)
    angularVelocity: 0, // rad/s — momentum from taps, bled off by friction
    awardedTurns: 0, // full rotations already scored
    settling: false, // easing back to a lying pose after coming to rest
    lastInteraction: now,
    submitted: false,
  };
}

// Give the cat a kick of angular velocity (impulse), not a fixed +1.
export function spin(state, now) {
  state.angularVelocity = Math.min(MAX_VELOCITY, state.angularVelocity + SPIN_IMPULSE);
  state.settling = false;
  state.lastInteraction = now;
}

// Advance one frame. Returns the number of *newly* completed turns (>= 0) so the
// caller can add points. Never deducts.
export function step(state, dt) {
  if (state.angularVelocity > 0) {
    state.angle += state.angularVelocity * dt;
    state.angularVelocity = Math.max(0, state.angularVelocity - FRICTION * dt);
    if (state.angularVelocity === 0) state.settling = true; // come to rest lying down
  } else if (state.settling) {
    // gently finish the roll into the nearest lying pose (multiple of 2π)
    const target = Math.round(state.angle / TWO_PI) * TWO_PI;
    state.angle += (target - state.angle) * Math.min(1, dt * 8);
    if (Math.abs(target - state.angle) < 1e-3) {
      state.angle = target;
      state.settling = false;
    }
  }

  const completed = Math.floor(state.angle / TWO_PI + 1e-9);
  let gained = 0;
  if (completed > state.awardedTurns) {
    gained = completed - state.awardedTurns;
    state.awardedTurns = completed;
    state.score += gained;
  }
  return gained;
}

// Idle → tantrum level (0 = calm, 1..3 escalating). Mirrors updateTantrum().
export function tantrumLevel(state, now) {
  const idle = now - state.lastInteraction;
  const spinning = state.angularVelocity > 0 || state.settling;
  if (spinning || idle < TANTRUM_AFTER_MS) return 0;
  return Math.min(3, 1 + Math.floor((idle - TANTRUM_AFTER_MS) / 3500));
}
