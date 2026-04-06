import {
  eachDayOfInterval,
  parseISO,
  format,
  differenceInCalendarDays,
  isValid,
  isWithinInterval,
} from 'date-fns';
import type { DayRow, ActivityRow } from '@/types/db';
import type { Activity, DayViewModel } from '@/types/domain';
import { Activity as ActivityClass } from '@/domain/Activity';

// ─── ISO date helpers ─────────────────────────────────────────────────────────

/** Returns every ISO date string (YYYY-MM-DD) in [startDate, endDate] inclusive. */
export function eachDayInRange(startDate: string, endDate: string): string[] {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (!isValid(start) || !isValid(end) || start > end) return [];
  return eachDayOfInterval({ start, end }).map(d => format(d, 'yyyy-MM-dd'));
}

/** Today as YYYY-MM-DD. */
export function today(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/** Alias for today() — preferred name for use in domain classes and utilities. */
export function todayISO(): string {
  return today();
}

/** Convert a JS Date to YYYY-MM-DD. */
export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** Number of calendar days between two ISO dates (b - a). */
export function getDaysBetween(a: string, b: string): number {
  return differenceInCalendarDays(parseISO(b), parseISO(a));
}

/** Whether an ISO date falls within [start, end] inclusive. */
export function isDateInRange(
  date: string,
  start: string | null,
  end: string | null,
): boolean {
  if (!start || !end) return false;
  return isWithinInterval(parseISO(date), {
    start: parseISO(start),
    end: parseISO(end),
  });
}

/**
 * Returns true when two YYYY-MM-DD date ranges overlap (inclusive on both ends).
 * Uses pure string comparison — no Date parsing needed since YYYY-MM-DD is
 * lexicographically sortable.
 */
export function dateRangesOverlap(
  a: { start: string; end: string },
  b: { start: string; end: string },
): boolean {
  return !(a.end < b.start || a.start > b.end);
}

/**
 * Format an ISO date string using a date-fns format token.
 * Silently returns the raw string if the date is invalid.
 */
export function formatDate(isoDate: string, fmt: string = 'MMM d, yyyy'): string {
  // Reason: date-only strings (YYYY-MM-DD) are parsed as UTC midnight by parseISO.
  // In negative UTC-offset timezones this shifts the display to the previous calendar day.
  // Appending T12:00:00 (local noon) keeps the displayed date correct for any ±12h offset.
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(isoDate);
  const normalized = isDateOnly ? `${isoDate}T12:00:00` : isoDate;
  const d = parseISO(normalized);
  return isValid(d) ? format(d, fmt) : isoDate;
}

/**
 * Returns a human-readable relative time string for an ISO datetime.
 * e.g. "just now", "5m ago", "3h ago", "2d ago", "4mo ago", "1y ago"
 */
export function timeAgo(isoDateTime: string): string {
  // Reason: SQLite's datetime('now') returns UTC as 'YYYY-MM-DD HH:MM:SS' — no timezone indicator.
  // date-fns parseISO treats strings without a timezone indicator as local time, causing an
  // offset error equal to the user's UTC offset. We normalise only the SQLite space-separated
  // format; already-valid ISO 8601 T-separator strings are left untouched.
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}/.test(isoDateTime)
    ? isoDateTime.replace(' ', 'T') + 'Z'
    : isoDateTime;
  const date = parseISO(normalized);
  if (!isValid(date)) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// ─── Activity view-model assembly ─────────────────────────────────────────────

function toActivity(row: ActivityRow): Activity {
  return new ActivityClass(row);
}

/**
 * Groups a flat activities array into the DayViewModel used by DayCard.
 * Activities with start_time sort before those without; secondary sort by sort_order.
 */
export function buildDayViewModel(day: DayRow, activityRows: ActivityRow[]): DayViewModel {
  const activities = activityRows
    .map(toActivity)
    .sort((a, b) => {
      if (a.start_time && !b.start_time) return -1;
      if (!a.start_time && b.start_time) return 1;
      if (a.start_time && b.start_time) {
        const cmp = a.start_time.localeCompare(b.start_time);
        if (cmp !== 0) return cmp;
      }
      return a.sort_order - b.sort_order;
    });
  return { day, activities };
}
