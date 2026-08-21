// Unit tests for the ICS export module.
// Pure function tests — no DOM, no mocks needed.

import { describe, it, expect } from 'vitest';
import { generateTripIcs, ICS_DEFAULTS } from '@/lib/export/ics/ics';
import type { IcsOptions } from '@/lib/export/ics/ics';
import { Reservation } from '@/domain/Reservation';
import type { TripWithDays, DayWithActivities } from '@/types/domain';
import type { ReservationRow, ActivityRow } from '@/types/db';
import type { TripData } from '@/domain/Trip';
import { Trip } from '@/domain/Trip';
import { Activity } from '@/domain/Activity';

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeTrip(overrides: Partial<TripData> = {}): Trip {
  return new Trip({
    id:                 1,
    title:              'Tokyo Explorer',
    emoji:              '🗾',
    status:             'confirmed',
    start_date:         '2026-05-12',
    end_date:           '2026-05-14',
    tags:               '[]',
    notes:              null,
    cover_gradient:     'linear-gradient(135deg,#667eea,#764ba2)',
    distance_total_m:   null,
    distance_synced_at: null,
    created_at:         '2026-01-01T00:00:00.000Z',
    updated_at:         '2026-01-01T00:00:00.000Z',
    ...overrides,
  });
}

function makeActivity(overrides: Partial<ActivityRow> = {}): Activity {
  return new Activity({
    id:            1,
    day_id:        10,
    trip_id:       1,
    title:         'Morning walk',
    activity_type: 'outdoors',
    activity_type_icon: 'tree-pine',
    activity_type_id: 4,
    start_time:    '09:00',
    end_time:      '10:30',
    sort_order:    0,
    notes:         null,
    location:      null,
    lat:           null,
    lng:           null,
    created_at:    '2026-01-01T00:00:00.000Z',
    updated_at:    '2026-01-01T00:00:00.000Z',
    ...overrides,
  });
}

function makeDay(date: string, activities: Activity[] = []): DayWithActivities {
  return {
    id:         10,
    trip_id:    1,
    date,
    title:      null,
    subtitle:   null,
    notes:      null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    activities,
  };
}

function makeTripWithDays(days: DayWithActivities[], tripOverrides: Partial<TripData> = {}): TripWithDays {
  const trip = makeTrip(tripOverrides);
  return Object.assign(trip, { days }) as TripWithDays;
}

function makeReservation(overrides: Partial<ReservationRow> = {}): Reservation {
  const base: ReservationRow = {
    id:               1,
    trip_id:          1,
    day_id:           null,
    type:             'lodging',
    title:            'Shinjuku Hotel',
    status:           'confirmed',
    confirmation_ref: 'SH-001',
    notes:            null,
    cost_amount:      null,
    cost_currency:    'JPY',
    details:          JSON.stringify({
      property_name:  'Shinjuku Hotel',
      check_in_date:  '2026-05-12',
      check_out_date: '2026-05-14',
    }),
    sort_order:  0,
    location:    null,
    lat:         null,
    lng:         null,
    created_at:  '2026-01-01T00:00:00.000Z',
    updated_at:  '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
  return new Reservation(base);
}

// ── generateTripIcs — structure ───────────────────────────────────────────────

describe('generateTripIcs', () => {
  it('returns a string beginning and ending with VCALENDAR', () => {
    const trip = makeTripWithDays([]);
    const ics  = generateTripIcs(trip, []);
    expect(ics).toMatch(/^BEGIN:VCALENDAR/);
    expect(ics.trimEnd()).toMatch(/END:VCALENDAR$/);
  });

  it('includes required iCal headers', () => {
    const ics = generateTripIcs(makeTripWithDays([]), []);
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('CALSCALE:GREGORIAN');
    expect(ics).toContain('METHOD:PUBLISH');
    expect(ics).toContain('PRODID:-//The Road So Far//Trip Export//EN');
  });

  it('includes X-WR-CALNAME with the trip title', () => {
    const trip = makeTripWithDays([], { title: 'My Japan Trip' });
    expect(generateTripIcs(trip, [])).toContain('X-WR-CALNAME:My Japan Trip');
  });

  it('uses CRLF line endings throughout', () => {
    const ics = generateTripIcs(makeTripWithDays([]), []);
    // Every line should be separated by \r\n.
    expect(ics).toContain('\r\n');
    // No bare \n without \r preceding it.
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });

  // ── Day events ────────────────────────────────────────────────────────────

  it('creates one VEVENT per day', () => {
    const days = [makeDay('2026-05-12'), makeDay('2026-05-13'), makeDay('2026-05-14')];
    const ics  = generateTripIcs(makeTripWithDays(days), []);
    const matches = ics.match(/BEGIN:VEVENT/g);
    expect(matches).toHaveLength(3);
  });

  it('day event DTSTART uses VALUE=DATE format', () => {
    const days = [makeDay('2026-05-12')];
    const ics  = generateTripIcs(makeTripWithDays(days), []);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260512');
  });

  it('day event DTEND is the following day (exclusive)', () => {
    const days = [makeDay('2026-05-12')];
    const ics  = generateTripIcs(makeTripWithDays(days), []);
    expect(ics).toContain('DTEND;VALUE=DATE:20260513');
  });

  it('uses day title in SUMMARY when present', () => {
    const day = { ...makeDay('2026-05-12'), title: 'Arrival in Tokyo' };
    const ics  = generateTripIcs(makeTripWithDays([day]), []);
    expect(ics).toContain('SUMMARY:Day 1: Arrival in Tokyo');
  });

  it('falls back to trip title in SUMMARY when day has no title', () => {
    const ics = generateTripIcs(makeTripWithDays([makeDay('2026-05-12')]), []);
    expect(ics).toContain('SUMMARY:Tokyo Explorer \u2014 Day 1');
  });

  // ── Activity events ───────────────────────────────────────────────────────

  it('creates timed VEVENT for activities with start_time', () => {
    const act  = makeActivity({ start_time: '09:00', end_time: '10:30' });
    const day  = makeDay('2026-05-12', [act]);
    const ics  = generateTripIcs(makeTripWithDays([day]), []);
    expect(ics).toContain('DTSTART:20260512T090000');
    expect(ics).toContain('DTEND:20260512T103000');
    expect(ics).toContain('SUMMARY:Morning walk');
  });

  it('defaults end_time to +1 hour when activity has no end_time', () => {
    const act = makeActivity({ start_time: '14:00', end_time: null });
    const day = makeDay('2026-05-12', [act]);
    const ics = generateTripIcs(makeTripWithDays([day]), []);
    expect(ics).toContain('DTSTART:20260512T140000');
    expect(ics).toContain('DTEND:20260512T150000');
  });

  it('skips activities with no start_time', () => {
    const timedAct   = makeActivity({ id: 1, start_time: '09:00', end_time: null });
    const untimedAct = makeActivity({ id: 2, start_time: null, end_time: null, title: 'Evening stroll' });
    const day = makeDay('2026-05-12', [timedAct, untimedAct]);
    const ics = generateTripIcs(makeTripWithDays([day]), []);
    expect(ics).not.toContain('Evening stroll');
  });

  // ── Lodging events ────────────────────────────────────────────────────────

  it('creates a multi-day VEVENT for lodging reservations', () => {
    const res = makeReservation();
    const ics = generateTripIcs(makeTripWithDays([]), [res]);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260512');
    expect(ics).toContain('DTEND;VALUE=DATE:20260514');
    expect(ics).toContain('SUMMARY:Stay: Shinjuku Hotel');
  });

  it('skips lodging reservation missing check_in_date or check_out_date', () => {
    const res = makeReservation({ details: JSON.stringify({ property_name: 'Hotel X' }) });
    const ics = generateTripIcs(makeTripWithDays([]), [res]);
    // No VEVENT should be created for this reservation.
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  // ── Non-lodging reservation events ───────────────────────────────────────

  it('creates an all-day VEVENT for a non-lodging reservation linked to a day', () => {
    const day = makeDay('2026-05-12');
    const res = makeReservation({
      id:      2,
      type:    'flight',
      title:   'LH 710 Frankfurt → Tokyo',
      day_id:  10,
      details: JSON.stringify({ depart_date: '2026-05-12', arrive_date: '2026-05-12' }),
    });
    const ics = generateTripIcs(makeTripWithDays([day]), [res]);
    expect(ics).toContain('SUMMARY:LH 710 Frankfurt \u2192 Tokyo');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260512');
  });

  // ── Text escaping ─────────────────────────────────────────────────────────

  it('escapes commas and semicolons in SUMMARY', () => {
    const day = { ...makeDay('2026-05-12'), title: 'Museums, Parks; etc.' };
    const ics  = generateTripIcs(makeTripWithDays([day]), []);
    expect(ics).toContain('SUMMARY:Day 1: Museums\\, Parks\\; etc.');
  });

  // ── UIDs ──────────────────────────────────────────────────────────────────

  it('each VEVENT has a unique UID', () => {
    const act = makeActivity({ id: 5, start_time: '10:00', end_time: null });
    const day = { ...makeDay('2026-05-12', [act]), id: 10 };
    const res = makeReservation({ id: 7 });
    const ics = generateTripIcs(makeTripWithDays([day]), [res]);
    const uids = [...ics.matchAll(/^UID:(.+)$/gm)].map(m => m[1]);
    const unique = new Set(uids);
    expect(unique.size).toBe(uids.length);
  });
});

// ── IcsOptions ────────────────────────────────────────────────────────────────

describe('ICS_DEFAULTS', () => {
  it('exports expected default values', () => {
    expect(ICS_DEFAULTS.tripCoverage).toBe('per-day');
    expect(ICS_DEFAULTS.activities).toBe('timed');
    expect(ICS_DEFAULTS.reservations).toBe(true);
  });
});

describe('IcsOptions — tripCoverage', () => {
  it('single: emits exactly one VEVENT spanning full trip dates', () => {
    const days = [makeDay('2026-05-12'), makeDay('2026-05-13')];
    const opts: IcsOptions = { ...ICS_DEFAULTS, tripCoverage: 'single' };
    const ics = generateTripIcs(makeTripWithDays(days), [], opts);
    const events = ics.match(/BEGIN:VEVENT/g);
    expect(events).toHaveLength(1);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260512');
    // end_date of the fixture trip is 2026-05-14; exclusive DTEND = 20260515
    expect(ics).toContain('DTEND;VALUE=DATE:20260515');
    expect(ics).toContain('SUMMARY:Tokyo Explorer');
  });

  it('single: emits no events when trip has no start/end date', () => {
    const opts: IcsOptions = { ...ICS_DEFAULTS, tripCoverage: 'single' };
    const trip = makeTripWithDays([], { start_date: null, end_date: null });
    const ics  = generateTripIcs(trip, [], opts);
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  it('per-day: emits one event per day (default)', () => {
    const days = [makeDay('2026-05-12'), makeDay('2026-05-13'), makeDay('2026-05-14')];
    const ics  = generateTripIcs(makeTripWithDays(days), [], ICS_DEFAULTS);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
  });
});

describe('IcsOptions — activities', () => {
  const timedAct   = makeActivity({ id: 1, start_time: '09:00', end_time: '10:00', title: 'Morning run' });
  const untimedAct = makeActivity({ id: 2, start_time: null, end_time: null, title: 'Leisurely evening' });

  it('none: includes no activity events', () => {
    const day  = makeDay('2026-05-12', [timedAct, untimedAct]);
    const opts: IcsOptions = { ...ICS_DEFAULTS, activities: 'none' };
    const ics  = generateTripIcs(makeTripWithDays([day]), [], opts);
    // Only the day event should appear
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).not.toContain('Morning run');
    expect(ics).not.toContain('Leisurely evening');
  });

  it('timed: includes only activities with a start_time', () => {
    const day  = makeDay('2026-05-12', [timedAct, untimedAct]);
    const opts: IcsOptions = { ...ICS_DEFAULTS, activities: 'timed' };
    const ics  = generateTripIcs(makeTripWithDays([day]), [], opts);
    expect(ics).toContain('Morning run');
    expect(ics).not.toContain('Leisurely evening');
    // day event + timed activity = 2 events
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });

  it('all: includes timed activities as DATETIME and untimed as all-day', () => {
    const day  = makeDay('2026-05-12', [timedAct, untimedAct]);
    const opts: IcsOptions = { ...ICS_DEFAULTS, activities: 'all' };
    const ics  = generateTripIcs(makeTripWithDays([day]), [], opts);
    expect(ics).toContain('Morning run');
    expect(ics).toContain('Leisurely evening');
    // Timed one has DTSTART without VALUE=DATE
    expect(ics).toContain('DTSTART:20260512T090000');
    // Untimed one has VALUE=DATE
    expect(ics).toContain('DTSTART;VALUE=DATE:20260512');
    // day event + timed + untimed = 3 events
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
  });
});

describe('IcsOptions — reservations', () => {
  it('false: omits all reservation events', () => {
    const res  = makeReservation();
    const opts: IcsOptions = { ...ICS_DEFAULTS, reservations: false };
    const ics  = generateTripIcs(makeTripWithDays([]), [res], opts);
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  it('true: includes lodging reservation events', () => {
    const res  = makeReservation();
    const opts: IcsOptions = { ...ICS_DEFAULTS, tripCoverage: 'single', activities: 'none', reservations: true };
    const ics  = generateTripIcs(makeTripWithDays([]), [res], opts);
    expect(ics).toContain('Stay: Shinjuku Hotel');
  });
});

