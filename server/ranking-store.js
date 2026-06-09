'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Simple, dependency-free persistent store for the leaderboard.
// Single Node process → synchronous file access is safe and race-free.
// Writes are atomic (write temp + rename) so a crash can't corrupt the file.
class RankingStore {
  constructor(file) {
    this.file = file;
    this.entries = [];
    this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.entries)) this.entries = data.entries;
    } catch (err) {
      if (err.code !== 'ENOENT') console.error('[store] load error:', err.message);
      this.entries = [];
    }
  }

  _save() {
    const dir = path.dirname(this.file);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ entries: this.entries }), 'utf8');
    fs.renameSync(tmp, this.file);
  }

  // Insert a score. Returns { id, rank } (rank is 1-based among all entries).
  add({ nickname, score, catId }) {
    const entry = {
      id: crypto.randomBytes(8).toString('hex'),
      nickname,
      score,
      catId,
      at: Date.now(),
    };
    this.entries.push(entry);
    // keep sorted desc by score, then earliest first
    this.entries.sort((a, b) => b.score - a.score || a.at - b.at);
    // cap stored rows to keep the file bounded
    if (this.entries.length > 1000) this.entries.length = 1000;
    this._save();
    const rank = this.entries.findIndex((e) => e.id === entry.id) + 1;
    return { id: entry.id, rank };
  }

  top(limit) {
    const n = Math.min(Math.max(1, limit | 0), 100);
    return this.entries.slice(0, n).map((e) => ({
      id: e.id,
      nickname: e.nickname,
      score: e.score,
      catId: e.catId,
    }));
  }
}

module.exports = { RankingStore };
