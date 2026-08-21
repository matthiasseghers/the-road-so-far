import { describe, it, expect } from 'vitest';
import { buildMapData } from '@/utils/mapData';
import type { ActivityRow, ReservationRow, DayRow } from '@/types/db';

// Minimal factories
function day(id: number, date: string, activities: ActivityRow[] = []): DayRow & { activities: ActivityRow[] } {
  return { id, trip_id: 1, date, title: null, subtitle: null, notes: null, created_at: '', activities };
}

function activity(id: number, day_id: number, lat: number | null, lng: number | null, title = 'Act'): ActivityRow {
  return {
    id, day_id, trip_id: 1, title, activity_type: 'attraction', activity_type_icon: 'camera', activity_type_id: 1,
    start_time: '09:00', end_time: '11:00',
    sort_order: 0, notes: null,
    location: lat !== null ? 'Somewhere' : null,
    lat, lng,
    created_at: '', updated_at: '',
  };
}

function reservation(id: number, day_id: number | null, type: ReservationRow['type'], lat: number | null, lng: number | null, checkIn = '2025-06-10'): ReservationRow {
  return {
    id, trip_id: 1, day_id, type, title: 'Res', status: 'confirmed',
    confirmation_ref: null, notes: null, cost_amount: null, cost_currency: 'EUR',
    details: JSON.stringify({ type, check_in_date: checkIn, check_out_date: '2025-06-12', property_name: 'H', location: 'P' }),
    sort_order: 0, location: lat !== null ? 'Somewhere' : null, lat, lng,
    created_at: '', updated_at: '',
  };
}

describe('useMapData — pure buildMapData logic', () => {
  it('excludes items without lat/lng', () => {
    const days = [day(1, '2025-06-10', [activity(1, 1, null, null), activity(2, 1, 48.8, 2.35)])];
    const { pins } = buildMapData(days, []);
    expect(pins).toHaveLength(1);
    expect(pins[0].id).toBe('activity-2');
  });

  it('lodging reservation type resolves to lodging PinType', () => {
    const days = [day(1, '2025-06-10')];
    const res = reservation(7, 1, 'lodging', 48.8, 2.35);
    const { pins } = buildMapData(days, [res]);
    expect(pins[0].type).toBe('lodging');
  });

  it('lodgingRoute contains only lodging pins sorted by check_in_date', () => {
    const days = [day(1, '2025-06-10')];
    const r1 = reservation(1, null, 'lodging', 51.5, -0.1, '2025-06-13');
    const r2 = reservation(2, null, 'lodging', 48.8, 2.35, '2025-06-10');
    const r3 = reservation(3, null, 'flight',  40.4, -3.7, '2025-06-10'); // flight — not in route
    const { lodgingRoute } = buildMapData(days, [r1, r2, r3]);
    expect(lodgingRoute).toHaveLength(2);
    expect(lodgingRoute[0]).toEqual({ lat: 48.8, lng: 2.35 }); // earlier check_in_date first
    expect(lodgingRoute[1]).toEqual({ lat: 51.5, lng: -0.1 });
  });

  it('mapDays has correct pinCount and hasLodging', () => {
    const act = activity(1, 1, 48.8, 2.35);
    const days = [day(1, '2025-06-10', [act])];
    const res = reservation(1, 1, 'lodging', 51.5, -0.1);
    const { mapDays } = buildMapData(days, [res]);
    expect(mapDays[0].pinCount).toBe(2); // 1 activity + 1 reservation
    expect(mapDays[0].hasLodging).toBe(true);
  });
});
