/**
 * 数据库模块 —— 使用 Node.js 22.5+ 内置 node:sqlite 替代 Cloudflare D1
 * 无需任何原生编译，开箱即用
 *
 * 表结构与 Cloudflare 版本完全一致：
 *   - playback_store  (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)
 *   - favorites_store (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)
 */

'use strict';

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH  = path.join(DATA_DIR, 'solara.db');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

// 启用 WAL 模式提升写入性能
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA synchronous = NORMAL");

// 与 Cloudflare 版本一致的收藏键名集合
const FAVORITE_KEYS = new Set([
  'favoriteSongs',
  'currentFavoriteIndex',
  'favoritePlayMode',
  'favoritePlaybackTime',
]);

function getTableForKey(key) {
  return FAVORITE_KEYS.has(key) ? 'favorites_store' : 'playback_store';
}

// 初始化表（等同于 ensureTables）
db.exec(`
  CREATE TABLE IF NOT EXISTS playback_store (
    key        TEXT PRIMARY KEY,
    value      TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS favorites_store (
    key        TEXT PRIMARY KEY,
    value      TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

console.log(`[DB] SQLite initialized at ${DB_PATH}`);

// ─── 预编译语句 ────────────────────────────────────────────────────────────────

const _upsert = {
  playback_store: db.prepare(
    `INSERT INTO playback_store (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ),
  favorites_store: db.prepare(
    `INSERT INTO favorites_store (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ),
};

const _delete = {
  playback_store:  db.prepare('DELETE FROM playback_store  WHERE key = ?'),
  favorites_store: db.prepare('DELETE FROM favorites_store WHERE key = ?'),
};

// ─── 对外 API ─────────────────────────────────────────────────────────────────

/**
 * 按键名批量读取
 * @param {string[]} keys
 * @returns {Record<string, string|null>}
 */
function getMany(keys) {
  const data = {};
  keys.forEach(k => (data[k] = null));

  const grouped = { playback_store: [], favorites_store: [] };
  keys.forEach(key => grouped[getTableForKey(key)].push(key));

  for (const [table, tableKeys] of Object.entries(grouped)) {
    if (tableKeys.length === 0) continue;
    const placeholders = tableKeys.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT key, value FROM ${table} WHERE key IN (${placeholders})`
    ).all(...tableKeys);
    rows.forEach(row => (data[row.key] = row.value));
  }

  return data;
}

/**
 * 读取全部数据
 * @returns {Record<string, string|null>}
 */
function getAll() {
  const data = {};
  const rows = [
    ...db.prepare('SELECT key, value FROM playback_store').all(),
    ...db.prepare('SELECT key, value FROM favorites_store').all(),
  ];
  rows.forEach(row => (data[row.key] = row.value));
  return data;
}

/**
 * 批量写入
 * @param {Array<[string, unknown]>} entries
 * @returns {number}
 */
function setMany(entries) {
  const grouped = { playback_store: [], favorites_store: [] };
  entries.forEach(([key, value]) => {
    grouped[getTableForKey(key)].push([key, value == null ? '' : String(value)]);
  });

  db.exec('BEGIN');
  try {
    for (const [table, pairs] of Object.entries(grouped)) {
      pairs.forEach(([key, value]) => _upsert[table].run(key, value));
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return entries.length;
}

/**
 * 批量删除
 * @param {string[]} keys
 * @returns {number}
 */
function deleteMany(keys) {
  const grouped = { playback_store: [], favorites_store: [] };
  keys.forEach(key => grouped[getTableForKey(key)].push(key));

  db.exec('BEGIN');
  try {
    for (const [table, tableKeys] of Object.entries(grouped)) {
      tableKeys.forEach(key => _delete[table].run(key));
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return keys.length;
}

module.exports = { getMany, getAll, setMany, deleteMany };
