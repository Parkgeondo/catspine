'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const {
  createSession,
  verifyToken,
  validateNickname,
  isValidCatId,
  isPlausibleScore,
} = require('./security');
const { RankingStore } = require('./ranking-store');

const PORT = process.env.PORT || 3000;
const CLIENT_DIR = path.join(__dirname, '..', 'client');
const DATA_FILE = path.join(__dirname, '..', 'data', 'leaderboard.json');

const store = new RankingStore(DATA_FILE);
const app = express();

// Behind a reverse proxy (e.g. nginx), trust 1 hop so rate-limit sees real IPs.
if (process.env.TRUST_PROXY) app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// In-memory game sessions: sessionId -> { issuedAt, used }
// Tie each run to a server-issued start time for the anti-cheat time check.
// ---------------------------------------------------------------------------
const sessions = new Map();
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2h
setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, s] of sessions) if (s.issuedAt < cutoff) sessions.delete(id);
}, 10 * 60 * 1000).unref();

// ---------------------------------------------------------------------------
// Security middleware
// ---------------------------------------------------------------------------
// Per-request nonce so the inline <script type="importmap"> can run under a
// strict CSP without 'unsafe-inline'.
app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        // module imports: three.js from unpkg, Firebase SDK from gstatic;
        // the inline importmap is allowed via the per-request nonce
        scriptSrc: [
          "'self'",
          'https://unpkg.com',
          'https://www.gstatic.com',
          (req, res) => `'nonce-${res.locals.nonce}'`,
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        // Firestore is reached directly from the browser (googleapis.com)
        connectSrc: ["'self'", 'https://*.googleapis.com', 'https://firestore.googleapis.com'],
        workerSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(express.json({ limit: '1kb' }));

// Rate limiters
const apiLimiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });
const writeLimiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false });
app.use('/api/', apiLimiter);

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
app.post('/api/session', writeLimiter, (req, res) => {
  const { sessionId, issuedAt, token } = createSession();
  sessions.set(sessionId, { issuedAt, used: false });
  res.json({ sessionId, token });
});

app.post('/api/score', writeLimiter, (req, res) => {
  const body = req.body || {};
  const { sessionId, token, score, nickname, catId } = body;

  if (typeof sessionId !== 'string' || typeof token !== 'string') {
    return res.status(400).json({ error: '잘못된 요청이에요.' });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(400).json({ error: '세션이 만료됐어요. 새로고침 후 다시 시도해 주세요.' });
  }
  if (session.used) {
    return res.status(409).json({ error: '이미 등록된 세션이에요.' });
  }
  if (!verifyToken(sessionId, session.issuedAt, token)) {
    return res.status(403).json({ error: '검증에 실패했어요.' });
  }

  const cleanNick = validateNickname(nickname);
  if (!cleanNick) {
    return res.status(400).json({ error: '닉네임은 2~12자, 한글/영문/숫자만 가능해요.' });
  }
  if (!isValidCatId(catId)) {
    return res.status(400).json({ error: '알 수 없는 고양이예요.' });
  }
  const elapsed = Date.now() - session.issuedAt;
  if (!isPlausibleScore(score, elapsed)) {
    // either out of range, or too high for the time elapsed → likely tampering
    return res.status(422).json({ error: '점수가 올바르지 않아요.' });
  }

  // single-use: consume the session so a score can't be replayed
  session.used = true;

  const { id, rank } = store.add({ nickname: cleanNick, score, catId });
  res.json({ entryId: id, rank });
});

app.get('/api/leaderboard', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  res.json({ entries: store.top(limit) });
});

// ---------------------------------------------------------------------------
// Static client (index.html gets the CSP nonce injected into the importmap)
// ---------------------------------------------------------------------------
const indexHtml = fs.readFileSync(path.join(CLIENT_DIR, 'index.html'), 'utf8');
function sendIndex(req, res) {
  const html = indexHtml.replace(
    '<script type="importmap">',
    `<script type="importmap" nonce="${res.locals.nonce}">`
  );
  res.type('html').send(html);
}
app.get('/', sendIndex);
app.get('/index.html', sendIndex);
app.use(express.static(CLIENT_DIR, { index: false }));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => {
  console.log(`🐱 고양이 돌리기 서버: http://localhost:${PORT}`);
});
