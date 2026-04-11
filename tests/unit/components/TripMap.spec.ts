import { describe, it, expect } from 'vitest';
import { buildMapData, countDaysMissingLocations, TYPE_COLORS } from '@/components/map/mapDataUtils';
import type { ActivityRow, ReservationRow, DayRow } from '@/types/db';

// ── Factories ─────────────────────────────────────────────────────────────────

function makeDay(overrides: Partial<DayRow> = {}): DayRow & { activities: ActivityRow[] } {
  return {
    id: 1,
    trip_id: 1,
    date: '2025-06-10',
    title: null,
    subtitle: null,
    notes: null,
    created_at: '2025-01-01T00:00:00Z',
    activities: [],
    ...overrides,
  };
}

function makeActivity(overrides: Partial<ActivityRow> = {}): ActivityRow {
  return {
    id: 1,
    day_id: 1,
    trip_id: 1,
    title: 'Test Activity',
    activity_type: 'attraction',
    start_time: null,
    end_time: null,
    sort_order: 0,
    notes: null,
    location: null,
    lat: null,
    lng: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeReservation(overrides: Partial<ReservationRow> = {}): ReservationRow {
  return {
    id: 1,
    trip_id: 1,
    day_id: 1,
    type: 'lodging',
    title: 'Hotel',
    status: 'confirmed',
    confirmation_ref: null,
    notes: null,
    cost_amount: null,
    cost_currency: 'EUR',
    details: JSON.stringify({ type: 'lodging', property_name: 'Hotel', location: 'Paris', check_in_date: '2025-06-10', check_out_date: '2025-06-12' }),
    sort_order: 0,
    location: null,
    lat: null,
    lng: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── buildMapData ──────────────────────────────────────────────────────────────

describe('buildMapData()', () => {
  it('returns empty pins when no activities or reservations have coords', () => {
    const days = [makeDay({ activities: [makeActivity()] })];
    const { pins } = buildMapData(days, []);
    expect(pins).toHaveLength(0);
  });

  it('excludes items without lat/lng', () => {
    const days = [makeDay({
      activities: [
        makeActivity({ id: 1, lat: 48.8566, lng: 2.3522 }),
        makeActivity({ id: 2, lat: null, lng: null }),
      ],
    })];
    const { pins } = buildMapData(days, []);
    expect(pins).toHaveLength(1);
    expect(pins[0].id).toBe('activity-1');
  });

  it('maps reservation type to correct PinType (lodging → lodging)', () => {
    const days = [makeDay({ id: 10, date: '2025-06-10', activities: [] })];
    const res = makeReservation({ id: 5, day_id: 10, type: 'lodging', lat: 48.8566, lng: 2.3522 });
    const { pins } = buildMapData(days, [res]);
    expect(pins[0].type).toBe('lodging');
    expect(pins[0].color).toBe(TYPE_COLORS.lodging);
  });

  it('maps train/bus/ferry to transit PinType', () => {
    const days = [makeDay({ id: 10, date: '2025-06-10', activities: [] })];
    for (const resType of ['train', 'bus', 'ferry'] as const) {
      const res = makeReservation({ id: 1, day_id: 10, type: resType, lat: 48, lng: 2,
        details: JSON.stringify({ type: resType, from_stop: 'A', from_date: '2025-06-10', to_stop: 'B', to_date: '2025-06-10' }) });
      const { pins } = buildMapData(days, [res]);
      expect(pins[0].type).toBe('transit');
    }
  });

  it('lodgingRoute contains only lodging pins (with coords) in check-in date order', () => {
    const days = [makeDay({ id: 10, activities: [] }), makeDay({ id: 11, date: '2025-06-11', activities: [] })];
    const lodging1 = makeReservation({
      id: 1, day_id: null, type: 'lodging', lat: 48.8, lng: 2.3,
      details: JSON.stringify({ type: 'lodging', property_name: 'A', location: 'Paris', check_in_date: '2025-06-12', check_out_date: '2025-06-14' }),
    });
    const lodging2 = makeReservation({
      id: 2, day_id: null, type: 'lodging', lat: 51.5, lng: -0.1,
      details: JSON.stringify({ type: 'lodging', property_name: 'B', location: 'London', check_in_date: '2025-06-10', check_out_date: '2025-06-12' }),
    });
    const { lodgingRoute } = buildMapData(days, [lodging1, lodging2]);
    expect(lodgingRoute).toHaveLength(2);
    // London (check_in_date 06-10) should come first
    expect(lodgingRoute[0]).toEqual({ lat: 51.5, lng: -0.1 });
    expect(lodgingRoute[1]).toEqual({ lat: 48.8, lng: 2.3 });
  });
});

describe('countDaysMissingLocations()', () => {
  it('counts days with no geocoded activity or reservation pins', () => {
    const days = [
      makeDay({ id: 1, activities: [makeActivity({ lat: 48, lng: 2 })] }),  // has pin
      makeDay({ id: 2, date: '2025-06-11', activities: [] }),               // missing
    ];
    expect(countDaysMissingLocations(days, [])).toBe(1);
  });
});
