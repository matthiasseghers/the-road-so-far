import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Creates a fresh in-memory SQLite database and runs all migrations on it.
 * Use this in integration tests to avoid touching the real .db file.
 */
export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  // Reason: apply structural migrations only — skip seed data (INSERT OR IGNORE
  // blocks) so tests start clean and manage their own fixtures. The seed section
  // in 001_initial.sql is delimited by a "─── SEED DATA" comment; everything
  // before that marker is pure DDL and safe to run unconditionally.
  const migrationsDir = join(__dirname, '../../../src/db/migrations');
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    let sql = readFileSync(join(migrationsDir, file), 'utf-8');
    // Strip everything from the seed-data section onwards so tests start empty.
    const seedMarker = sql.indexOf('-- ─── SEED DATA');
    if (seedMarker !== -1) sql = sql.slice(0, seedMarker);
    db.exec(sql);
  }

  return db;
}
