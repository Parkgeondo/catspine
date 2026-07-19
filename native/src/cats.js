// Shared cat catalog (ported from the web client). `id` must match a bundled
// model file: assets/cats/<id>.glb — see ./game/loadCat.js for the require map.
export const CATS = [
  { id: 'cheese', name: '치즈', emoji: '🧀', accent: '#f0992f', desc: '느긋한 치즈냥' },
  { id: 'tuxedo', name: '턱시도', emoji: '🐱', accent: '#2a2a30', desc: '말쑥한 턱시도냥' },
  { id: 'gray', name: '회색', emoji: '🩶', accent: '#8b9099', desc: '시크한 회색냥' },
  { id: 'calico', name: '삼색', emoji: '🐾', accent: '#d98a55', desc: '복덩이 삼색냥' },
];

export const CAT_BY_ID = Object.fromEntries(CATS.map((c) => [c.id, c]));

// Nickname rule mirrored on the server (validateNickname): letters (any
// language → Korean ok), numbers, space and a few marks, 2–12 chars.
export const NICK_RE = /^[\p{L}\p{N}_\-. ]{2,12}$/u;
