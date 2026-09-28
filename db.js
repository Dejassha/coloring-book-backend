require('dotenv').config();
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || './data/coloring.db';

const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS saved_artwork (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    picture_id TEXT NOT NULL,
    title TEXT,
    svg_markup TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

module.exports = db;
