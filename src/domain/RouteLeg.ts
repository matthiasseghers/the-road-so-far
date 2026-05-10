import type { RouteLegRow, RouteLegTravelMode, LegModeRow } from '@/types/db';

export interface PolylinePoint {
  lat: number;
  lng: number;
}

export class RouteLeg {
  readonly id: number;
  readonly trip_id: number;
  readonly from_lat: number;
  readonly from_lng: number;
  readonly to_lat: number;
  readonly to_lng: number;
  readonly distance_m: number;
  readonly duration_s: number;
  readonly travel_mode: RouteLegTravelMode;
  readonly fetched_at: string;

  private readonly _polyline: string;

  constructor(row: RouteLegRow) {
    this.id          = row.id;
    this.trip_id     = row.trip_id;
    this.from_lat    = row.from_lat;
    this.from_lng    = row.from_lng;
    this.to_lat      = row.to_lat;
    this.to_lng      = row.to_lng;
    this.distance_m  = row.distance_m;
    this.duration_s  = row.duration_s;
    this.travel_mode = row.travel_mode;
    this.fetched_at  = row.fetched_at;
    this._polyline   = row.polyline;
  }

  /** Decoded polyline points for Leaflet rendering. */
  points(): PolylinePoint[] {
    return JSON.parse(this._polyline) as PolylinePoint[];
  }

  /** Human-readable duration: "45 min" or "1 h 23 min". */
  durationLabel(): string {
    const totalMin = Math.round(this.duration_s / 60);
    if (totalMin < 60) return `${totalMin} min`;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
  }

  /** Human-readable distance in km or mi. */
  distanceLabel(unit: 'km' | 'mi' = 'km'): string {
    if (unit === 'mi') {
      const miles = this.distance_m / 1609.344;
      return `${miles.toFixed(1)} mi`;
    }
    const km = this.distance_m / 1000;
    return km < 1 ? `${this.distance_m} m` : `${km.toFixed(1)} km`;
  }
}

const COORD_EPSILON = 0.00001; // ~1 m precision

function coordsMatch(
  fromLat1: number, fromLat2: number,
  fromLng1: number, fromLng2: number,
  toLat1: number, toLat2: number,
  toLng1: number, toLng2: number,
): boolean {
  return (
    Math.abs(fromLat1 - fromLat2) < COORD_EPSILON &&
    Math.abs(fromLng1 - fromLng2) < COORD_EPSILON &&
    Math.abs(toLat1 - toLat2) < COORD_EPSILON &&
    Math.abs(toLng1 - toLng2) < COORD_EPSILON
  );
}

/**
 * Find the cached leg connecting two geocoded points.
 * When `mode` is given, prefer the leg with that travel_mode; fall back to
 * any mode for the same coord pair (e.g. while a re-sync is in flight).
 */
export function findLeg(
  legs: RouteLeg[],
  from: { lat: number | null; lng: number | null } | null,
  to: { lat: number | null; lng: number | null } | null,
  mode?: RouteLegTravelMode,
): RouteLeg | null {
  if (!from || !to || from.lat == null || from.lng == null || to.lat == null || to.lng == null) return null;
  const byCoords = legs.filter(
    l => coordsMatch(l.from_lat, from.lat!, l.from_lng, from.lng!, l.to_lat, to.lat!, l.to_lng, to.lng!),
  );
  if (!mode) return byCoords[0] ?? null;
  // Reason: prefer the requested mode so the chip shows the correct route after sync;
  // fall back to any cached mode while a re-sync for the new mode is in flight.
  return byCoords.find(l => l.travel_mode === mode) ?? byCoords[0] ?? null;
}

/**
 * Return the user-selected travel mode for a coord pair, falling back to `fallback`
 * when no override has been stored. Pure function — no DB access.
 */
export function findLegMode(
  modes: LegModeRow[],
  fromLat: number, fromLng: number,
  toLat: number,   toLng: number,
  fallback: RouteLegTravelMode,
): RouteLegTravelMode {
  const found = modes.find(m =>
    coordsMatch(m.from_lat, fromLat, m.from_lng, fromLng, m.to_lat, toLat, m.to_lng, toLng),
  );
  return found?.travel_mode ?? fallback;
}
