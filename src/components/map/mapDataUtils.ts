// Reason: pure functions isolated from React/Leaflet so tests can import without DOM.
import type { ActivityRow, ReservationRow, DayRow } from '@/types/db';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PinType = 'lodging' | 'flight' | 'transit' | 'car' | 'restaurant' | 'activity';

export interface MapPin {
  id: string;         // e.g. "activity-12" or "reservation-7"
  type: PinType;
  name: string;       // human-readable title
  meta: string;       // time range or relevant detail
  lat: number;
  lng: number;
  color: string;      // matching --res-* token value
  dayNumber: number;
  dayTitle: string;
  dayDate: string;
}

export interface MapDay {
  dayNumber: number;
  title: string;
  date: string;
  pinCount: number;
  hasLodging: boolean;
}

// ── Color resolution ─────────────────────────────────────────────────────────
// Reason: Leaflet sets colors via element.style which cannot resolve CSS vars.
// Reading computed values at call time ensures colors update after theme switch.

const TOKEN_MAP: Record<PinType, string> = {
  lodging:    '--res-lodging',
  flight:     '--res-flight',
  transit:    '--res-transit',
  car:        '--res-car',
  restaurant: '--res-restaurant',
  activity:   '--act-default',
};

export function resolveTypeColors(): Record<PinType, string> {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    Object.entries(TOKEN_MAP).map(([type, token]) => [
      type,
      style.getPropertyValue(token).trim(),
    ]),
  ) as Record<PinType, string>;
}

// Kept for non-DOM contexts (tests, SSR). These are the light-mode fallback values.
export const TYPE_COLORS: Record<PinType, string> = {
  lodging:    '#9B91D4',
  flight:     '#6A9CC5',
  transit:    '#5AA8B8',
  car:        '#8AAD7A',
  restaurant: '#D4825A',
  activity:   '#A09890',
};

export const TYPE_LABELS: Record<PinType, string> = {
  lodging:    'Lodging',
  flight:     'Flight',
  transit:    'Transit',
  car:        'Car',
  restaurant: 'Restaurant',
  activity:   'Activity',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function reservationPinType(type: ReservationRow['type']): PinType {
  switch (type) {
    case 'train':
    case 'bus':
    case 'ferry':      return 'transit';
    case 'rental_car': return 'car';
    case 'flight':     return 'flight';
    case 'lodging':    return 'lodging';
    case 'restaurant': return 'restaurant';
    default:           return 'activity'; // 'other' → grouped under activity colour
  }
}

function reservationMeta(res: ReservationRow): string {
  try {
    const d = JSON.parse(res.details) as Record<string, string>;
    switch (res.type) {
      case 'flight':   return `${d['depart_time'] ?? ''} ${d['depart_airport'] ?? ''} → ${d['arrive_airport'] ?? ''}`.trim();
      case 'lodging':  return `${d['check_in_time'] ?? 'Check-in'} · ${d['property_name'] ?? ''}`.trim();
      case 'restaurant': return `${d['time'] ?? ''} · party of ${d['party_size'] ?? '?'}`.trim();
      case 'train':
      case 'bus':
      case 'ferry':    return `${d['from_time'] ?? ''} ${d['from_stop'] ?? '?'} → ${d['to_stop'] ?? '?'}`.trim();
      case 'rental_car': return `${d['company'] ?? ''} · pick up ${d['pickup_time'] ?? ''}`.trim();
      default:         return '';
    }
  } catch {
    return '';
  }
}

// ── Main builder ──────────────────────────────────────────────────────────────

interface DayWithRowActivities extends DayRow {
  activities: ActivityRow[];
}

export function buildMapData(
  days: DayWithRowActivities[],
  reservations: ReservationRow[],
): { pins: MapPin[]; mapDays: MapDay[]; lodgingRoute: { lat: number; lng: number }[] } {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));

  const pins: MapPin[] = [];

  sorted.forEach((day, idx) => {
    const dayNumber = idx + 1;
    const dayTitle  = day.title ?? `Day ${dayNumber}`;
    const dayDate   = day.date;

    // Activities on this day
    for (const act of day.activities) {
      if (act.lat === null || act.lng === null) continue;
      pins.push({
        id:         `activity-${act.id}`,
        type:       'activity',
        name:       act.title,
        meta:       act.start_time ? (act.end_time ? `${act.start_time} – ${act.end_time}` : act.start_time) : '',
        lat:        act.lat,
        lng:        act.lng,
        color:      TYPE_COLORS.activity,
        dayNumber,
        dayTitle,
        dayDate,
      });
    }

    // Reservations on this day
    const dayRes = reservations.filter(r => r.day_id === day.id);
    for (const res of dayRes) {
      if (res.lat === null || res.lng === null) continue;
      const pinType = reservationPinType(res.type);
      pins.push({
        id:         `reservation-${res.id}`,
        type:       pinType,
        name:       res.title,
        meta:       reservationMeta(res),
        lat:        res.lat,
        lng:        res.lng,
        color:      TYPE_COLORS[pinType],
        dayNumber,
        dayTitle,
        dayDate,
      });
    }
  });

  // Reason: lodging (and other trip-level reservations) have day_id = null so they
  // are never reached in the day loop above. Associate each with the day whose date
  // matches or immediately follows the reservation's reference date (check_in_date etc.)
  const tripLevelRes = reservations.filter(r => r.day_id === null);
  for (const res of tripLevelRes) {
    if (res.lat === null || res.lng === null) continue;
    const pinType = reservationPinType(res.type);

    let assocDayNumber = 0;
    let assocDayTitle  = res.title;
    let assocDayDate   = '';
    try {
      const d = JSON.parse(res.details) as Record<string, string>;
      const refDate = d['check_in_date'] ?? d['pickup_date'] ?? d['depart_date'] ?? '';
      if (refDate) {
        const idx = sorted.findIndex(day => day.date >= refDate);
        const useIdx = idx >= 0 ? idx : sorted.length - 1;
        if (useIdx >= 0 && sorted[useIdx]) {
          assocDayNumber = useIdx + 1;
          assocDayTitle  = sorted[useIdx].title ?? `Day ${useIdx + 1}`;
          assocDayDate   = sorted[useIdx].date;
        }
      }
    } catch { /* keep defaults */ }

    pins.push({
      id:        `reservation-${res.id}`,
      type:       pinType,
      name:       res.title,
      meta:       reservationMeta(res),
      lat:        res.lat,
      lng:        res.lng,
      color:      TYPE_COLORS[pinType],
      dayNumber:  assocDayNumber,
      dayTitle:   assocDayTitle,
      dayDate:    assocDayDate,
    });
  }

  // Lodging reservations with coords, sorted by check-in date
  const lodgingWithCoords = reservations
    .filter(r => r.type === 'lodging' && r.lat !== null && r.lng !== null)
    .sort((a, b) => {
      try {
        const ad = (JSON.parse(a.details) as Record<string, string>)['check_in_date'] ?? '';
        const bd = (JSON.parse(b.details) as Record<string, string>)['check_in_date'] ?? '';
        return ad.localeCompare(bd);
      } catch {
        return 0;
      }
    });
  const lodgingRoute = lodgingWithCoords.map(r => ({ lat: r.lat as number, lng: r.lng as number }));

  // MapDay list
  const mapDays: MapDay[] = sorted.map((day, idx) => {
    const dayNumber  = idx + 1;
    const dayPins    = pins.filter(p => p.dayNumber === dayNumber);
    const dayRes     = reservations.filter(r => r.day_id === day.id);
    const hasLodging = dayRes.some(r => r.type === 'lodging');
    return {
      dayNumber,
      title:    day.title ?? `Day ${dayNumber}`,
      date:     day.date,
      pinCount: dayPins.length,
      hasLodging,
    };
  });

  return { pins, mapDays, lodgingRoute };
}

/** Count of days that have zero geocoded pins (activities + reservations). */
export function countDaysMissingLocations(days: DayWithRowActivities[], reservations: ReservationRow[]): number {
  return days.filter(day => {
    const hasActPin = day.activities.some(a => a.lat !== null && a.lng !== null);
    const hasResPin = reservations.filter(r => r.day_id === day.id).some(r => r.lat !== null && r.lng !== null);
    return !hasActPin && !hasResPin;
  }).length;
}
