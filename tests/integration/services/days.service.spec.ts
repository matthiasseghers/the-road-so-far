import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../helpers/db';
import type Database from 'better-sqlite3';
import type { DayRow } from '@/types/db';

let db: Database.Database;

vi.mock('@/db/client', () => ({
  getDb: () => db,
}));

const { syncDaysForTrip } = await import('@/services/days.service');
const { createTrip } = await import('@/db/repositories/trips.repo');

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDays(tripId: number): DayRow[] {
  return db
    .prepare('SELECT * FROM days WHERE trip_id = ? ORDER BY date ASC')
    .all(tripId) as DayRow[];
}

function makeTrip() {
  return createTrip({ title: 'Sync Test Trip', start_date: '2025-07-01', end_date: '2025-07-10' });
}

// ── syncDaysForTrip ───────────────────────────────────────────────────────────

describe('syncDaysForTrip()', () => {
  beforeEach(() => {
    db = createTestDb();
  });

  it('creates one day per date in the range (inclusive)', () => {
    const trip = makeTrip();
    const days = syncDaysForTrip(trip.id, '2025-07-01', '2025-07-05');
    expect(days).toHaveLength(5);
    expect(days[0]?.date).toBe('2025-07-01');
    expect(days[4]?.date).toBe('2025-07-05');
  });

  it('creates a single day when start equals end', () => {
    const trip = makeTrip();
    const days = syncDaysForTrip(trip.id, '2025-07-01', '2025-07-01');
    expect(days).toHaveLength(1);
    expect(days[0]?.date).toBe('2025-07-01');
  });

  it('returns rows ordered by date ascending', () => {
    const trip = makeTrip();
    const days = syncDaysForTrip(trip.id, '2025-07-03', '2025-07-07');
    const dates = days.map(d => d.date);
    expect(dates).toEqual([...dates].sort());
  });

  it('does not duplicate days on a second sync with the same range', () => {
    const trip = makeTrip();
    syncDaysForTrip(trip.id, '2025-07-01', '2025-07-05');
    syncDaysForTrip(trip.id, '2025-07-01', '2025-07-05');
    expect(getDays(trip.id)).toHaveLength(5);
  });

  it('adds new days when the range is extended', () => {
    const trip = makeTrip();
    syncDaysForTrip(trip.id, '2025-07-01', '2025-07-05');
    const days = syncDaysForTrip(trip.id, '2025-07-01', '2025-07-10');
    expect(days).toHaveLength(10);
  });

  it('removes days that fall outside the new range', () => {
    const trip = makeTrip();
    syncDaysForTrip(trip.id, '2025-07-01', '2025-07-10');
    const days = syncDaysForTrip(trip.id, '2025-07-05', '2025-07-08');
    const dates = days.map(d => d.date);
    expect(dates).toEqual(['2025-07-05', '2025-07-06', '2025-07-07', '2025-07-08']);
  });

  it('preserves day rows whose dates remain in range', () => {
    const trip = makeTrip();
    const initial = syncDaysForTrip(trip.id, '2025-07-01', '2025-07-05');
    const keepId = initial.find(d => d.date === '2025-07-03')?.id;
    const updated = syncDaysForTrip(trip.id, '2025-07-03', '2025-07-05');
    const preservedId = updated.find(d => d.date === '2025-07-03')?.id;
    // Reason: the row id must remain the same — existing annotations/activities
    // on in-range days must not be lost on a range shrink.
    expect(preservedId).toBe(keepId);
  });

  it('does not affect days belonging to other trips', () => {
    const tripA = makeTrip();
    const tripB = makeTrip();
    syncDaysForTrip(tripA.id, '2025-07-01', '2025-07-05');
    syncDaysForTrip(tripB.id, '2025-07-01', '2025-07-05');
    // Shrink only trip A
    syncDaysForTrip(tripA.id, '2025-07-03', '2025-07-05');
    expect(getDays(tripB.id)).toHaveLength(5);
  });

  it('returns an empty array for a zero-day range (start after end)', () => {
    const trip = makeTrip();
    // eachDayInRange returns [] when start > end — sync should be a no-op
    const days = syncDaysForTrip(trip.id, '2025-07-10', '2025-07-01');
    expect(days).toHaveLength(0);
  });
});
