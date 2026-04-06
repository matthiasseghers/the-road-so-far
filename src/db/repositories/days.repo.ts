import { getDb } from '../client.js';
import type { DayRow } from '@/types/db';

// ─── Queries ──────────────────────────────────────────────────────────────────

export function findDaysByTripId(tripId: number): DayRow[] {
  return getDb()
    .prepare('SELECT * FROM days WHERE trip_id = ? ORDER BY date ASC')
    .all(tripId) as DayRow[];
}

export function findDayById(id: number): DayRow | null {
  const row = getDb().prepare('SELECT * FROM days WHERE id = ?').get(id) as DayRow | undefined;
  return row ?? null;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export interface UpsertDayInput {
  trip_id: number;
  date: string; // YYYY-MM-DD
  notes?: string | null;
}

/** INSERT OR IGNORE — safe to call for dates that may already exist. */
export function upsertDay(input: UpsertDayInput): DayRow {
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO days (trip_id, date, notes)
     VALUES (@trip_id, @date, @notes)`,
  ).run({
    trip_id: input.trip_id,
    date: input.date,
    notes: input.notes ?? null,
  });
  // Return the row whether it was just inserted or already existed
  return db
    .prepare('SELECT * FROM days WHERE trip_id = ? AND date = ?')
    .get(input.trip_id, input.date) as DayRow;
}

export interface UpdateDayInput {
  title?: string | null;
  subtitle?: string | null;
  notes?: string | null;
}

export function updateDay(id: number, input: UpdateDayInput): DayRow | null {
  const db = getDb();
  const cur = db.prepare('SELECT * FROM days WHERE id = ?').get(id) as DayRow | undefined;
  if (!cur) return null;
  db.prepare(
    `UPDATE days SET
       title    = @title,
       subtitle = @subtitle,
       notes    = @notes
     WHERE id = @id`,
  ).run({
    id,
    title:    input.title    !== undefined ? input.title    : cur.title,
    subtitle: input.subtitle !== undefined ? input.subtitle : cur.subtitle,
    notes:    input.notes    !== undefined ? input.notes    : cur.notes,
  });
  return findDayById(id);
}

export function deleteDay(id: number): void {
  getDb().prepare('DELETE FROM days WHERE id = ?').run(id);
}
