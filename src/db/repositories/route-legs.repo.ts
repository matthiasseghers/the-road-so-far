import { getDb } from '../client.js';
import type { RouteLegRow, RouteLegTravelMode } from '@/types/db';

export function getByTrip(tripId: number): RouteLegRow[] {
  return getDb()
    .prepare('SELECT * FROM route_legs WHERE trip_id = ? ORDER BY id')
    .all(tripId) as RouteLegRow[];
}

export interface UpsertLegInput {
  trip_id: number;
  from_lat: number;
  from_lng: number;
  to_lat: number;
  to_lng: number;
  distance_m: number;
  duration_s: number;
  polyline: string;
  travel_mode: RouteLegTravelMode;
}

/** Inserts or replaces a leg (keyed on the UNIQUE constraint). */
export function upsertLeg(data: UpsertLegInput): RouteLegRow {
  const db = getDb();
  db.prepare(`
    INSERT INTO route_legs
      (trip_id, from_lat, from_lng, to_lat, to_lng, distance_m, duration_s, polyline, travel_mode, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(trip_id, from_lat, from_lng, to_lat, to_lng, travel_mode)
    DO UPDATE SET
      distance_m = excluded.distance_m,
      duration_s = excluded.duration_s,
      polyline   = excluded.polyline,
      fetched_at = excluded.fetched_at
  `).run(
    data.trip_id, data.from_lat, data.from_lng,
    data.to_lat,  data.to_lng,
    data.distance_m, data.duration_s, data.polyline, data.travel_mode,
  );

  return db.prepare(`
    SELECT * FROM route_legs
    WHERE trip_id = ? AND from_lat = ? AND from_lng = ? AND to_lat = ? AND to_lng = ? AND travel_mode = ?
  `).get(data.trip_id, data.from_lat, data.from_lng, data.to_lat, data.to_lng, data.travel_mode) as RouteLegRow;
}

export interface RouteLegUsageStats {
  /** Legs fetched today (UTC date). Each = 1 TomTom API call. */
  today: number;
  /** Total cached legs across all trips. */
  total: number;
  /** TomTom free tier daily limit for the Routing API. */
  dailyLimit: number;
}

export function getUsageStats(): RouteLegUsageStats {
  const db = getDb();
  const today = (db.prepare(`SELECT COUNT(*) FROM route_legs WHERE date(fetched_at) = date('now')`).pluck().get() as number) ?? 0;
  const total = (db.prepare('SELECT COUNT(*) FROM route_legs').pluck().get() as number) ?? 0;
  return { today, total, dailyLimit: 2_500 };
}
