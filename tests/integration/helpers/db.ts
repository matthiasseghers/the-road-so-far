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

  // Reason: apply structural migrations only — skip seed files that pre-populate
  // lookup tables, so tests start clean and manage their own fixtures.
  // Seed files are explicitly listed; all other .sql files are applied in order.
  const SEED_FILES = new Set(['002_seed_templates.sql']);
  const migrationsDir = join(__dirname, '../../../src/db/migrations');
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !SEED_FILES.has(f))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    db.exec(sql);
  }

  return db;
}
