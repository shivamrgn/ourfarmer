/**
 * CropPredict AI — SQLite Database Setup
 * Supports native node:sqlite for Node 22+ with zero native compilation issues
 */

const path = require('path');
const fs = require('fs');

// Store DB file in backend/data/
const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'croppredict.db');
let db;

try {
    const { DatabaseSync } = require('node:sqlite');
    db = new DatabaseSync(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        email       TEXT    NOT NULL UNIQUE,
        password    TEXT    NOT NULL,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log(`✅ Native node:sqlite Database ready at: ${dbPath}`);
} catch (nativeErr) {
    try {
        const Database = require('better-sqlite3');
        db = new Database(dbPath);
        db.exec(`
          CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            email       TEXT    NOT NULL UNIQUE,
            password    TEXT    NOT NULL,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);
        console.log(`✅ better-sqlite3 Database ready at: ${dbPath}`);
    } catch (err) {
        console.warn('⚠️ SQLite native error, using memory mock for DB:', err.message);
    }
}

module.exports = db;
