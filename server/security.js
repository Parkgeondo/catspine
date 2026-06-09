'use strict';
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Secret: MUST come from the environment in production. We fail loudly rather
// than silently shipping a known/default key.
// ---------------------------------------------------------------------------
function loadSecret() {
  const fromEnv = process.env.SCORE_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SCORE_SECRET is required in production (set a long random value in the environment).'
    );
  }
  // Dev only: ephemeral random secret. Tokens become invalid on restart — fine
  // for local development, and never reuses a hard-coded key.
  console.warn('[security] SCORE_SECRET not set — using an ephemeral dev secret.');
  return crypto.randomBytes(32).toString('hex');
}

const SECRET = loadSecret();
const VALID_CAT_IDS = new Set(['cheese', 'tuxedo', 'gray', 'calico']);

// ---------------------------------------------------------------------------
// Game-session tokens
// A session ties a run to a server-issued start time so we can sanity-check the
// reported score against elapsed wall-clock time. The token is an HMAC over the
// session id + issue time, so the client cannot forge or mutate it.
// ---------------------------------------------------------------------------
function sign(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

function createSession() {
  const sessionId = crypto.randomBytes(16).toString('hex');
  const issuedAt = Date.now();
  const token = sign(`${sessionId}.${issuedAt}`);
  return { sessionId, issuedAt, token };
}

// Constant-time token comparison
function verifyToken(sessionId, issuedAt, token) {
  const expected = sign(`${sessionId}.${issuedAt}`);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(token), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
// Allow letters (any language → Korean ok), numbers, space and a few marks.
const NICK_RE = /^[\p{L}\p{N}_\-. ]{2,12}$/u;

function validateNickname(raw) {
  if (typeof raw !== 'string') return null;
  const nickname = raw.normalize('NFC').trim();
  if (!NICK_RE.test(nickname)) return null;
  // collapse runs of whitespace; reject control chars (already excluded by regex)
  return nickname.replace(/\s+/g, ' ');
}

function isValidCatId(id) {
  return VALID_CAT_IDS.has(id);
}

// Plausibility: each full roll takes a minimum amount of time on the client.
// We allow a generous margin for fast tappers + animation queueing, but reject
// scores that are physically impossible for the elapsed session time.
const MIN_MS_PER_POINT = 350; // client spin is ~620ms; 350ms leaves slack
const SETUP_GRACE_MS = 1500;

function isPlausibleScore(score, elapsedMs) {
  if (!Number.isInteger(score) || score <= 0 || score > 100000) return false;
  const maxByTime = Math.floor((elapsedMs + SETUP_GRACE_MS) / MIN_MS_PER_POINT);
  return score <= maxByTime;
}

module.exports = {
  createSession,
  verifyToken,
  validateNickname,
  isValidCatId,
  isPlausibleScore,
};
