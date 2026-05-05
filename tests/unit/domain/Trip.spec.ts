import { describe, it, expect } from 'vitest';
import { Trip } from '@/domain/Trip';
import type { TripRow } from '@/types/db';

function makeRow(overrides: Partial<TripRow> = {}): TripRow {
  return {
    id: 1,
    title: 'Test Trip',
    emoji: '🏖️',
    status: 'planning',
    start_date: '2025-06-01',
    end_date: '2025-06-10',
    tags: '["beach","sun"]',
    notes: null,
    cover_gradient: 'cool-blue',
    distance_total_m: null,
    distance_synced_at: null,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeTrip(overrides: Partial<TripRow> = {}): Trip {
  return new Trip(makeRow(overrides));
}

describe('Trip domain class', () => {
  describe('tags getter', () => {
    it('parses JSON string from SQLite', () => {
      const trip = makeTrip({ tags: '["beach","sun"]' });
      expect(trip.tags).toEqual(['beach', 'sun']);
    });

    it('returns array as-is when already parsed', () => {
      const trip = new Trip({ ...makeRow(), tags: ['beach'] });
      expect(trip.tags).toEqual(['beach']);
    });

    it('returns empty array for empty JSON', () => {
      const trip = makeTrip({ tags: '[]' });
      expect(trip.tags).toEqual([]);
    });
  });

  describe('isOngoing()', () => {
    it('returns false when no start_date', () => {
      const trip = makeTrip({ start_date: null });
      expect(trip.isOngoing()).toBe(false);
    });

    it('returns false when no end_date', () => {
      const trip = makeTrip({ end_date: null });
      expect(trip.isOngoing()).toBe(false);
    });

    it('returns true when today is within range', () => {
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      const tomorrow  = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      const trip = makeTrip({ start_date: yesterday, end_date: tomorrow });
      expect(trip.isOngoing()).toBe(true);
    });

    it('returns false for a future trip', () => {
      const trip = makeTrip({ start_date: '2099-01-01', end_date: '2099-01-10' });
      expect(trip.isOngoing()).toBe(false);
    });

    it('returns false for a past trip', () => {
      const trip = makeTrip({ start_date: '2000-01-01', end_date: '2000-01-10' });
      expect(trip.isOngoing()).toBe(false);
    });
  });

  describe('isUpcoming()', () => {
    it('returns true for a future trip', () => {
      const trip = makeTrip({ start_date: '2099-01-01' });
      expect(trip.isUpcoming()).toBe(true);
    });

    it('returns false for ongoing trip', () => {
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      const tomorrow  = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      const trip = makeTrip({ start_date: yesterday, end_date: tomorrow });
      expect(trip.isUpcoming()).toBe(false);
    });

    it('returns false when no start_date', () => {
      const trip = makeTrip({ start_date: null });
      expect(trip.isUpcoming()).toBe(false);
    });
  });

  describe('isPast()', () => {
    it('returns true for past trip', () => {
      const trip = makeTrip({ start_date: '2000-01-01', end_date: '2000-01-10' });
      expect(trip.isPast()).toBe(true);
    });

    it('returns true for archived trip regardless of dates', () => {
      const trip = makeTrip({ status: 'archived', start_date: '2099-01-01', end_date: '2099-01-10' });
      expect(trip.isPast()).toBe(true);
    });

    it('returns false for future trip', () => {
      const trip = makeTrip({ start_date: '2099-01-01', end_date: '2099-12-31' });
      expect(trip.isPast()).toBe(false);
    });

    it('returns false when no end_date', () => {
      const trip = makeTrip({ end_date: null });
      expect(trip.isPast()).toBe(false);
    });
  });

  describe('overlapsWith()', () => {
    it('returns true for overlapping trips', () => {
      const a = makeTrip({ start_date: '2025-06-01', end_date: '2025-06-10' });
      const b = makeTrip({ start_date: '2025-06-08', end_date: '2025-06-20' });
      expect(a.overlapsWith(b)).toBe(true);
    });

    it('returns false for non-overlapping trips', () => {
      const a = makeTrip({ start_date: '2025-06-01', end_date: '2025-06-10' });
      const b = makeTrip({ start_date: '2025-06-11', end_date: '2025-06-20' });
      expect(a.overlapsWith(b)).toBe(false);
    });

    it('returns false when dates are null', () => {
      const a = makeTrip({ start_date: null });
      const b = makeTrip({ start_date: '2025-06-01', end_date: '2025-06-10' });
      expect(a.overlapsWith(b)).toBe(false);
    });

    it('returns false when the other trip has no end_date', () => {
      const a = makeTrip({ start_date: '2025-06-01', end_date: '2025-06-10' });
      const b = makeTrip({ end_date: null });
      expect(a.overlapsWith(b)).toBe(false);
    });

    it('returns true when end of one trip equals start of the other (same-day boundary)', () => {
      // Reason: dateRangesOverlap uses inclusive bounds, so touching dates overlap.
      // This test documents that behaviour explicitly.
      const a = makeTrip({ start_date: '2025-06-01', end_date: '2025-06-10' });
      const b = makeTrip({ start_date: '2025-06-10', end_date: '2025-06-20' });
      expect(a.overlapsWith(b)).toBe(true);
    });
  });

  describe('computeProgress()', () => {
    it('returns 100 for completed trips', () => {
      const trip = makeTrip({ status: 'completed' });
      expect(new Trip({ ...makeRow({ status: 'completed' }), day_count: 5, activity_count: 1 }).computeProgress()).toBe(100);
    });

    it('returns 100 for archived trips', () => {
      const trip = new Trip({ ...makeRow({ status: 'archived' }), day_count: 5 });
      expect(trip.computeProgress()).toBe(100);
    });

    it('returns 0 when there are no activities (but days exist)', () => {
      const trip = new Trip({ ...makeRow(), day_count: 5, activity_count: 0 });
      expect(trip.computeProgress()).toBe(0);
    });

    it('returns 0 when no days', () => {
      const trip = new Trip({ ...makeRow(), day_count: 0, activity_count: 5 });
      expect(trip.computeProgress()).toBe(0);
    });

    it('calculates percentage correctly', () => {
      const trip = new Trip({ ...makeRow(), day_count: 4, activity_count: 2 });
      expect(trip.computeProgress()).toBe(50);
    });

    it('caps at 100 even with many activities', () => {
      const trip = new Trip({ ...makeRow(), day_count: 2, activity_count: 10 });
      expect(trip.computeProgress()).toBe(100);
    });
  });

  describe('durationDays()', () => {
    it('calculates correct number of days', () => {
      const trip = makeTrip({ start_date: '2025-06-01', end_date: '2025-06-10' });
      expect(trip.durationDays()).toBe(10);
    });

    it('returns 1 for single-day trip', () => {
      const trip = makeTrip({ start_date: '2025-06-01', end_date: '2025-06-01' });
      expect(trip.durationDays()).toBe(1);
    });

    it('returns 0 when dates are missing', () => {
      const trip = makeTrip({ start_date: null, end_date: null });
      expect(trip.durationDays()).toBe(0);
    });
  });

  describe('field getters', () => {
    it('exposes all TripRow scalar fields', () => {
      const trip = makeTrip();
      expect(trip.id).toBe(1);
      expect(trip.title).toBe('Test Trip');
      expect(trip.emoji).toBe('🏖️');
      expect(trip.status).toBe('planning');
      expect(trip.cover_gradient).toBe('cool-blue');
      expect(trip.notes).toBeNull();
    });
  });
});
