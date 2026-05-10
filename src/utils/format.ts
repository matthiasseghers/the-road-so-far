import { format as dateFnsFormat, parseISO, isValid } from 'date-fns';
import type { ReservationType } from '@/types/db';

// ── Date formatting ───────────────────────────────────────────────────────────

/**
 * Formats a date range as "14 Sep – 2 Oct 2025".
 * When both dates are in the same year the year is omitted from the start date.
 */
export function formatDateRange(start: string, end: string): string {
  const s = parseISO(`${start}T12:00:00`);
  const e = parseISO(`${end}T12:00:00`);
  if (!isValid(s) || !isValid(e)) return `${start} – ${end}`;
  const sameYear = s.getFullYear() === e.getFullYear();
  const startFmt = sameYear ? 'd MMM' : 'd MMM yyyy';
  return `${dateFnsFormat(s, startFmt)} – ${dateFnsFormat(e, 'd MMM yyyy')}`;
}

/**
 * Formats a trip date range for legend/sidebar display.
 * "3 Jan – 14 Jan 2026" (same year, year omitted from start)
 * "28 Dec 2025 – 4 Jan 2026" (cross-year)
 * Returns null when start is null.
 */
export function formatTripDateRange(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const s = parseISO(`${start}T12:00:00`);
  if (!isValid(s)) return null;
  if (!end) return dateFnsFormat(s, 'd MMM yyyy');
  const e = parseISO(`${end}T12:00:00`);
  if (!isValid(e)) return dateFnsFormat(s, 'd MMM yyyy');
  const sameYear = s.getFullYear() === e.getFullYear();
  const startFmt = sameYear ? 'd MMM' : 'd MMM yyyy';
  return `${dateFnsFormat(s, startFmt)} \u2013 ${dateFnsFormat(e, 'd MMM yyyy')}`;
}

// ── Distance formatting ───────────────────────────────────────────────────────

/** Formats metres as "1,234 km" or "767 mi". */
export function formatDistance(metres: number, unit: 'km' | 'mi'): string {
  if (unit === 'mi') {
    const miles = metres / 1609.344;
    return `${Math.round(miles)} mi`;
  }
  const km = metres / 1000;
  return `${parseFloat(km.toFixed(1))} km`;
}

// ── Duration formatting ───────────────────────────────────────────────────────

/** Formats seconds as "2h 34m", or just "45m" when under an hour. */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins  = totalMinutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0)  return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// ── Progress formatting ───────────────────────────────────────────────────────

/** Formats a 0-100 progress value as "62%". */
export function formatProgress(pct: number): string {
  return `${Math.round(pct)}%`;
}

// ── Night count ───────────────────────────────────────────────────────────────

/** Number of nights between two ISO date strings (check-out minus check-in). */
export function nightCount(checkIn: string, checkOut: string): number {
  const a = parseISO(checkIn).getTime();
  const b = parseISO(checkOut).getTime();
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

// ── Activity time formatting ──────────────────────────────────────────────────

/**
 * Returns a display string for an activity's time window.
 * "HH:MM – HH:MM" if both times are set.
 * "HH:MM" if only start_time is set.
 * "" if neither is set.
 */
export function formatActivityTime(startTime: string | null, endTime: string | null): string {
  if (!startTime) return '';
  if (endTime) return `${startTime} \u2013 ${endTime}`;
  return startTime;
}

// ── Reservation auto-title ────────────────────────────────────────────────────

/**
 * Derives a short display title from a reservation's type and details.
 * Used both by the Reservation domain class and the repo when persisting a title.
 */
export function reservationAutoTitle(type: ReservationType, details: Record<string, string>, fallbackTitle = 'Reservation'): string {
  switch (type) {
    case 'flight':
      return `${details['flight_number'] ?? ''} \u00b7 ${details['depart_airport'] ?? '?'} \u2192 ${details['arrive_airport'] ?? '?'}`.trim();
    case 'lodging':
      return details['property_name'] ?? 'Lodging';
    case 'restaurant':
      return details['restaurant_name'] ?? 'Restaurant';
    case 'train':
    case 'bus':
    case 'ferry':
      return `${details['from_stop'] ?? '?'} \u2192 ${details['to_stop'] ?? '?'}`;
    case 'rental_car':
      return `${details['company'] ?? 'Car'} \u00b7 ${details['pickup_location'] ?? '?'} \u2192 ${details['dropoff_location'] ?? '?'}`;
    default:
      return details['description'] ?? fallbackTitle;
  }
}
