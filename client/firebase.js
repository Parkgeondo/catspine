// Firestore-backed leaderboard — the client talks to Firestore directly, so no
// server is needed (works on static hosts like GitHub Pages).
//
// Security note: without a server we can't run the time-based anti-cheat. We
// rely on Firestore Security Rules (see firestore.rules) to validate the shape
// and range of every write, and App Check (optional, recommended) to block
// requests that don't come from this app. This is "casual game" grade security.
import {
  initializeApp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit as qlimit,
  where,
  getCountFromServer,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { firebaseConfig } from './firebase-config.js';

const COLLECTION = 'scores';

export function isConfigured() {
  return Boolean(
    firebaseConfig &&
      firebaseConfig.projectId &&
      firebaseConfig.apiKey &&
      !firebaseConfig.apiKey.startsWith('YOUR_')
  );
}

// Reject if `promise` doesn't settle within `ms` — Firestore's transport can
// hang silently when the database isn't provisioned, so we never await forever.
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Lightweight, unauthenticated REST check: is the database created AND do the
// rules allow public reads? Only a 200 means "fully ready" — a missing database
// returns 404 and locked (unpublished) rules return 403, in which case we let
// the caller fall back to the local leaderboard until setup is finished.
async function isFirestoreReady(projectId) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId}` +
    '/databases/(default)/documents/scores?pageSize=1';
  try {
    const res = await withTimeout(fetch(url), 6000, 'firestore probe');
    return res.ok;
  } catch {
    return false;
  }
}

// Returns a backend object { submit, leaderboard } or null if Firestore isn't
// reachable/ready yet (caller then uses the Node server or local fallback).
export async function initFirebase() {
  if (!isConfigured()) return null;
  if (!(await isFirestoreReady(firebaseConfig.projectId))) return null;

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  return {
    async submit(nickname, score, catId) {
      const ref = await withTimeout(
        addDoc(collection(db, COLLECTION), {
          nickname,
          score,
          catId,
          createdAt: serverTimestamp(),
        }),
        10000,
        'score submit'
      );
      // rank = (number of strictly-higher scores) + 1, via a server-side count
      let rank = 1;
      try {
        const snap = await withTimeout(
          getCountFromServer(
            query(collection(db, COLLECTION), where('score', '>', score))
          ),
          8000,
          'rank count'
        );
        rank = snap.data().count + 1;
      } catch (e) {
        console.warn('rank count failed, falling back', e);
      }
      return { entryId: ref.id, rank };
    },

    async leaderboard(n) {
      const snap = await withTimeout(
        getDocs(query(collection(db, COLLECTION), orderBy('score', 'desc'), qlimit(n))),
        8000,
        'leaderboard'
      );
      return snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, nickname: data.nickname, score: data.score, catId: data.catId };
      });
    },
  };
}
