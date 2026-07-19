// Firestore 랭킹 (React Native). 웹 버전과 동일한 컬렉션/규칙을 사용한다.
// RN 환경에서는 long-polling을 강제해야 Firestore 연결이 안정적이다.
import { initializeApp, getApps } from 'firebase/app';
import {
  initializeFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit as qlimit,
  where,
  getCountFromServer,
  serverTimestamp,
} from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';

const COLLECTION = 'scores';

let db = null;

function getDb() {
  if (db) return db;
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  // RN에서는 WebChannel 대신 long-polling 사용 (gRPC/WebSocket 이슈 회피)
  db = initializeFirestore(app, { experimentalForceLongPolling: true });
  return db;
}

// 점수 등록 → { entryId, rank } 반환
export async function submitScore(nickname, score, catId) {
  const ref = await addDoc(collection(getDb(), COLLECTION), {
    nickname,
    score,
    catId,
    createdAt: serverTimestamp(),
  });
  let rank = 1;
  try {
    const snap = await getCountFromServer(
      query(collection(getDb(), COLLECTION), where('score', '>', score))
    );
    rank = snap.data().count + 1;
  } catch (e) {
    // 순위 카운트 실패해도 등록 자체는 성공으로 처리
  }
  return { entryId: ref.id, rank };
}

// 상위 n명 랭킹
export async function fetchLeaderboard(n = 50) {
  const snap = await getDocs(
    query(collection(getDb(), COLLECTION), orderBy('score', 'desc'), qlimit(n))
  );
  return snap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, nickname: data.nickname, score: data.score, catId: data.catId };
  });
}
