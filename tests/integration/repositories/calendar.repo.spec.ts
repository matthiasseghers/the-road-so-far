import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../helpers/db';
import type Database from 'better-sqlite3';

let db: Database.Database;

vi.mock('@/db/client', () => ({ getDb: () => db }));

const { getDaysForTrip } = await import('@/db/repositories/calendar.repo');

// ── Test data helpers ─────────────────────────────────────────────────────────

function insertTrip(db: Database.Database, overrides: Partial<{ title: string; start_date: string; end_date: string }> = {}): number {
  const info = db.prepare(
    `INSERT INTO trips (title, start_date, end_date) VALUES (?, ?, ?)`,
  ).run(
    overrides.title ?? 'Test Trip',
    overrides.start_date ?? '2025-06-01',
    overrides.end_date ?? '2025-06-05',
  );
  return info.lastInsertRowid as number;
}

function insertDay(db: Database.Database, tripId: number, date: string, subtitle?: string): number {
  const info = db.prepare(
    `INSERT INTO days (trip_id, date, subtitle) VALUES (?, ?, ?)`,
  ).run(tripId, date, subtitle ?? null);
  return info.lastInsertRowid as number;
}

function insertActivity(db: Database.Database, tripId: number, dayId: number, title = 'Act'): void {
  db.prepare(
    `INSERT INTO activities (trip_id, day_id, title, activity_type) VALUES (?, ?, ?, 'other')`,
  ).run(tripId, dayId, title);
}

function insertReservation(db: Database.Database, tripId: number, dayId: number, type: string): void {
  db.prepare(
    `INSERT INTO reservations (trip_id, day_id, type, title, details) VALUES (?, ?, ?, 'Res', '{}')`,
  ).run(tripId, dayId, type);
}

// Reason: lodging has day_id = NULL; it is matched by check_in_date..check_out_date
// in the JSON details column. check_out_date is inclusive.
function insertLodging(
  db: Database.Database,
  tripId: number,
  checkInDate: string,
  checkOutDate: string,
  title = 'Hotel',
): void {
  const details = JSON.stringify({ type: 'lodging', check_in_date: checkInDate, check_out_date: checkOutDate, property_name: title, location: 'City' });
  db.prepare(
    `INSERT INTO reservations (trip_id, day_id, type, title, details) VALUES (?, NULL, 'lodging', ?, ?)`,
  ).run(tripId, title, details);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('calendar.repo — getDaysForTrip', () => {
  beforeEach(() => {
    db = createTestDb();
  });

  it('returns empty array for a trip with no days', () => {
    const tripId = insertTrip(db);
    expect(getDaysForTrip(tripId)).toEqual([]);
  });

  it('assigns sequential day_number starting at 1', () => {
    const tripId = insertTrip(db);
    insertDay(db, tripId, '2025-06-01');
    insertDay(db, tripId, '2025-06-02');
    insertDay(db, tripId, '2025-06-03');

    const days = getDaysForTrip(tripId);
    expect(days.map(d => d.day_number)).toEqual([1, 2, 3]);
  });

  it('derives status "empty" when day has no activities', () => {
    const tripId = insertTrip(db);
    insertDay(db, tripId, '2025-06-01');

    const [day] = getDaysForTrip(tripId);
    expect(day?.status).toBe('empty');
    expect(day?.activity_count).toBe(0);
    expect(day?.activity_titles).toEqual([]);
    expect(day?.has_lodging).toBe(false);
    expect(day?.lodging_title).toBeNull();
    expect(day?.has_transit).toBe(false);
  });

  it('derives status "gap" when day has activities but no lodging', () => {
    const tripId = insertTrip(db);
    const dayId = insertDay(db, tripId, '2025-06-01');
    insertActivity(db, tripId, dayId);

    const [day] = getDaysForTrip(tripId);
    expect(day?.status).toBe('gap');
    expect(day?.activity_count).toBe(1);
    expect(day?.has_lodging).toBe(false);
    expect(day?.lodging_title).toBeNull();
  });

  it('derives status "ok" when day has activities and lodging covers that date', () => {
    const tripId = insertTrip(db);
    const dayId = insertDay(db, tripId, '2025-06-01');
    insertActivity(db, tripId, dayId);
    insertLodging(db, tripId, '2025-06-01', '2025-06-02');

    const [day] = getDaysForTrip(tripId);
    expect(day?.status).toBe('ok');
    expect(day?.has_lodging).toBe(true);
    expect(day?.lodging_title).toBe('Hotel');
  });

  it('derives status "travel" when day has a transit reservation (train)', () => {
    const tripId = insertTrip(db);
    const dayId = insertDay(db, tripId, '2025-06-01');
    insertActivity(db, tripId, dayId);
    insertReservation(db, tripId, dayId, 'train');

    const [day] = getDaysForTrip(tripId);
    expect(day?.status).toBe('travel');
  });

  it('derives status "travel" for bus, ferry, and rental_car', () => {
    const tripId = insertTrip(db);
    const d1 = insertDay(db, tripId, '2025-06-01');
    const d2 = insertDay(db, tripId, '2025-06-02');
    const d3 = insertDay(db, tripId, '2025-06-03');
    insertReservation(db, tripId, d1, 'bus');
    insertReservation(db, tripId, d2, 'ferry');
    insertReservation(db, tripId, d3, 'rental_car');

    const days = getDaysForTrip(tripId);
    expect(days.every(d => d.status === 'travel')).toBe(true);
  });

  it('"travel" takes priority over "ok" when transit + lodging both present', () => {
    const tripId = insertTrip(db);
    const dayId = insertDay(db, tripId, '2025-06-01');
    insertActivity(db, tripId, dayId);
    insertLodging(db, tripId, '2025-06-01', '2025-06-02');
    insertReservation(db, tripId, dayId, 'train');

    const [day] = getDaysForTrip(tripId);
    expect(day?.status).toBe('travel');
  });

  it('sets has_transit for train/bus/ferry (not rental_car)', () => {
    const tripId = insertTrip(db);
    const dayId = insertDay(db, tripId, '2025-06-01');
    insertReservation(db, tripId, dayId, 'train');

    const [day] = getDaysForTrip(tripId);
    expect(day?.has_transit).toBe(true);
  });

  it('label comes from day.subtitle, falls back to empty string', () => {
    const tripId = insertTrip(db);
    insertDay(db, tripId, '2025-06-01', 'Paris');
    insertDay(db, tripId, '2025-06-02');

    const days = getDaysForTrip(tripId);
    expect(days[0]?.label).toBe('Paris');
    expect(days[1]?.label).toBe('');
  });

  it('orders days by date ascending', () => {
    const tripId = insertTrip(db);
    insertDay(db, tripId, '2025-06-03');
    insertDay(db, tripId, '2025-06-01');
    insertDay(db, tripId, '2025-06-02');

    const days = getDaysForTrip(tripId);
    expect(days.map(d => d.date)).toEqual(['2025-06-01', '2025-06-02', '2025-06-03']);
  });

  it('returns activity_titles with all activity titles for the day', () => {
    const tripId = insertTrip(db);
    const dayId = insertDay(db, tripId, '2025-06-01');
    insertActivity(db, tripId, dayId, 'Museum');
    insertActivity(db, tripId, dayId, 'Lunch');

    const [day] = getDaysForTrip(tripId);
    expect(day?.activity_count).toBe(2);
    expect(day?.activity_titles).toEqual(expect.arrayContaining(['Museum', 'Lunch']));
    expect(day?.activity_titles).toHaveLength(2);
  });

  it('returns empty activity_titles when day has no activities', () => {
    const tripId = insertTrip(db);
    insertDay(db, tripId, '2025-06-01');

    const [day] = getDaysForTrip(tripId);
    expect(day?.activity_titles).toEqual([]);
  });

  it('lodging spanning multiple days sets has_lodging for all covered days', () => {
    const tripId = insertTrip(db);
    insertDay(db, tripId, '2025-06-01');
    insertDay(db, tripId, '2025-06-02');
    insertDay(db, tripId, '2025-06-03');
    // check-out on June 3 means June 1, 2, and 3 are covered (check_out_date is inclusive)
    insertLodging(db, tripId, '2025-06-01', '2025-06-03', 'Grand Hotel');

    const days = getDaysForTrip(tripId);
    expect(days[0]?.has_lodging).toBe(true);
    expect(days[1]?.has_lodging).toBe(true);
    expect(days[2]?.has_lodging).toBe(true);
    expect(days.every(d => d.lodging_title === 'Grand Hotel')).toBe(true);
  });

  it('lodging does not cover days outside its range', () => {
    const tripId = insertTrip(db);
    insertDay(db, tripId, '2025-06-01');
    insertDay(db, tripId, '2025-06-02');
    insertDay(db, tripId, '2025-06-03');
    insertLodging(db, tripId, '2025-06-02', '2025-06-02', 'B&B');

    const days = getDaysForTrip(tripId);
    expect(days[0]?.has_lodging).toBe(false);
    expect(days[1]?.has_lodging).toBe(true);
    expect(days[2]?.has_lodging).toBe(false);
  });
});

