import { format as dateFnsFormat, parseISO, isValid } from 'date-fns';
import type { ReservationType } from '@/types/db';

// ── Structured address formatting ─────────────────────────────────────────────

/**
 * Formats structured address fields into a human-readable string.
 * Format: "street number, postalCode city, country".
 * Falls back to `fallback` if no structured fields are present.
 */
export function formatStructuredAddress(
  fields: {
    address_street?: string | null;
    address_number?: string | null;
    address_postal_code?: string | null;
    address_city?: string | null;
    address_country?: string | null;
  },
  fallback?: string | null,
): string | null {
  const parts: string[] = [];

  // street + number
  const streetPart = [fields.address_street, fields.address_number].filter(Boolean).join(' ');
  if (streetPart) parts.push(streetPart);

  // postalCode + city
  const cityPart = [fields.address_postal_code, fields.address_city].filter(Boolean).join(' ');
  if (cityPart) parts.push(cityPart);

  // country
  if (fields.address_country) parts.push(fields.address_country);

  return parts.length > 0 ? parts.join(', ') : (fallback ?? null);
}

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

// ── Reservation date/time range ──────────────────────────────────────────────

/**
 * Returns a human-readable date/time range string for a reservation's details.
 * e.g. "Mon 2 Jun · 10:00 – Thu 5 Jun · 11:00" for lodging.
 * Returns null when no date information is present.
 */
export function formatReservationRange(type: ReservationType, details: Record<string, string>): string | null {
  function fmtDT(iso: string | undefined, time: string | undefined): string | null {
    if (!iso) return null;
    const d = parseISO(`${iso}T12:00:00`);
    const dateStr = isValid(d) ? dateFnsFormat(d, 'EEE d MMM') : null;
    if (!dateStr) return null;
    return time ? `${dateStr} · ${time}` : dateStr;
  }

  switch (type) {
    case 'lodging': {
      const a = fmtDT(details['check_in_date'], details['check_in_time']);
      const b = fmtDT(details['check_out_date'], details['check_out_time']);
      if (!a && !b) return null;
      return [a, b].filter(Boolean).join(' – ');
    }
    case 'flight': {
      const a = fmtDT(details['depart_date'], details['depart_time']);
      const b = fmtDT(details['arrive_date'], details['arrive_time']);
      if (!a && !b) return null;
      return [a, b].filter(Boolean).join(' → ');
    }
    case 'train':
    case 'bus':
    case 'ferry': {
      const a = fmtDT(details['from_date'], details['from_time']);
      const b = fmtDT(details['to_date'], details['to_time']);
      if (!a && !b) return null;
      return [a, b].filter(Boolean).join(' → ');
    }
    case 'rental_car': {
      const a = fmtDT(details['pickup_date'], details['pickup_time']);
      const b = fmtDT(details['dropoff_date'], details['dropoff_time']);
      if (!a && !b) return null;
      return [a, b].filter(Boolean).join(' → ');
    }
    case 'restaurant':
      return fmtDT(details['date'], details['time']);
    default:
      return null;
  }
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
