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

  describe('timeDisplay()', () => {
    it('returns empty string when both times are null', () => {
      const a = new Activity(makeRow({ start_time: null, end_time: null }));
      expect(a.timeDisplay()).toBe('');
    });

    it('returns only start_time when end_time is null', () => {
      const a = new Activity(makeRow({ start_time: '09:00', end_time: null }));
      expect(a.timeDisplay()).toBe('09:00');
    });

    it('returns start – end when both are set', () => {
      const a = new Activity(makeRow({ start_time: '09:00', end_time: '10:30' }));
      expect(a.timeDisplay()).toBe('09:00 – 10:30');
    });

    it('returns empty string when start_time is null (end_time has no start)', () => {
      // end_time without start_time should not display anything useful
      const a = new Activity(makeRow({ start_time: null, end_time: '10:30' }));
      expect(a.timeDisplay()).toBe('');
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
