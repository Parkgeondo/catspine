// Toss(앱인토스) 사용자 식별.
//
// 게임 카테고리 미니앱은 getUserKeyForGame()으로 토스 계정별 고유 해시를 받을 수
// 있어요 (로그인·사업자 불필요, 토스앱 v5.232.0+). 이 해시를 Firestore 문서 ID로
// 써서 "계정당 1개 기록"을 만든다. 토스 밖(브라우저 개발 등)에서는 null을 반환해
// 기존 익명 등록 흐름으로 폴백.
//
// 개발용: localStorage.tossHashOverride 를 설정하면 그 값을 해시로 사용.
export async function getTossUserHash() {
  try {
    const override = localStorage.getItem('tossHashOverride');
    if (override) return override;
  } catch {}

  try {
    const { getUserKeyForGame } = await import('@apps-in-toss/web-framework');
    const result = await getUserKeyForGame();
    if (result && result.type === 'HASH' && result.hash) return result.hash;
    // 'INVALID_CATEGORY'(게임 카테고리 아님) | 'ERROR' | undefined(구버전 토스앱)
    if (result === 'INVALID_CATEGORY') {
      console.warn('[toss] 미니앱이 게임 카테고리가 아니라 계정 랭킹을 쓸 수 없어요.');
    }
  } catch (err) {
    // SDK 없음(일반 브라우저) 등 — 조용히 폴백
  }
  return null;
}

// Firestore 문서 ID로 안전한 형태로 (슬래시 등 제거) + 접두사.
export function tossDocId(hash) {
  return 'toss_' + String(hash).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120);
}

// 자동 닉네임: 입력 없이도 랭킹에 바로 올라가도록 기본값을 만들어 준다.
export function defaultNickname(hash) {
  const tail = String(hash).replace(/[^A-Za-z0-9]/g, '').slice(-4) || '0000';
  return `냥집사${tail}`;
}
