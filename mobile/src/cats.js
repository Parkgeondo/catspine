// 고양이 카탈로그. Metro는 정적 require만 번들하므로 에셋을 명시적으로 매핑한다.
export const CAT_ASSETS = {
  cheese: require('../assets/cats/cheese.glb'),
  tuxedo: require('../assets/cats/tuxedo.glb'),
  gray: require('../assets/cats/gray.glb'),
  calico: require('../assets/cats/calico.glb'),
};

export const CATS = [
  { id: 'cheese', name: '치즈', emoji: '🧀', accent: '#f0992f' },
  { id: 'tuxedo', name: '턱시도', emoji: '🐱', accent: '#2a2a30' },
  { id: 'gray', name: '회색', emoji: '🩶', accent: '#8b9099' },
  { id: 'calico', name: '삼색', emoji: '🐾', accent: '#d98a55' },
];

export const CAT_BY_ID = Object.fromEntries(CATS.map((c) => [c.id, c]));
