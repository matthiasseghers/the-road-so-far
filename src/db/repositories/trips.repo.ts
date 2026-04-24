import { getDb } from '../client.js';
import type { TripRow, DayRow, ActivityRow } from '@/types/db';
import type { CreateTripInput, PatchTripInput } from '@/schemas/trip.schema';

// Re-export schema input types so existing consumers can still import from here.
export type { CreateTripInput };
export type UpdateTripInput = Omit<PatchTripInput, 'start_date' | 'end_date'> & {
  // Reason: these fields are updated internally by the sync service,
  // not via API user input, so they are not part of the user-facing schema.
  // Dates can be null to clear them.
  start_date?: string | null;
  end_date?: string | null;
  distance_total_m?: number | null;
  distance_synced_at?: string | null;
};

// ─── Local types (repo-layer only) ───────────────────────────────────────────

// Reason: the repo parses tags from JSON string before sending to the API layer.
type ParsedTripRow = Omit<TripRow, 'tags'> & {
  tags: string[];
  day_count?: number;
  activity_count?: number;
};

interface RawDayWithActivities extends DayRow { activities: ActivityRow[] }
export interface RawTripWithDays extends ParsedTripRow {
  days: RawDayWithActivities[];
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseTrip(row: TripRow & { day_count?: number; activity_count?: number }): ParsedTripRow {
  return { ...row, tags: JSON.parse(row.tags) as string[] };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function findAllTrips(): ParsedTripRow[] {
  const rows = getDb()
    .prepare(`
      SELECT t.*,
        (SELECT COUNT(*) FROM days d WHERE d.trip_id = t.id) AS day_count,
        (SELECT COUNT(*) FROM activities a
           JOIN days d ON a.day_id = d.id
           WHERE d.trip_id = t.id) AS activity_count
      FROM trips t
      ORDER BY t.start_date ASC NULLS LAST, t.created_at ASC
    `)
    .all() as Array<TripRow & { day_count: number; activity_count: number }>;
  return rows.map(parseTrip);
}

export function findTripById(id: number): ParsedTripRow | null {
  const row = getDb()
    .prepare('SELECT * FROM trips WHERE id = ?')
    .get(id) as TripRow | undefined;
  return row ? parseTrip(row) : null;
}

export function findTripWithDays(id: number): RawTripWithDays | null {
  const db = getDb();

  const tripRow = db.prepare('SELECT * FROM trips WHERE id = ?').get(id) as TripRow | undefined;
  if (!tripRow) return null;

  const dayRows = db
    .prepare('SELECT * FROM days WHERE trip_id = ? ORDER BY date ASC')
    .all(id) as DayRow[];

  const days: RawDayWithActivities[] = dayRows.map(day => {
    const actRows = db
      .prepare(
        'SELECT * FROM activities WHERE day_id = ? ORDER BY start_time ASC NULLS LAST, sort_order ASC',
      )
      .all(day.id) as ActivityRow[];
    return { ...day, activities: actRows };
  });

  return { ...parseTrip(tripRow), days };
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function createTrip(input: CreateTripInput): ParsedTripRow {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO trips (title, emoji, status, start_date, end_date, tags, notes, cover_gradient, external_id)
       VALUES (@title, @emoji, @status, @start_date, @end_date, @tags, @notes, @cover_gradient,
               lower(hex(randomblob(16))))`,
    )
    .run({
      title: input.title,
      emoji: input.emoji ?? '🗺️',
      status: input.status ?? 'draft',
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      tags: JSON.stringify(input.tags ?? []),
      notes: input.notes ?? null,
      cover_gradient: input.cover_gradient ?? 'warm-brown',
    });
  // Reason: lastInsertRowid is always a number for AUTOINCREMENT tables
  return findTripById(result.lastInsertRowid as number)!;
}

export function updateTrip(id: number, input: UpdateTripInput): ParsedTripRow | null {
  const db = getDb();
  const cur = db.prepare('SELECT * FROM trips WHERE id = ?').get(id) as TripRow | undefined;
  if (!cur) return null;

  db.prepare(
    `UPDATE trips SET
       title = @title, emoji = @emoji, status = @status,
       start_date = @start_date, end_date = @end_date, tags = @tags,
       notes = @notes, cover_gradient = @cover_gradient,
       distance_total_m = @distance_total_m, distance_synced_at = @distance_synced_at
     WHERE id = @id`,
  ).run({
    id,
    title: input.title ?? cur.title,
    emoji: input.emoji ?? cur.emoji,
    status: input.status ?? cur.status,
    // Reason: undefined means "not provided" (keep current); null means "clear"
    start_date: input.start_date !== undefined ? input.start_date : cur.start_date,
    end_date: input.end_date !== undefined ? input.end_date : cur.end_date,
    tags: input.tags !== undefined ? JSON.stringify(input.tags) : cur.tags,
    notes: input.notes !== undefined ? input.notes : cur.notes,
    cover_gradient: input.cover_gradient ?? cur.cover_gradient,
    distance_total_m:
      input.distance_total_m !== undefined ? input.distance_total_m : cur.distance_total_m,
    distance_synced_at:
      input.distance_synced_at !== undefined ? input.distance_synced_at : cur.distance_synced_at,
  });

  return findTripById(id);
}

export function deleteTrip(id: number): void {
  getDb().prepare('DELETE FROM trips WHERE id = ?').run(id);
}
