import { getDb } from '../client.js';
import type { SettingRow } from '@/types/db';
import type {
  AppSettings,
  Theme,
  DateFormat,
  TimeAreaConfig,
} from '@/types/domain';

// ─── Low-level get / set ──────────────────────────────────────────────────────

/** Returns the parsed JSON value for a key, or null if not found. */
export function getSetting<T>(key: string): T | null {
  const row = getDb()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(key) as Pick<SettingRow, 'value'> | undefined;
  if (!row) return null;
  return JSON.parse(row.value) as T;
}

/** Upserts a setting, encoding the value as JSON. */
export function setSetting<T>(key: string, value: T): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key, JSON.stringify(value));
}

// ─── Typed aggregate ─────────────────────────────────────────────────────────

/** Returns all app settings, with defaults for any missing keys. */
export function getAllSettings(): AppSettings {
  const rows = getDb().prepare('SELECT key, value FROM settings').all() as SettingRow[];
  const map = new Map(rows.map(r => [r.key, JSON.parse(r.value) as unknown]));

  // Reason: provide safe defaults so callers never need to null-check settings
  return {
    theme: (map.get('theme') ?? 'dark') as Theme,
    date_format: (map.get('date_format') ?? 'DD MMM YYYY') as DateFormat,
    time_areas: (map.get('time_areas') ?? {}) as Record<string, TimeAreaConfig>,
    tomtom_api_key: (map.get('tomtom_api_key') ?? '') as string,
  };
}
