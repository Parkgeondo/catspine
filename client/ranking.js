import { CAT_BY_ID } from './cats.js';

// Nickname rule mirrored on the server. Letters/numbers/Korean + a few marks.
const NICK_RE = /^[\p{L}\p{N}_\-. ]{2,12}$/u;

let st = null;

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
    if (!st.session) {
      errEl.textContent = '서버 연결을 확인할 수 없어요. 잠시 후 다시 시도해 주세요.';
      return;
    }

    submitBtn.disabled = true;
    try {
      const res = await fetch('/api/score', {
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
        errEl.textContent = data.error || '등록에 실패했어요. 다시 시도해 주세요.';
        submitBtn.disabled = false;
        return;
      }
      st.submitted = true;
      st.myEntryId = data.entryId;
      errEl.textContent = `등록 완료! 현재 ${data.rank}위 🎉`;
      errEl.classList.add('ok');
      // a fresh session so a new run can be submitted independently
      await startSession();
      await refreshLeaderboard();
    } catch (err) {
      console.error(err);
      errEl.textContent = '네트워크 오류가 발생했어요.';
    } finally {
      submitBtn.disabled = false;
    }
  });

  startSession();
}

async function startSession() {
  try {
    const res = await fetch('/api/session', { method: 'POST' });
    if (!res.ok) throw new Error('session failed');
    const data = await res.json();
    st.session = { sessionId: data.sessionId, token: data.token };
  } catch (err) {
    console.error('session error', err);
    st.session = null;
  }
}

async function refreshLeaderboard() {
  const listEl = $('#rank-list');
  listEl.innerHTML = '<li class="rank-empty">불러오는 중…</li>';
  try {
    const res = await fetch('/api/leaderboard?limit=50');
    const data = await res.json();
    renderLeaderboard(data.entries || []);
  } catch (err) {
    console.error(err);
    listEl.innerHTML = '<li class="rank-empty">랭킹을 불러오지 못했어요 😿</li>';
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
