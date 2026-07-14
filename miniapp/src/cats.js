// Shared cat catalog. `id` must match a generated file: assets/cats/<id>.glb
export const CATS = [
  { id: 'cheese', name: '치즈', emoji: '🧀', accent: '#f0992f', desc: '느긋한 치즈냥' },
  { id: 'tuxedo', name: '턱시도', emoji: '🐱', accent: '#2a2a30', desc: '말쑥한 턱시도냥' },
  { id: 'gray', name: '회색', emoji: '🩶', accent: '#8b9099', desc: '시크한 회색냥' },
  { id: 'calico', name: '삼색', emoji: '🐾', accent: '#d98a55', desc: '복덩이 삼색냥' },
];

export const CAT_BY_ID = Object.fromEntries(CATS.map((c) => [c.id, c]));
