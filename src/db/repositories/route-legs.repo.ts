import { getDb } from '../client.js';
import type { RouteLegRow, RouteLegTravelMode } from '@/types/db';

/** TomTom Routing API free-tier daily call cap. */
const TOMTOM_ROUTING_DAILY_LIMIT = 2_500;

/**
 * Reservations are offset by this value in sort_order so they appear after
 * activities when both share the same day and neither has an explicit position.
 */
const RESERVATION_SORT_OFFSET = 1_000;

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
  return { today, total, dailyLimit: TOMTOM_ROUTING_DAILY_LIMIT };
}

export interface GeoPoint {
  day_id: number;
  date: string;
  sort_order: number;
  lat: number;
  lng: number;
}

/**
 * Returns all geocoded activity + reservation points for a trip, ordered by
 * date then sort_order. Reservations are offset by 1000 so they sort after
 * same-day activities.
 */
export function getGeoPointsForTrip(tripId: number): GeoPoint[] {
  return getDb().prepare(`
    SELECT a.day_id, d.date, a.sort_order, a.lat, a.lng
    FROM   activities a JOIN days d ON d.id = a.day_id
    WHERE  a.trip_id = ? AND a.lat IS NOT NULL AND a.lng IS NOT NULL
    UNION ALL
    SELECT r.day_id, d.date, r.sort_order + ${RESERVATION_SORT_OFFSET} AS sort_order, r.lat, r.lng
    FROM   reservations r JOIN days d ON d.id = r.day_id
    WHERE  r.trip_id = ? AND r.lat IS NOT NULL AND r.lng IS NOT NULL
    ORDER  BY date, sort_order
  `).all(tripId, tripId) as GeoPoint[];
}
