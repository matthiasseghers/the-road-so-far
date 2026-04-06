import { format as dateFnsFormat, parseISO, isValid } from 'date-fns';

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

// ── Distance formatting ───────────────────────────────────────────────────────

/** Formats metres as "1,234 km" or "767 mi". */
export function formatDistance(metres: number, unit: 'km' | 'mi'): string {
  if (unit === 'mi') {
    const miles = metres / 1609.344;
    return `${miles.toLocaleString(undefined, { maximumFractionDigits: 0 })} mi`;
  }
  const km = metres / 1000;
  return `${km.toLocaleString(undefined, { maximumFractionDigits: 1 })} km`;
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
