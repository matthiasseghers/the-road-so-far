import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../helpers/db';
import type Database from 'better-sqlite3';

let db: Database.Database;

vi.mock('@/db/client', () => ({ getDb: () => db }));

const { findAllTrips, createTrip } = await import('@/db/repositories/trips.repo');
const { upsertDay }                 = await import('@/db/repositories/days.repo');
const { createActivity }            = await import('@/db/repositories/activities.repo');
const { createReservation }         = await import('@/db/repositories/reservations.repo');
const { findDaysByTripId }          = await import('@/db/repositories/days.repo');
const { findActivitiesByTripId }    = await import('@/db/repositories/activities.repo');
const { findAllByTripId }           = await import('@/db/repositories/reservations.repo');
const { findChecklistItemsByTripId, createChecklistItem } = await import('@/db/repositories/checklist.repo');

// ── helpers ───────────────────────────────────────────────────────────────────

function seedData(): { tripId: number; dayId: number } {
  const trip = createTrip({ title: 'Test Trip', start_date: '2025-06-01', end_date: '2025-06-03' });
  const day  = upsertDay({ trip_id: trip.id, date: '2025-06-01' });
  createActivity({ trip_id: trip.id, day_id: day.id, title: 'Museum', activity_type_id: 1 });
  createReservation({
    trip_id: trip.id,
    type: 'flight',
    title: 'Outbound flight',
    status: 'confirmed',
    details: { airline: 'BA', flight_number: 'BA001', depart_date: '2025-06-01', arrive_date: '2025-06-01' },
  });
  createChecklistItem({ trip_id: trip.id, label: 'Passport', category: 'Documents', checked: false, sort_order: 0 });
  return { tripId: trip.id, dayId: day.id };
}

// ── export/all logic ──────────────────────────────────────────────────────────

describe('export/all logic', () => {
  beforeEach(() => { db = createTestDb(); });

  it('returns all entities in the expected shape', () => {
    const { tripId } = seedData();

    // Replicate what GET /export/all does server-side
    const trips        = findAllTrips();
    const allDays      = trips.flatMap(t => findDaysByTripId(t.id));
    const allActivities = trips.flatMap(t => findActivitiesByTripId(t.id));
    const allReservations = trips.flatMap(t => findAllByTripId(t.id));
    const allChecklistItems = trips.flatMap(t => findChecklistItemsByTripId(t.id));

    const payload = { exportedAt: new Date().toISOString(), trips, days: allDays, activities: allActivities, reservations: allReservations, checklistItems: allChecklistItems };

    expect(trips).toHaveLength(1);
    expect(trips[0]!.id).toBe(tripId);
    expect(allDays).toHaveLength(1);
    expect(allActivities).toHaveLength(1);
    expect(allReservations).toHaveLength(1);
    expect(allChecklistItems).toHaveLength(1);
    expect(typeof payload.exportedAt).toBe('string');
  });

  it('returns empty arrays when no trips exist', () => {
    const trips = findAllTrips();
    expect(trips).toHaveLength(0);
  });
});

// ── data/wipe logic ───────────────────────────────────────────────────────────

describe('data/wipe logic', () => {
  beforeEach(() => { db = createTestDb(); });

  it('leaves all tables empty after wipe', () => {
    seedData();

    // Replicate what DELETE /data/wipe does server-side
    db.transaction(() => {
      db.prepare('DELETE FROM checklist_items').run();
      db.prepare('DELETE FROM activities').run();
      db.prepare('DELETE FROM reservations').run();
      db.prepare('DELETE FROM days').run();
      db.prepare('DELETE FROM trips').run();
    })();

    expect((db.prepare('SELECT COUNT(*) AS n FROM trips').get() as { n: number }).n).toBe(0);
    expect((db.prepare('SELECT COUNT(*) AS n FROM days').get() as { n: number }).n).toBe(0);
    expect((db.prepare('SELECT COUNT(*) AS n FROM activities').get() as { n: number }).n).toBe(0);
    expect((db.prepare('SELECT COUNT(*) AS n FROM reservations').get() as { n: number }).n).toBe(0);
    expect((db.prepare('SELECT COUNT(*) AS n FROM checklist_items').get() as { n: number }).n).toBe(0);
  });
});
