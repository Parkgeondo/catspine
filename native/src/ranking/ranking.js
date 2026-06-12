import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config';

// Ranking client, ported from the web client's ranking.js.
//
// ONLINE mode: talks to the Node backend (session token + score submit).
// LOCAL  mode: per-device board in AsyncStorage. We fall into local mode when
//   API_BASE is unset, or whenever the backend can't be reached.
const LOCAL_KEY = 'catspin.localLeaderboard';

const rk = {
  session: null, // { sessionId, token }
  localMode: !API_BASE, // no backend configured → local from the start
};

export function isLocalMode() {
  return rk.localMode;
}

function enableLocalMode() {
  rk.localMode = true;
  rk.session = null;
}

// ---------------------------------------------------------------------------
// Online (Node backend)
// ---------------------------------------------------------------------------
export async function startSession() {
  if (!API_BASE) {
    enableLocalMode();
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/session`, { method: 'POST' });
    if (!res.ok) throw new Error('session failed');
    const data = await res.json();
    rk.session = { sessionId: data.sessionId, token: data.token };
    rk.localMode = false;
  } catch {
    enableLocalMode(); // no reachable backend → local-only board
  }
}

async function submitOnline({ nickname, score, catId }) {
  const res = await fetch(`${API_BASE}/api/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: rk.session.sessionId,
      token: rk.session.token,
      score,
      nickname,
      catId,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error('submit failed');
    e.userMessage = data.error;
    throw e;
  }
  return { entryId: data.entryId, rank: data.rank, local: false };
}

// ---------------------------------------------------------------------------
// Local (offline / no backend) — per-device records in AsyncStorage
// ---------------------------------------------------------------------------
async function localGet() {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function submitLocal({ nickname, score, catId }) {
  const id = `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  const entry = { id, nickname, score, catId, at: Date.now() };
  const arr = await localGet();
  arr.push(entry);
  arr.sort((a, b) => b.score - a.score || a.at - b.at);
  if (arr.length > 100) arr.length = 100;
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(arr));
  const rank = arr.findIndex((e) => e.id === id) + 1;
  return { entryId: id, rank, local: true };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function submitScore(payload) {
  if (rk.localMode || !rk.session) {
    enableLocalMode();
    return submitLocal(payload);
  }
  try {
    const result = await submitOnline(payload);
    await startSession(); // fresh session for the next run
    return result;
  } catch (err) {
    // A validation error (4xx) carries a userMessage → surface it. A network
    // failure means the backend went away → degrade to local instead.
    if (err.userMessage) throw err;
    enableLocalMode();
    return submitLocal(payload);
  }
}

export async function getLeaderboard(limit = 50) {
  if (rk.localMode) {
    return (await localGet()).slice(0, limit);
  }
  try {
    const res = await fetch(`${API_BASE}/api/leaderboard?limit=${limit}`);
    if (!res.ok) throw new Error('leaderboard failed');
    const data = await res.json();
    return data.entries || [];
  } catch {
    enableLocalMode();
    return (await localGet()).slice(0, limit);
  }
}
