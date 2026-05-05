// Tests for pure helper functions in src/lib/export/helpers.ts
// and view-model builders in src/lib/export/pdf.viewmodel.ts.
//
// Reason: helpers.ts has zero @react-pdf/renderer imports — it is pure
// TypeScript. No mock is needed; these tests run in the standard node
// environment without any renderer setup.

import { describe, it, expect } from 'vitest';
import { formatModeLabel, buildLodgingStripText } from '@/lib/export/pdf/helpers';
import { buildCoverViewModel, buildDayViewModel } from '@/lib/export/pdf/pdf.viewmodel';
import { Trip } from '@/domain/Trip';
import { Reservation } from '@/domain/Reservation';
import type { TripWithDays, DayWithActivities } from '@/types/domain';
import type { TripRow, ReservationRow } from '@/types/db';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeTripRow(overrides: Partial<TripRow> = {}): TripRow {
  return {
    id: 1,
    title: 'Paris Trip',
    emoji: '🗼',
    status: 'planning',
    start_date: '2025-06-01',
    end_date: '2025-06-03',
    tags: '[]',
    notes: null,
    cover_gradient: 'warm-brown',
    distance_total_m: null,
    distance_synced_at: null,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeTripWithDays(overrides: Partial<TripRow> = {}, days: DayWithActivities[] = []): TripWithDays {
  return Object.assign(new Trip(makeTripRow(overrides)), { days });
}

function makeDay(date: string, title: string | null = null): DayWithActivities {
  return {
    id: 1,
    trip_id: 1,
    date,
    title,
    subtitle: null,
    notes: null,
    created_at: '2025-01-01T00:00:00.000Z',
    activities: [],
  };
}

function makeLodgingRow(overrides: Partial<ReservationRow> = {}): ReservationRow {
  return {
    id: 1,
    trip_id: 1,
    day_id: null,
    type: 'lodging',
    title: 'Hotel du Soleil',
    status: 'confirmed',
    confirmation_ref: null,
    notes: null,
    cost_amount: null,
    cost_currency: 'EUR',
    details: JSON.stringify({
      type: 'lodging',
      property_name: 'Hotel du Soleil',
      location: 'Paris',
      check_in_date: '2025-06-01',
      check_out_date: '2025-06-03',
      check_in_time: '15:00',
      check_out_time: '11:00',
    }),
    sort_order: 0,
    location: null,
    lat: null,
    lng: null,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ── formatModeLabel ───────────────────────────────────────────────────────────

describe('formatModeLabel()', () => {
  it.each([
    ['car',        'By car'],
    ['pedestrian', 'On foot'],
    ['bicycle',    'By bike'],
  ])('maps %s → %s', (mode, expected) => {
    expect(formatModeLabel(mode)).toBe(expected);
  });

  it('returns "Travel" for an unknown mode', () => {
    expect(formatModeLabel('boat')).toBe('Travel');
    expect(formatModeLabel('')).toBe('Travel');
  });
});

// ── buildLodgingStripText ─────────────────────────────────────────────────────
// Tested here via helpers.ts directly (not the re-export in pdf.tsx).

describe('buildLodgingStripText() via helpers', () => {
  const lodging = new Reservation(makeLodgingRow());

  it('returns check-in text with time on check-in date', () => {
    expect(buildLodgingStripText(lodging, '2025-06-01')).toBe('Check-in: Hotel du Soleil (15:00)');
  });

  it('returns staying text on an intermediate date', () => {
    expect(buildLodgingStripText(lodging, '2025-06-02')).toBe('Staying tonight: Hotel du Soleil');
  });

  it('returns check-out text with time on check-out date', () => {
    expect(buildLodgingStripText(lodging, '2025-06-03')).toBe('Check-out: Hotel du Soleil (11:00)');
  });

  it('returns null when the date is outside the lodging range', () => {
    expect(buildLodgingStripText(lodging, '2025-05-31')).toBeNull();
    expect(buildLodgingStripText(lodging, '2025-06-04')).toBeNull();
  });
});

// ── buildCoverViewModel ───────────────────────────────────────────────────────

describe('buildCoverViewModel()', () => {
  const generated = new Date('2026-05-05T10:00:00.000Z');

  it('maps tripTitle and emoji from the trip', () => {
    const trip = makeTripWithDays();
    const vm = buildCoverViewModel(trip, [], generated);
    expect(vm.tripTitle).toBe('Paris Trip');
    expect(vm.emoji).toBe('🗼');
  });

  it('computes durationLabel for a 3-day trip (Jun 1–3)', () => {
    const trip = makeTripWithDays();
    const vm = buildCoverViewModel(trip, [], generated);
    expect(vm.durationLabel).toBe('3 days');
  });

  it('uses "1 day" for a single-day trip', () => {
    const trip = makeTripWithDays({ start_date: '2025-06-01', end_date: '2025-06-01' });
    const vm = buildCoverViewModel(trip, [], generated);
    expect(vm.durationLabel).toBe('1 day');
  });

  it('sets status from the trip', () => {
    const trip = makeTripWithDays({ status: 'confirmed' });
    const vm = buildCoverViewModel(trip, [], generated);
    expect(vm.status).toBe('confirmed');
  });

  it('includes lodging summaries with the property name', () => {
    const trip = makeTripWithDays();
    const lodging = new Reservation(makeLodgingRow());
    const vm = buildCoverViewModel(trip, [lodging], generated);
    expect(vm.lodgings).toHaveLength(1);
    expect(vm.lodgings[0].name).toBe('Hotel du Soleil');
    expect(vm.lodgings[0].status).toBe('confirmed');
  });

  it('builds day summaries from trip.days', () => {
    const days = [
      makeDay('2025-06-01', 'Arrival'),
      makeDay('2025-06-02'),
      makeDay('2025-06-03', 'Departure'),
    ];
    const trip = makeTripWithDays({}, days);
    const vm = buildCoverViewModel(trip, [], generated);
    expect(vm.days).toHaveLength(3);
    expect(vm.days[0].dayNumber).toBe(1);
    expect(vm.days[0].title).toBe('Arrival');
    expect(vm.days[2].dayNumber).toBe(3);
  });

  it('reports activity and reservation counts', () => {
    const trip = makeTripWithDays();
    const lodging = new Reservation(makeLodgingRow());
    const vm = buildCoverViewModel(trip, [lodging], generated);
    expect(vm.stats.activitiesCount).toBe(0);
    expect(vm.stats.reservationsCount).toBe(1);
  });
});

// ── buildDayViewModel ─────────────────────────────────────────────────────────

describe('buildDayViewModel()', () => {
  it('sets dayNumber to dayIndex + 1', () => {
    const day = makeDay('2025-06-01');
    const vm = buildDayViewModel(day, [], [], 0, 3, 2, 4);
    expect(vm.dayNumber).toBe(1);
  });

  it('zero-pads dayNumberLabel', () => {
    const day = makeDay('2025-06-01');
    const vm = buildDayViewModel(day, [], [], 0, 3, 2, 4);
    expect(vm.dayNumberLabel).toBe('01');
  });

  it('formats dateLabel as full weekday+date string', () => {
    const day = makeDay('2025-06-01'); // Sunday
    const vm = buildDayViewModel(day, [], [], 0, 3, 2, 4);
    expect(vm.dateLabel).toBe('Sunday, 1 June 2025');
  });

  it('builds footerLabel correctly', () => {
    const day = makeDay('2025-06-01');
    const vm = buildDayViewModel(day, [], [], 0, 3, 2, 4);
    // \u00B7 is the middle dot character used as separator
    expect(vm.footerLabel).toBe('Day 1 of 3 \u00B7 Page 2 of 4');
  });

  it('sets hasContent=false when there are no activities or reservations', () => {
    const day = makeDay('2025-06-01');
    const vm = buildDayViewModel(day, [], [], 0, 3, 2, 4);
    expect(vm.hasContent).toBe(false);
  });

  it('sets title and subtitle from the day row', () => {
    const day = { ...makeDay('2025-06-01', 'Arrival'), subtitle: 'By train' };
    const vm = buildDayViewModel(day, [], [], 0, 3, 2, 4);
    expect(vm.title).toBe('Arrival');
    expect(vm.subtitle).toBe('By train');
  });

  it('sets noteText to null when day has no notes', () => {
    const day = makeDay('2025-06-01');
    const vm = buildDayViewModel(day, [], [], 0, 3, 2, 4);
    expect(vm.noteText).toBeNull();
  });

  it('sets legSummary to null when no legSummary is provided', () => {
    const day = makeDay('2025-06-01');
    const vm = buildDayViewModel(day, [], [], 0, 3, 2, 4);
    expect(vm.legSummary).toBeNull();
    expect(vm.legs).toHaveLength(0);
  });
});
