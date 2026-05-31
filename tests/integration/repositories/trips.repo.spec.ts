import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../helpers/db';
import type Database from 'better-sqlite3';

let db: Database.Database;

// Reason: vi.mock hoisting ensures the mock is set up before any tests import
// the repo module. We intercept getDb() to return our in-memory DB.
vi.mock('@/db/client', () => ({
  getDb: () => db,
}));

// Import repo AFTER mock is in place
const { findAllTrips, findTripById, findTripWithDays, createTrip, updateTrip, deleteTrip } = await import(
  '@/db/repositories/trips.repo'
);
const { syncDaysForTrip } = await import('@/services/days.service');

describe('trips repository', () => {
  beforeEach(() => {
    db = createTestDb();
  });

  describe('createTrip()', () => {
    it('inserts a trip and returns the row', () => {
      const trip = createTrip({
        title: 'Road Trip USA',
        start_date: '2025-07-01',
        end_date: '2025-07-15',
        emoji: '🚗',
        status: 'planning',
        tags: ['road', 'usa'],
        cover_gradient: 'sand',
      });

      expect(trip.id).toBeGreaterThan(0);
      expect(trip.title).toBe('Road Trip USA');
      expect(trip.tags).toEqual(['road', 'usa']);
      expect(trip.status).toBe('planning');
    });

    it('applies defaults', () => {
      const trip = createTrip({
        title: 'Minimal Trip',
        start_date: '2025-08-01',
        end_date: '2025-08-05',
      });
      expect(trip.emoji).toBe('🗺️');
      expect(trip.status).toBe('draft');
      expect(trip.cover_gradient).toBe('warm-brown');
    });
  });

  describe('findAllTrips()', () => {
    it('returns empty array when no trips', () => {
      expect(findAllTrips()).toEqual([]);
    });

    it('returns all trips with counts', () => {
      createTrip({ title: 'Trip A', start_date: '2025-06-01', end_date: '2025-06-05' });
      createTrip({ title: 'Trip B', start_date: '2025-07-01', end_date: '2025-07-10' });

      const trips = findAllTrips();
      expect(trips).toHaveLength(2);
      expect(trips[0]?.day_count).toBe(0);
      expect(trips[0]?.filled_day_count).toBe(0);
    });

    it('returns accurate day_count and filled_day_count after sync', () => {
      // Reason: validates the LEFT JOIN + GROUP BY — must produce correct counts.
      const trip = createTrip({ title: 'Counted', start_date: '2025-08-01', end_date: '2025-08-03' });
      syncDaysForTrip(trip.id, '2025-08-01', '2025-08-03'); // 3 days
      const [found] = findAllTrips().filter(t => t.id === trip.id);
      expect(found?.day_count).toBe(3);
      // No activities or reservations inserted yet
      expect(found?.filled_day_count).toBe(0);
    });

    it('orders by start_date ascending', () => {
      createTrip({ title: 'Later', start_date: '2025-09-01', end_date: '2025-09-05' });
      createTrip({ title: 'Earlier', start_date: '2025-06-01', end_date: '2025-06-05' });

      const trips = findAllTrips();
      expect(trips[0]?.title).toBe('Earlier');
      expect(trips[1]?.title).toBe('Later');
    });
  });

  describe('findTripById()', () => {
    it('returns the trip when found', () => {
      const created = createTrip({ title: 'Find Me', start_date: '2025-10-01', end_date: '2025-10-05' });
      const found = findTripById(created.id);
      expect(found).not.toBeNull();
      expect(found?.title).toBe('Find Me');
    });

    it('returns null when not found', () => {
      expect(findTripById(9999)).toBeNull();
    });
  });

  describe('updateTrip()', () => {
    it('updates specified fields', () => {
      const trip = createTrip({ title: 'Original', start_date: '2025-10-01', end_date: '2025-10-05' });
      const updated = updateTrip(trip.id, { title: 'Updated', status: 'confirmed' });
      expect(updated?.title).toBe('Updated');
      expect(updated?.status).toBe('confirmed');
    });

    it('returns null for non-existent trip', () => {
      expect(updateTrip(9999, { title: 'Ghost' })).toBeNull();
    });

    it('preserves unspecified fields', () => {
      const trip = createTrip({ title: 'Original', emoji: '🎯', start_date: '2025-10-01', end_date: '2025-10-05' });
      const updated = updateTrip(trip.id, { title: 'New Title' });
      expect(updated?.emoji).toBe('🎯');
    });
  });

  describe('deleteTrip()', () => {
    it('removes the trip', () => {
      const trip = createTrip({ title: 'Delete Me', start_date: '2025-10-01', end_date: '2025-10-05' });
      deleteTrip(trip.id);
      expect(findTripById(trip.id)).toBeNull();
    });

    it('is idempotent', () => {
      const trip = createTrip({ title: 'Delete Twice', start_date: '2025-10-01', end_date: '2025-10-05' });
      deleteTrip(trip.id);
      expect(() => deleteTrip(trip.id)).not.toThrow();
    });
  });

  describe('findTripWithDays()', () => {
    it('returns null for a non-existent trip', () => {
      expect(findTripWithDays(9999)).toBeNull();
    });

    it('returns trip with empty days array when no days are synced', () => {
      const trip = createTrip({ title: 'No Days', start_date: '2025-11-01', end_date: '2025-11-03' });
      const result = findTripWithDays(trip.id);
      expect(result).not.toBeNull();
      expect(result?.days).toEqual([]);
    });

    it('returns trip with correct number of days after sync', () => {
      const trip = createTrip({ title: 'With Days', start_date: '2025-11-01', end_date: '2025-11-05' });
      syncDaysForTrip(trip.id, '2025-11-01', '2025-11-05');
      const result = findTripWithDays(trip.id);
      expect(result?.days).toHaveLength(5);
    });

    it('returns days in ascending date order', () => {
      const trip = createTrip({ title: 'Ordered', start_date: '2025-12-01', end_date: '2025-12-03' });
      syncDaysForTrip(trip.id, '2025-12-01', '2025-12-03');
      const dates = findTripWithDays(trip.id)?.days.map(d => d.date) ?? [];
      expect(dates).toEqual([...dates].sort());
    });

    it('returns activities nested under their day', () => {
      const trip = createTrip({ title: 'Act Trip', start_date: '2025-12-10', end_date: '2025-12-12' });
      syncDaysForTrip(trip.id, '2025-12-10', '2025-12-12');
      const result = findTripWithDays(trip.id)!;
      const day = result.days[0]!;
      // Insert an activity directly via DB so we don't need the activities repo
      db.prepare(
        `INSERT INTO activities (trip_id, day_id, title, activity_type_id, sort_order) VALUES (?, ?, ?, ?, ?)`,
      ).run(trip.id, day.id, 'Museum', 5, 0);

      const refreshed = findTripWithDays(trip.id)!;
      expect(refreshed.days[0]?.activities).toHaveLength(1);
      expect(refreshed.days[0]?.activities[0]?.title).toBe('Museum');
    });

    it('returns empty activities array for days with no activities', () => {
      const trip = createTrip({ title: 'Empty Acts', start_date: '2025-12-20', end_date: '2025-12-22' });
      syncDaysForTrip(trip.id, '2025-12-20', '2025-12-22');
      const result = findTripWithDays(trip.id)!;
      for (const day of result.days) {
        expect(day.activities).toEqual([]);
      }
    });
  });
});
