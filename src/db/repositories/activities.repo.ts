import { getDb } from '../client.js';
import type { ActivityRow } from '@/types/db';
import type { CreateActivityInput, PatchActivityInput } from '@/schemas/activity.schema';

// Re-export schema input types so existing consumers can still import from here.
export type { CreateActivityInput };
export type { PatchActivityInput as UpdateActivityInput };

// ─── Queries ──────────────────────────────────────────────────────────────────

export function findActivitiesByDayId(dayId: number): ActivityRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM activities WHERE day_id = ?
       ORDER BY CASE WHEN start_time IS NULL THEN 1 ELSE 0 END, start_time ASC, sort_order ASC`,
    )
    .all(dayId) as ActivityRow[];
}

export function findActivitiesByTripId(tripId: number): ActivityRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM activities WHERE trip_id = ?
       ORDER BY CASE WHEN start_time IS NULL THEN 1 ELSE 0 END, start_time ASC, sort_order ASC`,
    )
    .all(tripId) as ActivityRow[];
}

export function findActivityById(id: number): ActivityRow | null {
  const row = getDb()
    .prepare('SELECT * FROM activities WHERE id = ?')
    .get(id) as ActivityRow | undefined;
  return row ?? null;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function createActivity(input: CreateActivityInput): ActivityRow {
  const db = getDb();

  // Default sort_order: place after last activity in same day bucket
  let sortOrder = input.sort_order;
  if (sortOrder === undefined) {
    const dayFilter = input.day_id != null ? input.day_id : null;
    const max = dayFilter !== null
      ? db.prepare('SELECT MAX(sort_order) AS m FROM activities WHERE day_id = ?').get(dayFilter) as { m: number | null }
      : db.prepare('SELECT MAX(sort_order) AS m FROM activities WHERE day_id IS NULL AND trip_id = ?').get(input.trip_id) as { m: number | null };
    sortOrder = (max.m ?? -1) + 1;
  }

  const result = db
    .prepare(
      `INSERT INTO activities (day_id, trip_id, title, activity_type, start_time, end_time, sort_order, notes)
       VALUES (@day_id, @trip_id, @title, @activity_type, @start_time, @end_time, @sort_order, @notes)`,
    )
    .run({
      day_id:        input.day_id ?? null,
      trip_id:       input.trip_id,
      title:         input.title,
      activity_type: input.activity_type ?? 'note',
      start_time:    input.start_time ?? null,
      end_time:      input.end_time ?? null,
      sort_order:    sortOrder,
      notes:         input.notes ?? null,
    });

  return findActivityById(result.lastInsertRowid as number)!;
}


export function updateActivity(id: number, input: PatchActivityInput): ActivityRow | null {
  const db = getDb();
  const cur = db
    .prepare('SELECT * FROM activities WHERE id = ?')
    .get(id) as ActivityRow | undefined;
  if (!cur) return null;

  db.prepare(
    `UPDATE activities SET
       title = @title, activity_type = @activity_type,
       start_time = @start_time, end_time = @end_time,
       sort_order = @sort_order, notes = @notes
     WHERE id = @id`,
  ).run({
    id,
    title:         input.title         ?? cur.title,
    activity_type: input.activity_type ?? cur.activity_type,
    start_time:    input.start_time    !== undefined ? input.start_time : cur.start_time,
    end_time:      input.end_time      !== undefined ? input.end_time   : cur.end_time,
    sort_order:    input.sort_order    ?? cur.sort_order,
    notes:         input.notes         !== undefined ? input.notes      : cur.notes,
  });

  return findActivityById(id);
}

export function deleteActivity(id: number): void {
  getDb().prepare('DELETE FROM activities WHERE id = ?').run(id);
}

/** Resets sort_order for activities in a day in the given order. Runs in a transaction. */
export function reorderActivities(dayId: number, orderedIds: number[]): void {
  const db = getDb();
  const update = db.prepare(
    'UPDATE activities SET sort_order = ? WHERE id = ? AND day_id = ?',
  );
  const txn = db.transaction((ids: number[]) => {
    ids.forEach((actId, index) => update.run(index, actId, dayId));
  });
  txn(orderedIds);
}
