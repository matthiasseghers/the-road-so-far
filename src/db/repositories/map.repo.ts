import { getDb } from '../client.js';

export interface MapPinActivity {
  id: number;
  title: string;
  start_time: string | null;
  lat: number;
  lng: number;
  trip_id: number;
  trip_title: string;
  day_date: string;
}

export interface MapPinReservation {
  id: number;
  title: string;
  type: string;
  lat: number;
  lng: number;
  trip_id: number;
  trip_title: string;
  day_date: string | null;
}

export interface MapTripMeta {
  id: number;
  title: string;
  start_date: string | null;
  end_date: string | null;
}

export interface MapPinsResult {
  activities: MapPinActivity[];
  reservations: MapPinReservation[];
  trips: MapTripMeta[];
}

/**
 * Returns all geocoded activities + reservations across all trips, plus the
 * trip metadata needed to render the legend — in a single DB round-trip.
 */
export function getMapPins(): MapPinsResult {
  const db = getDb();

  const activities = db.prepare(`
    SELECT a.id, a.title, a.start_time, a.lat, a.lng,
           t.id    AS trip_id,
           t.title AS trip_title,
           d.date  AS day_date
    FROM   activities a
    JOIN   days d  ON d.id  = a.day_id
    JOIN   trips t ON t.id  = d.trip_id
    WHERE  a.lat IS NOT NULL AND a.lng IS NOT NULL
  `).all() as MapPinActivity[];

  const reservations = db.prepare(`
    SELECT r.id, r.title, r.type, r.lat, r.lng,
           t.id    AS trip_id,
           t.title AS trip_title,
           d.date  AS day_date
    FROM   reservations r
    JOIN   trips t ON t.id = r.trip_id
    LEFT JOIN days d ON d.id = r.day_id
    WHERE  r.lat IS NOT NULL AND r.lng IS NOT NULL
  `).all() as MapPinReservation[];

  // Reason: ordered by start_date for consistent palette assignment.
  const trips = db.prepare(`
    SELECT DISTINCT t.id, t.title, t.start_date, t.end_date
    FROM   trips t
    WHERE  t.id IN (
      SELECT DISTINCT trip_id FROM activities   WHERE lat IS NOT NULL AND lng IS NOT NULL
      UNION
      SELECT DISTINCT trip_id FROM reservations WHERE lat IS NOT NULL AND lng IS NOT NULL
    )
    ORDER BY t.start_date
  `).all() as MapTripMeta[];

  return { activities, reservations, trips };
}
