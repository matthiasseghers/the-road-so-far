import { getDb } from '../client.js';
import type { ActivityRow } from '@/types/db';
import type { CreateActivityInput, PatchActivityInput } from '@/schemas/activity.schema';

// Re-export schema input types so existing consumers can still import from here.
export type { CreateActivityInput };
export type { PatchActivityInput as UpdateActivityInput };

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Reason: every SELECT on activities JOINs activity_types to provide the
// human-readable `activity_type` name alongside the FK id. Using a shared
// fragment keeps the queries DRY and consistent.
const SELECT_ACTIVITY = `SELECT a.*, at.name AS activity_type, at.icon_name AS activity_type_icon FROM activities a JOIN activity_types at ON a.activity_type_id = at.id`;

// ─── Queries ──────────────────────────────────────────────────────────────────

export function findActivitiesByDayId(dayId: number): ActivityRow[] {
  return getDb()
    .prepare(
      `${SELECT_ACTIVITY} WHERE a.day_id = ?
       ORDER BY CASE WHEN a.start_time IS NULL THEN 1 ELSE 0 END, a.start_time ASC, a.sort_order ASC`,
    )
    .all(dayId) as ActivityRow[];
}

export function findActivitiesByTripId(tripId: number): ActivityRow[] {
  return getDb()
    .prepare(
      `${SELECT_ACTIVITY} WHERE a.trip_id = ?
       ORDER BY CASE WHEN a.start_time IS NULL THEN 1 ELSE 0 END, a.start_time ASC, a.sort_order ASC`,
    )
    .all(tripId) as ActivityRow[];
}

export function findActivityById(id: number): ActivityRow | null {
  const row = getDb()
    .prepare(`${SELECT_ACTIVITY} WHERE a.id = ?`)
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
      `INSERT INTO activities (day_id, trip_id, title, activity_type_id, start_time, end_time, sort_order, notes, location, lat, lng)
       VALUES (@day_id, @trip_id, @title, @activity_type_id, @start_time, @end_time, @sort_order, @notes, @location, @lat, @lng)`,
    )
    .run({
      day_id:           input.day_id ?? null,
      trip_id:          input.trip_id,
      title:            input.title,
      activity_type_id: input.activity_type_id,
      start_time:       input.start_time ?? null,
      end_time:         input.end_time ?? null,
      sort_order:       sortOrder,
      notes:            input.notes ?? null,
      location:         input.location ?? null,
      lat:              input.lat ?? null,
      lng:              input.lng ?? null,
    });

  return findActivityById(result.lastInsertRowid as number) ?? (() => { throw new Error('Insert succeeded but row not found'); })();
}


export function updateActivity(id: number, input: PatchActivityInput): ActivityRow | null {
  const db = getDb();
  const cur = db
    .prepare(`${SELECT_ACTIVITY} WHERE a.id = ?`)
    .get(id) as ActivityRow | undefined;
  if (!cur) return null;

  db.prepare(
    `UPDATE activities SET
       title = @title, activity_type_id = @activity_type_id,
       start_time = @start_time, end_time = @end_time,
       sort_order = @sort_order, notes = @notes,
       location = @location, lat = @lat, lng = @lng
     WHERE id = @id`,
  ).run({
    id,
    title:            input.title            ?? cur.title,
    activity_type_id: input.activity_type_id ?? cur.activity_type_id,
    start_time:       input.start_time       !== undefined ? input.start_time : cur.start_time,
    end_time:         input.end_time         !== undefined ? input.end_time   : cur.end_time,
    sort_order:       input.sort_order       ?? cur.sort_order,
    notes:            input.notes            !== undefined ? input.notes      : cur.notes,
    location:         input.location         !== undefined ? input.location   : cur.location,
    lat:              input.lat              !== undefined ? input.lat        : cur.lat,
    lng:              input.lng              !== undefined ? input.lng        : cur.lng,
  });

  return findActivityById(id);
}

export function updateActivityLatLng(id: number, lat: number, lng: number): void {
  getDb()
    .prepare('UPDATE activities SET lat = @lat, lng = @lng WHERE id = @id')
    .run({ id, lat, lng });
}

export function deleteActivity(id: number): void {
  getDb().prepare('DELETE FROM activities WHERE id = ?').run(id);
}

/** Resets sort_order for activities in a day in the given order. Runs in a transaction.
 * Returns the number of rows that matched (to detect out-of-scope IDs). */
export function reorderActivities(dayId: number, orderedIds: number[]): number {
  const db = getDb();
  const update = db.prepare(
    'UPDATE activities SET sort_order = ? WHERE id = ? AND day_id = ?',
  );
  const txn = db.transaction((ids: number[]) => {
    let matched = 0;
    ids.forEach((actId, index) => { matched += update.run(index, actId, dayId).changes; });
    return matched;
  });
  return txn(orderedIds);
}
