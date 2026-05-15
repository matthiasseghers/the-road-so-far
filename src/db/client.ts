import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Reason: better-sqlite3 is a Node.js native module — synchronous by design.
// This file is only ever imported by the Express server, never by the React app.

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const dbPath = process.env['DB_PATH'] ?? join(process.cwd(), 'road-so-far.db');
    _db = new Database(dbPath);
    _db.pragma('journal_mode = WAL');
    _db.pragma('synchronous = NORMAL');
    _db.pragma('foreign_keys = ON');
    runMigrations(_db);
  }
  return _db;
}

function runMigrations(db: Database.Database): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, run_at TEXT NOT NULL)`,
  );

  const ran = new Set(
    db.prepare('SELECT name FROM _migrations').pluck().all() as string[],
  );

  const migrationsDir = join(__dirname, 'migrations');
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (!ran.has(file)) {
      const sql = readFileSync(join(migrationsDir, file), 'utf-8');
      db.transaction(() => {
        db.exec(sql);
        db.prepare("INSERT INTO _migrations (name, run_at) VALUES (?, datetime('now'))")
          .run(file);
      })();
    }
  }
}
