// ICS (iCalendar) export — pure functions, no React, no DOM.
// Produces a .ics string for a trip, controlled by IcsOptions.
//
// No external dependency — iCalendar is a plain text format (RFC 5545).

import type { TripWithDays } from '@/types/domain';
import type { Reservation } from '@/domain/Reservation';
import { stripTiptapJson } from './helpers';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format a date-only ISO string as an iCalendar DATE value (YYYYMMDD). */
function toIcsDate(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

/** Format a date + HH:MM time as an iCalendar DATETIME value (YYYYMMDDTHHmmss). */
function toIcsDateTime(isoDate: string, hhmm: string): string {
  const datePart = isoDate.replace(/-/g, '');
  const [h, m]   = hhmm.split(':');
  return `${datePart}T${h}${m}00`;
}

/** Generate a stable UID for an event given a namespace and numeric id. */
function makeUid(namespace: string, id: number, tripId: number): string {
  return `rsf-${namespace}-${id}-trip${tripId}@the-road-so-far`;
}

/** Fold long lines per RFC 5545 §3.1 (max 75 octets, continuation starts with a space). */
function foldLine(line: string): string {
  const MAX = 75;
  if (line.length <= MAX) return line;
  const chunks: string[] = [];
  // First chunk is MAX chars; each continuation is MAX-1 (the space takes one octet).
  chunks.push(line.slice(0, MAX));
  let pos = MAX;
  while (pos < line.length) {
    chunks.push(' ' + line.slice(pos, pos + MAX - 1));
    pos += MAX - 1;
  }
  return chunks.join('\r\n');
}

/** Escape text values per RFC 5545 §3.3.11. */
function escapeText(raw: string): string {
  return raw
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/** Add `days` to an ISO date string (YYYY-MM-DD) without UTC conversion. */
function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, (m as number) - 1, (d as number) + days);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** Produce a NOW timestamp in iCalendar format (UTC). */
function nowStamp(): string {
  const n = new Date();
  const pad = (x: number): string => String(x).padStart(2, '0');
  return (
    `${n.getUTCFullYear()}${pad(n.getUTCMonth() + 1)}${pad(n.getUTCDate())}` +
    `T${pad(n.getUTCHours())}${pad(n.getUTCMinutes())}${pad(n.getUTCSeconds())}Z`
  );
}

// ── VEVENT builder ────────────────────────────────────────────────────────────

interface VEventAllDay {
  kind:     'allday';
  uid:      string;
  dtstart:  string; // YYYYMMDD
  dtend:    string; // YYYYMMDD — exclusive end (RFC 5545 §3.6.1)
  summary:  string;
  description?: string;
  location?: string;
}

interface VEventTimed {
  kind:     'timed';
  uid:      string;
  dtstart:  string; // YYYYMMDDTHHmmss (local, no timezone suffix = "floating")
  dtend:    string; // YYYYMMDDTHHmmss
  summary:  string;
  description?: string;
  location?: string;
}

type VEvent = VEventAllDay | VEventTimed;

function serializeVEvent(ev: VEvent, stamp: string): string {
  const lines: string[] = ['BEGIN:VEVENT'];

  lines.push(`UID:${ev.uid}`);
  lines.push(`DTSTAMP:${stamp}`);

  if (ev.kind === 'allday') {
    lines.push(`DTSTART;VALUE=DATE:${ev.dtstart}`);
    lines.push(`DTEND;VALUE=DATE:${ev.dtend}`);
  } else {
    lines.push(`DTSTART:${ev.dtstart}`);
    lines.push(`DTEND:${ev.dtend}`);
  }

  lines.push(`SUMMARY:${escapeText(ev.summary)}`);
  if (ev.description) lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
  if (ev.location)    lines.push(`LOCATION:${escapeText(ev.location)}`);

  lines.push('END:VEVENT');
  return lines.map(foldLine).join('\r\n');
}

// ── Event builders ────────────────────────────────────────────────────────────

/** One all-day VEVENT per trip day (even if untitled). */
function dayEvents(trip: TripWithDays, stamp: string): string[] {
  return (trip.days ?? []).map((day, i) => {
    const summary = day.title
      ? `Day ${i + 1}: ${day.title}`
      : `${trip.title} — Day ${i + 1}`;
    const parts: string[] = [];
    if (day.subtitle) parts.push(day.subtitle);
    const notesText = stripTiptapJson(day.notes);
    if (notesText) parts.push(notesText);

    // iCal all-day DTEND is exclusive, so the next calendar day.
    const dtend = toIcsDate(addDays(day.date, 1));

    const ev: VEventAllDay = {
      kind:        'allday',
      uid:         makeUid('day', day.id, trip.id),
      dtstart:     toIcsDate(day.date),
      dtend,
      summary,
      description: parts.join('\\n') || undefined,
    };
    return serializeVEvent(ev, stamp);
  });
}

/** One timed VEVENT per activity that has a start_time, or all activities when timedOnly=false. */
function activityEvents(trip: TripWithDays, stamp: string, timedOnly: boolean): string[] {
  const events: string[] = [];
  for (const day of trip.days ?? []) {
    for (const act of day.activities ?? []) {
      if (timedOnly && !act.start_time) continue;

      if (act.start_time) {
        const dtstart = toIcsDateTime(day.date, act.start_time);
        // If no end_time, default to 1 hour later.
        let dtend: string;
        if (act.end_time) {
          dtend = toIcsDateTime(day.date, act.end_time);
        } else {
          const [h, m] = act.start_time.split(':').map(Number);
          const endHour = String(h + 1).padStart(2, '0');
          dtend = toIcsDateTime(day.date, `${endHour}:${String(m).padStart(2, '0')}`);
        }
        const ev: VEventTimed = {
          kind:        'timed',
          uid:         makeUid('act', act.id, trip.id),
          dtstart,
          dtend,
          summary:     act.title,
          description: act.notes ?? undefined,
          location:    act.location ?? undefined,
        };
        events.push(serializeVEvent(ev, stamp));
      } else {
        // Untimed activity — emit as all-day event on the day it belongs to.
        const dtend = toIcsDate(addDays(day.date, 1));
        const ev: VEventAllDay = {
          kind:        'allday',
          uid:         makeUid('act', act.id, trip.id),
          dtstart:     toIcsDate(day.date),
          dtend,
          summary:     act.title,
          description: act.notes ?? undefined,
          location:    act.location ?? undefined,
        };
        events.push(serializeVEvent(ev, stamp));
      }
    }
  }
  return events;
}

/** Multi-day VEVENT for lodging reservations. */
function lodgingEvents(trip: TripWithDays, reservations: Reservation[], stamp: string): string[] {
  return reservations
    .filter(r => r.isLodging())
    .map(r => {
      const d = r.parsedDetails<{ property_name?: string; check_in_date?: string; check_out_date?: string }>();
      const name    = d.property_name ?? r.title;
      const checkIn = d.check_in_date;
      const checkOut = d.check_out_date;
      if (!checkIn || !checkOut) return null;

      // DTEND is the check-out date (exclusive is fine here — guest leaves that day).
      const dtend = toIcsDate(checkOut);

      const parts: string[] = [];
      if (r.confirmation_ref) parts.push(`Ref: ${r.confirmation_ref}`);
      if (r.notes) parts.push(r.notes);

      const ev: VEventAllDay = {
        kind:        'allday',
        uid:         makeUid('res', r.id, trip.id),
        dtstart:     toIcsDate(checkIn),
        dtend,
        summary:     `Stay: ${name}`,
        description: parts.join('\\n') || undefined,
        location:    r.location ?? undefined,
      };
      return serializeVEvent(ev, stamp);
    })
    .filter((s): s is string => s !== null);
}

/** All-day VEVENT for non-lodging reservations (on the day they're linked to). */
function reservationEvents(trip: TripWithDays, reservations: Reservation[], stamp: string): string[] {
  const dayDateMap = new Map<number, string>(
    (trip.days ?? []).map(d => [d.id, d.date]),
  );

  return reservations
    .filter(r => !r.isLodging() && r.day_id !== null)
    .map(r => {
      const date = r.day_id !== null ? dayDateMap.get(r.day_id) : undefined;
      if (!date) return null;

      const dtend = toIcsDate(addDays(date, 1));

      const parts: string[] = [];
      if (r.confirmation_ref) parts.push(`Ref: ${r.confirmation_ref}`);
      if (r.notes) parts.push(r.notes);

      const ev: VEventAllDay = {
        kind:        'allday',
        uid:         makeUid('res', r.id, trip.id),
        dtstart:     toIcsDate(date),
        dtend,
        summary:     r.title,
        description: parts.join('\\n') || undefined,
        location:    r.location ?? undefined,
      };
      return serializeVEvent(ev, stamp);
    })
    .filter((s): s is string => s !== null);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Controls which events are included in the exported .ics file.
 *
 * tripCoverage:
 *   'single'  — one all-day event spanning the whole trip (start_date → end_date)
 *   'per-day' — one all-day event per calendar day
 *
 * activities:
 *   'none'  — no activity events
 *   'timed' — only activities that have a start_time (exported as DATETIME events)
 *   'all'   — timed activities as DATETIME + untimed as all-day events
 *
 * reservations:
 *   true  — lodging as multi-day events, other bookings as all-day events
 *   false — omit reservations
 */
export interface IcsOptions {
  tripCoverage:  'single' | 'per-day';
  activities:    'none' | 'timed' | 'all';
  reservations:  boolean;
}

export const ICS_DEFAULTS: IcsOptions = {
  tripCoverage: 'per-day',
  activities:   'timed',
  reservations: true,
};

/** Single all-day VEVENT covering the entire trip. */
function singleTripEvent(trip: TripWithDays, stamp: string): string[] {
  if (!trip.start_date || !trip.end_date) return [];
  // DTEND is exclusive — the day after end_date.
  const dtend = toIcsDate(addDays(trip.end_date, 1));
  const ev: VEventAllDay = {
    kind:    'allday',
    uid:     makeUid('trip', trip.id, trip.id),
    dtstart: toIcsDate(trip.start_date),
    dtend,
    summary: trip.title,
  };
  return [serializeVEvent(ev, stamp)];
}

/**
 * Generate an iCalendar (.ics) string for the given trip.
 * Pass IcsOptions to control which events are included.
 */
export function generateTripIcs(
  trip:         TripWithDays,
  reservations: Reservation[],
  options:      IcsOptions = ICS_DEFAULTS,
): string {
  const stamp = nowStamp();

  const allEvents: string[] = [
    ...(options.tripCoverage === 'single' ? singleTripEvent(trip, stamp) : dayEvents(trip, stamp)),
    ...(options.activities !== 'none' ? activityEvents(trip, stamp, options.activities === 'timed') : []),
    ...(options.reservations ? [
      ...lodgingEvents(trip, reservations, stamp),
      ...reservationEvents(trip, reservations, stamp),
    ] : []),
  ];

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Road So Far//Trip Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(trip.title)}`,
    ...allEvents,
    'END:VCALENDAR',
  ];

  return lines.join('\r\n') + '\r\n';
}
