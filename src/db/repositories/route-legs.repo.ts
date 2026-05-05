import { getDb } from '../client.js';
import type { RouteLegRow, RouteLegTravelMode } from '@/types/db';
import { isCheckinDay } from '@/utils/lodging';
import { getLodgingDayAnchors } from './reservations.repo.js';
import { RESERVATION_SORT_OFFSET } from '@/utils/sort';

/**
 * Reservations are offset by this value in sort_order so they appear after
 * activities when both share the same day and neither has an explicit position.
 * Imported from src/utils/sort.ts — the PdfExportModal uses the same constant.
 */

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

export interface GeoPoint {
  day_id: number;
  date: string;
  sort_order: number;
  lat: number;
  lng: number;
}

export interface ExpectedLeg {
  from_lat: number;
  from_lng: number;
  to_lat:   number;
  to_lng:   number;
}

/**
 * Computes the ordered sequence of (from → to) leg pairs for a trip based on
 * the current geocoded points. This is the ground truth for what legs *should*
 * exist — sync uses it to decide what to fetch and what to delete.
 */
export function computeExpectedLegs(tripId: number): ExpectedLeg[] {
  const points = getGeoPointsForTrip(tripId);
  const byDate = new Map<string, GeoPoint[]>();
  for (const p of points) {
    const list = byDate.get(p.date) ?? [];
    list.push(p);
    byDate.set(p.date, list);
  }
  const dates = [...byDate.keys()].sort();
  const legs: ExpectedLeg[] = [];

  for (const date of dates) {
    // Reason: sort within each day because lodging anchors are appended after
    // SQL-ordered activity/reservation points and may not arrive in position.
    const dayPts = byDate.get(date)!.slice().sort((a, b) => a.sort_order - b.sort_order);
    for (let i = 0; i < dayPts.length - 1; i++) {
      legs.push({ from_lat: dayPts[i].lat, from_lng: dayPts[i].lng, to_lat: dayPts[i + 1].lat, to_lng: dayPts[i + 1].lng });
    }
  }
  for (let i = 0; i < dates.length - 1; i++) {
    const sorted = (d: string) => byDate.get(d)!.slice().sort((a, b) => a.sort_order - b.sort_order);
    const last  = sorted(dates[i]).at(-1)!;
    const first = sorted(dates[i + 1])[0];
    legs.push({ from_lat: last.lat, from_lng: last.lng, to_lat: first.lat, to_lng: first.lng });
  }
  return legs;
}

/**
 * Deletes stored legs whose (from, to) pair is no longer in the expected set.
 * Returns the number of legs deleted.
 */
export function deleteOrphanLegs(tripId: number, expectedLegs: ExpectedLeg[]): number {
  const db = getDb();
  const stored = db
    .prepare('SELECT id, from_lat, from_lng, to_lat, to_lng FROM route_legs WHERE trip_id = ?')
    .all(tripId) as { id: number; from_lat: number; from_lng: number; to_lat: number; to_lng: number }[];

  const expectedSet = new Set(
    expectedLegs.map(l => `${l.from_lat},${l.from_lng},${l.to_lat},${l.to_lng}`),
  );

  const orphanIds = stored
    .filter(s => !expectedSet.has(`${s.from_lat},${s.from_lng},${s.to_lat},${s.to_lng}`))
    .map(s => s.id);

  if (orphanIds.length === 0) return 0;

  // Reason: better-sqlite3 doesn't support array params; use a parameterised
  // placeholder list built from the known-safe integer IDs.
  const placeholders = orphanIds.map(() => '?').join(',');
  db.prepare(`DELETE FROM route_legs WHERE id IN (${placeholders})`).run(...orphanIds);
  return orphanIds.length;
}

/**
 * Returns synthetic GeoPoints for geocoded lodging reservations, injected as
 * silent anchors into the leg graph:
 *   - check_in_date day  → last point  (sort_order = 9_999, guest arriving)
 *   - overnight days     → first point (sort_order = -1,    guest already there)
 *
 * Delegates date-range resolution to getLodgingDayAnchors in reservations.repo
 * so the SQL lives in one place.
 */
function getLodgingAnchorPoints(tripId: number): GeoPoint[] {
  return getLodgingDayAnchors(tripId).map(row => ({
    day_id:     row.day_id,
    date:       row.date,
    // Reason: check-in day → guest arrives last, so lodging sorts to end of day.
    // Overnight stay (check_in < date) → guest departs first, so lodging sorts to start.
    sort_order: isCheckinDay(row.check_in_date, row.date) ? 9_999 : -1,
    lat:        row.lat,
    lng:        row.lng,
  }));
}

/**
 * Returns all geocoded activity + reservation points for a trip, ordered by
 * date then sort_order. Reservations are offset by 1000 so they sort after
 * same-day activities.
 */
export function getGeoPointsForTrip(tripId: number): GeoPoint[] {
  const activityAndDayRes = getDb().prepare(`
    SELECT a.day_id, d.date, a.sort_order, a.lat, a.lng
    FROM   activities a JOIN days d ON d.id = a.day_id
    WHERE  a.trip_id = ? AND a.lat IS NOT NULL AND a.lng IS NOT NULL
    UNION ALL
    SELECT r.day_id, d.date, r.sort_order + ${RESERVATION_SORT_OFFSET} AS sort_order, r.lat, r.lng
    FROM   reservations r JOIN days d ON d.id = r.day_id
    WHERE  r.trip_id = ? AND r.lat IS NOT NULL AND r.lng IS NOT NULL
    ORDER  BY date, sort_order
  `).all(tripId, tripId) as GeoPoint[];

  // Reason: lodgings link to trip_id only (no day_id), so they are not returned
  // by the day_id join above. Merge them in as anchor points here.
  const lodgingAnchors = getLodgingAnchorPoints(tripId);
  return [...activityAndDayRes, ...lodgingAnchors];
}
