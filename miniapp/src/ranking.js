import { CAT_BY_ID } from './cats.js';

// Nickname rule mirrored on the server. Letters/numbers/Korean + a few marks.
const NICK_RE = /^[\p{L}\p{N}_\-. ]{2,12}$/u;

// Where the ranking backend lives. Same-origin by default (works with
// `npm start`). On a static host (e.g. GitHub Pages) there is no backend, so
// requests fail and we transparently fall back to a per-device local board.
// To use a hosted backend from a static page, set `window.CAT_API_BASE` before
// this module loads (e.g. in index.html).
const API_BASE = (typeof window !== 'undefined' && window.CAT_API_BASE) || '';
const LOCAL_KEY = 'catspin.localLeaderboard';

let st = null;
let localMode = false; // true once we detect there's no reachable backend

const $ = (s) => document.querySelector(s);

export function initRanking(state) {
  st = state;

  const dialog = $('#rank-dialog');
  const openBtn = $('#rank-open');
  const form = $('#submit-form');
  const nickInput = $('#nickname');
  const submitBtn = $('#submit-score');
  const errEl = $('#submit-error');

  openBtn.addEventListener('click', async () => {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    await refreshLeaderboard();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.textContent = '';
    errEl.classList.remove('ok');

    const nickname = nickInput.value.trim();
    if (!NICK_RE.test(nickname)) {
      errEl.textContent = '닉네임은 2~12자, 한글/영문/숫자만 사용할 수 있어요.';
      nickInput.focus();
      return;
    }
    if (st.score <= 0) {
      errEl.textContent = '먼저 고양이를 한 번이라도 돌려주세요! 🐱';
      return;
    }

    submitBtn.disabled = true;
    try {
      const result = localMode ? submitLocal(nickname) : await submitOnline(nickname);
      st.submitted = true;
      st.myEntryId = result.entryId;
      errEl.textContent = result.local
        ? `등록 완료! 현재 ${result.rank}위 🎉 (이 기기 기록)`
        : `등록 완료! 현재 ${result.rank}위 🎉`;
      errEl.classList.add('ok');
      if (!localMode) await startSession(); // fresh session for the next run
      await refreshLeaderboard();
    } catch (err) {
      console.error(err);
      errEl.textContent = err.userMessage || '등록에 실패했어요. 다시 시도해 주세요.';
    } finally {
      submitBtn.disabled = false;
    }
  });

  startSession();
}

// ---------------------------------------------------------------------------
// Online (Node backend) mode
// ---------------------------------------------------------------------------
async function startSession() {
  try {
    const res = await fetch(`${API_BASE}/api/session`, { method: 'POST' });
    if (!res.ok) throw new Error('session failed');
    const data = await res.json();
    st.session = { sessionId: data.sessionId, token: data.token };
    localMode = false;
  } catch (err) {
    // no reachable backend → switch to local-only leaderboard
    st.session = null;
    enableLocalMode();
  }
}

async function submitOnline(nickname) {
  if (!st.session) {
    // backend went away mid-session → degrade to local
    enableLocalMode();
    return submitLocal(nickname);
  }
  const res = await fetch(`${API_BASE}/api/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: st.session.sessionId,
      token: st.session.token,
      score: st.score,
      nickname,
      catId: st.catId,
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
// Local (static host / offline) mode — per-device records in localStorage
// ---------------------------------------------------------------------------
function enableLocalMode() {
  if (localMode) return;
  localMode = true;
  const hint = $('.submit-hint');
  if (hint) {
    hint.innerHTML =
      '온라인 서버에 연결할 수 없어, 랭킹은 <strong>이 기기에만</strong> 저장돼요. ' +
      '닉네임은 등록 시에만 사용됩니다.';
  }
}

function localGet() {
  try {
    const arr = JSON.parse(localStorage.getItem(LOCAL_KEY));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function submitLocal(nickname) {
  const id =
    (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random();
  const entry = { id, nickname, score: st.score, catId: st.catId, at: Date.now() };
  const arr = localGet();
  arr.push(entry);
  arr.sort((a, b) => b.score - a.score || a.at - b.at);
  if (arr.length > 100) arr.length = 100;
  localStorage.setItem(LOCAL_KEY, JSON.stringify(arr));
  const rank = arr.findIndex((e) => e.id === id) + 1;
  return { entryId: id, rank, local: true };
}

// ---------------------------------------------------------------------------
// Leaderboard rendering (shared)
// ---------------------------------------------------------------------------
async function refreshLeaderboard() {
  const listEl = $('#rank-list');
  listEl.innerHTML = '<li class="rank-empty">불러오는 중…</li>';
  try {
    if (localMode) {
      renderLeaderboard(localGet().slice(0, 50));
      return;
    }
    const res = await fetch(`${API_BASE}/api/leaderboard?limit=50`);
    if (!res.ok) throw new Error('leaderboard failed');
    const data = await res.json();
    renderLeaderboard(data.entries || []);
  } catch (err) {
    // backend unreachable → show local board instead
    enableLocalMode();
    renderLeaderboard(localGet().slice(0, 50));
  }
}

function renderLeaderboard(entries) {
  const listEl = $('#rank-list');
  listEl.innerHTML = '';
  if (entries.length === 0) {
    listEl.innerHTML = '<li class="rank-empty">아직 랭킹이 없어요. 1등에 도전해 보세요! 🏆</li>';
    return;
  }
  entries.forEach((entry, i) => {
    const li = document.createElement('li');
    li.className = 'rank-row';
    if (st.myEntryId && entry.id === st.myEntryId) li.classList.add('me');

    const pos = document.createElement('span');
    pos.className = 'rank-pos';
    const medals = ['🥇', '🥈', '🥉'];
    pos.textContent = medals[i] || String(i + 1);

    const name = document.createElement('span');
    name.className = 'rank-name';
    // textContent → user nicknames are never interpreted as HTML (XSS-safe)
    const cat = CAT_BY_ID[entry.catId];
    name.textContent = (cat ? cat.emoji + ' ' : '') + entry.nickname;

    const score = document.createElement('span');
    score.className = 'rank-score';
    score.textContent = String(entry.score);

    li.append(pos, name, score);
    listEl.appendChild(li);
  });
}
