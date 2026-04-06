import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
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

  const migrationsDir = join(__dirname, '../../../src/db/migrations');
  const files = ['001_initial.sql']; // Only initial schema — no seed data in tests

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    db.exec(sql);
  }

  return db;
}
