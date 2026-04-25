import { getDb } from '../client.js';
import type { LegModeRow, RouteLegTravelMode } from '@/types/db';

export function getLegModes(tripId: number): LegModeRow[] {
  return getDb()
    .prepare('SELECT * FROM leg_modes WHERE trip_id = ?')
    .all(tripId) as LegModeRow[];
}

/** Upserts the user-selected mode for a specific coord pair. */
export function setLegMode(
  tripId: number,
  fromLat: number, fromLng: number,
  toLat: number,   toLng: number,
  mode: RouteLegTravelMode,
): void {
  getDb().prepare(`
    INSERT INTO leg_modes (trip_id, from_lat, from_lng, to_lat, to_lng, travel_mode)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(trip_id, from_lat, from_lng, to_lat, to_lng)
    DO UPDATE SET travel_mode = excluded.travel_mode
  `).run(tripId, fromLat, fromLng, toLat, toLng, mode);
}
