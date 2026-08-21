// Tests for pure helper functions in src/lib/export/helpers.ts
// and view-model builders in src/lib/export/pdf.viewmodel.ts.
//
// Reason: helpers.ts has zero @react-pdf/renderer imports — it is pure
// TypeScript. No mock is needed; these tests run in the standard node
// environment without any renderer setup.

import { describe, it, expect } from 'vitest';
import { formatModeLabel, buildLodgingStripText } from '@/lib/export/pdf/helpers';
import { buildCoverViewModel, buildDayViewModel, buildReservationViewModel } from '@/lib/export/pdf/pdf.viewmodel';
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

// ── buildReservationViewModel ─────────────────────────────────────────────────

function makeResRow(overrides: Partial<ReservationRow> = {}): ReservationRow {
  return {
    id: 1, trip_id: 1, day_id: 1, type: 'other', title: 'Test',
    status: 'confirmed', confirmation_ref: null, notes: null,
    cost_amount: null, cost_currency: 'EUR',
    details: JSON.stringify({}),
    sort_order: 0, location: null, lat: null, lng: null,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildReservationViewModel()', () => {
  describe('flight', () => {
    const res = new Reservation(makeResRow({
      type: 'flight',
      details: JSON.stringify({
        airline: 'British Airways', flight_number: 'BA123',
        depart_airport: 'LHR', arrive_airport: 'CDG',
        depart_date: '2025-06-01', depart_time: '10:30',
        arrive_date: '2025-06-01', arrive_time: '13:00',
      }),
    }));
    const vm = buildReservationViewModel(res);

    it('sets timeLabel to depart_time', () => {
      expect(vm.timeLabel).toBe('10:30');
    });
    it('includes airline and flight number', () => {
      expect(vm.detailLines[0]).toBe('British Airways BA123');
    });
    it('includes airport route', () => {
      expect(vm.detailLines[1]).toContain('LHR');
      expect(vm.detailLines[1]).toContain('CDG');
    });
    it('includes formatted departure date and time', () => {
      expect(vm.detailLines[2]).toMatch(/Dep: 1 Jun 2025 10:30/);
    });
    it('includes formatted arrival date and time', () => {
      expect(vm.detailLines[3]).toMatch(/Arr: 1 Jun 2025 13:00/);
    });
  });

  describe('lodging', () => {
    const res = new Reservation(makeResRow({
      type: 'lodging',
      details: JSON.stringify({
        property_name: 'Hotel Lumière',
        check_in_date: '2025-06-01', check_in_time: '15:00',
        check_out_date: '2025-06-04', check_out_time: '11:00',
      }),
    }));
    const vm = buildReservationViewModel(res);

    it('sets timeLabel to check_in_time', () => {
      expect(vm.timeLabel).toBe('15:00');
    });
    it('includes check-in line with date and time', () => {
      expect(vm.detailLines[0]).toBe('Check-in: 1 Jun 2025 15:00');
    });
    it('includes check-out line with date and time', () => {
      expect(vm.detailLines[1]).toBe('Check-out: 4 Jun 2025 11:00');
    });
  });

  describe('train', () => {
    const res = new Reservation(makeResRow({
      type: 'train',
      details: JSON.stringify({
        from_stop: 'Paris Gare de Lyon', to_stop: 'Lyon Part-Dieu',
        from_date: '2025-06-02', from_time: '08:15',
        to_date: '2025-06-02', to_time: '10:00',
        carrier: 'SNCF',
      }),
    }));
    const vm = buildReservationViewModel(res);

    it('sets timeLabel to from_time', () => {
      expect(vm.timeLabel).toBe('08:15');
    });
    it('includes route as first line', () => {
      expect(vm.detailLines[0]).toContain('Paris Gare de Lyon');
      expect(vm.detailLines[0]).toContain('Lyon Part-Dieu');
    });
    it('includes carrier', () => {
      expect(vm.detailLines[1]).toBe('SNCF');
    });
    it('includes dep/arr lines', () => {
      expect(vm.detailLines[2]).toMatch(/Dep:/);
      expect(vm.detailLines[3]).toMatch(/Arr:/);
    });
  });

  describe('rental_car', () => {
    const res = new Reservation(makeResRow({
      type: 'rental_car',
      details: JSON.stringify({
        company: 'Hertz', vehicle_type: 'SUV',
        pickup_location: 'CDG Terminal 2', pickup_date: '2025-06-01', pickup_time: '09:00',
        dropoff_location: 'CDG Terminal 2', dropoff_date: '2025-06-07', dropoff_time: '18:00',
      }),
    }));
    const vm = buildReservationViewModel(res);

    it('sets timeLabel to pickup_time', () => {
      expect(vm.timeLabel).toBe('09:00');
    });
    it('includes company and vehicle type', () => {
      expect(vm.detailLines[0]).toBe('Hertz \u00B7 SUV');
    });
    it('includes pick-up line with location and date', () => {
      expect(vm.detailLines[1]).toContain('CDG Terminal 2');
      expect(vm.detailLines[1]).toContain('1 Jun 2025');
    });
    it('includes drop-off line with location and date', () => {
      expect(vm.detailLines[2]).toContain('CDG Terminal 2');
      expect(vm.detailLines[2]).toContain('7 Jun 2025');
    });
  });

  describe('restaurant', () => {
    const res = new Reservation(makeResRow({
      type: 'restaurant',
      details: JSON.stringify({
        restaurant_name: 'Le Petit Bistro', location: '12 Rue de Rivoli',
        date: '2025-06-03', time: '20:00', party_size: 4,
      }),
    }));
    const vm = buildReservationViewModel(res);

    it('sets timeLabel to reservation time', () => {
      expect(vm.timeLabel).toBe('20:00');
    });
    it('includes location', () => {
      expect(vm.detailLines[0]).toBe('12 Rue de Rivoli');
    });
    it('includes date at time', () => {
      expect(vm.detailLines[1]).toBe('3 Jun 2025 at 20:00');
    });
    it('includes party size', () => {
      expect(vm.detailLines[2]).toBe('Party of 4');
    });
  });

  describe('other', () => {
    it('puts description in detailLines', () => {
      const res = new Reservation(makeResRow({
        type: 'other',
        details: JSON.stringify({ description: 'Visa appointment' }),
      }));
      expect(buildReservationViewModel(res).detailLines).toEqual(['Visa appointment']);
    });
    it('returns empty detailLines when description is absent', () => {
      const res = new Reservation(makeResRow({ type: 'other', details: JSON.stringify({}) }));
      expect(buildReservationViewModel(res).detailLines).toEqual([]);
    });
    it('sets timeLabel to null', () => {
      const res = new Reservation(makeResRow({ type: 'other', details: JSON.stringify({}) }));
      expect(buildReservationViewModel(res).timeLabel).toBeNull();
    });
  });

  describe('bus and ferry (same shape as train)', () => {
    it.each(['bus', 'ferry'] as const)('%s: sets timeLabel and route correctly', (type) => {
      const res = new Reservation(makeResRow({
        type,
        details: JSON.stringify({
          from_stop: 'Nice', to_stop: 'Monaco',
          from_date: '2025-07-01', from_time: '10:00',
          to_date: '2025-07-01', to_time: '10:45',
        }),
      }));
      const vm = buildReservationViewModel(res);
      expect(vm.timeLabel).toBe('10:00');
      expect(vm.detailLines[0]).toContain('Nice');
      expect(vm.detailLines[0]).toContain('Monaco');
    });
  });
});
