import { describe, it, expect } from 'vitest';
import { Activity } from '@/domain/Activity';
import type { ActivityRow } from '@/types/db';

function makeRow(overrides: Partial<ActivityRow> = {}): ActivityRow {
  return {
    id: 1,
    day_id: 1,
    trip_id: 1,
    title: 'Visit the Eiffel Tower',
    activity_type: 'attraction',
    activity_type_icon: 'camera',
    activity_type_id: 1,
    sort_order: 0,
    start_time: null,
    end_time: null,
    notes: null,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Activity domain class', () => {
  describe('hasTime()', () => {
    it('returns false when start_time is null', () => {
      const a = new Activity(makeRow({ start_time: null }));
      expect(a.hasTime()).toBe(false);
    });

    it('returns true when start_time is set', () => {
      const a = new Activity(makeRow({ start_time: '09:00' }));
      expect(a.hasTime()).toBe(true);
    });
  });

  describe('isGeocoded()', () => {
    it('returns true when both lat and lng are set', () => {
      const a = new Activity(makeRow({ lat: 48.8566, lng: 2.3522 }));
      expect(a.isGeocoded()).toBe(true);
    });

    it('returns false when lat is null', () => {
      const a = new Activity(makeRow({ lat: null, lng: 2.3522 }));
      expect(a.isGeocoded()).toBe(false);
    });

    it('returns false when lng is null', () => {
      const a = new Activity(makeRow({ lat: 48.8566, lng: null }));
      expect(a.isGeocoded()).toBe(false);
    });

    it('returns false when both lat and lng are null', () => {
      const a = new Activity(makeRow({ lat: null, lng: null }));
      expect(a.isGeocoded()).toBe(false);
    });
  });

  describe('basic getters', () => {
    it('returns correct id', () => {
      const a = new Activity(makeRow({ id: 42 }));
      expect(a.id).toBe(42);
    });

    it('returns correct title', () => {
      const a = new Activity(makeRow({ title: 'Louvre' }));
      expect(a.title).toBe('Louvre');
    });

    it('returns correct activity_type', () => {
      const a = new Activity(makeRow({ activity_type: 'food' }));
      expect(a.activity_type).toBe('food');
    });

    it('day_id can be null', () => {
      const a = new Activity(makeRow({ day_id: null }));
      expect(a.day_id).toBeNull();
    });
  });
});
