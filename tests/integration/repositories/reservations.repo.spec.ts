import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../helpers/db';
import type Database from 'better-sqlite3';

let db: Database.Database;

vi.mock('@/db/client', () => ({
  getDb: () => db,
}));

const {
  createReservation,
  createReservationSafe,
  updateReservationSafe,
  findLodgingOverlap,
  findById,
  deleteReservation,
} = await import('@/db/repositories/reservations.repo');

const { createTrip } = await import('@/db/repositories/trips.repo');
const { syncDaysForTrip } = await import('@/services/days.service');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTrip() {
  const trip = createTrip({ title: 'Test Trip', start_date: '2025-06-01', end_date: '2025-06-30' });
  syncDaysForTrip(trip.id, '2025-06-01', '2025-06-30');
  return trip;
}

function makeLodgingInput(tripId: number, checkIn: string, checkOut: string) {
  return {
    trip_id: tripId,
    day_id: null,
    type: 'lodging' as const,
    status: 'confirmed' as const,
    details: {
      type: 'lodging' as const,
      property_name: 'Hotel Test',
      location: 'Lisbon',
      check_in_date: checkIn,
      check_out_date: checkOut,
    },
  };
}

// ── findLodgingOverlap ────────────────────────────────────────────────────────

describe('findLodgingOverlap()', () => {
  beforeEach(() => {
    db = createTestDb();
  });

  it('returns null when no lodging exists', () => {
    const trip = makeTrip();
    expect(findLodgingOverlap(trip.id, '2025-06-10', '2025-06-15')).toBeNull();
  });

  it('detects a fully overlapping stay', () => {
    const trip = makeTrip();
    createReservation(makeLodgingInput(trip.id, '2025-06-10', '2025-06-20'));
    // New stay completely inside the existing one
    const overlap = findLodgingOverlap(trip.id, '2025-06-12', '2025-06-18');
    expect(overlap).not.toBeNull();
  });

  it('detects a partially overlapping stay (new check-in before existing check-out)', () => {
    const trip = makeTrip();
    createReservation(makeLodgingInput(trip.id, '2025-06-10', '2025-06-20'));
    const overlap = findLodgingOverlap(trip.id, '2025-06-15', '2025-06-25');
    expect(overlap).not.toBeNull();
  });

  it('allows back-to-back stays (check-out == next check-in)', () => {
    const trip = makeTrip();
    createReservation(makeLodgingInput(trip.id, '2025-06-10', '2025-06-15'));
    // Next stay starts exactly when the first one ends — not an overlap
    expect(findLodgingOverlap(trip.id, '2025-06-15', '2025-06-20')).toBeNull();
  });

  it('excludes a specific id from the check', () => {
    const trip = makeTrip();
    const res = createReservation(makeLodgingInput(trip.id, '2025-06-10', '2025-06-20'));
    // Should not flag itself as an overlap when being updated
    expect(findLodgingOverlap(trip.id, '2025-06-10', '2025-06-20', res.id)).toBeNull();
  });

  it('does not flag reservations for a different trip', () => {
    const tripA = makeTrip();
    const tripB = makeTrip();
    createReservation(makeLodgingInput(tripA.id, '2025-06-10', '2025-06-20'));
    // Same dates, but different trip — should not conflict
    expect(findLodgingOverlap(tripB.id, '2025-06-10', '2025-06-20')).toBeNull();
  });
});

// ── createReservationSafe ─────────────────────────────────────────────────────

describe('createReservationSafe()', () => {
  beforeEach(() => {
    db = createTestDb();
  });

  it('creates a non-lodging reservation without an overlap check', () => {
    const trip = makeTrip();
    const result = createReservationSafe({
      trip_id: trip.id,
      day_id: null,
      type: 'flight',
      status: 'confirmed',
      details: { type: 'flight', airline: 'TAP', flight_number: 'TP100', origin: 'LIS', destination: 'JFK' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.item.type).toBe('flight');
  });

  it('creates a lodging reservation when no overlap exists', () => {
    const trip = makeTrip();
    const result = createReservationSafe(makeLodgingInput(trip.id, '2025-06-10', '2025-06-15'));
    expect(result.ok).toBe(true);
  });

  it('rejects a lodging reservation when dates overlap an existing one', () => {
    const trip = makeTrip();
    createReservationSafe(makeLodgingInput(trip.id, '2025-06-10', '2025-06-20'));
    const result = createReservationSafe(makeLodgingInput(trip.id, '2025-06-15', '2025-06-25'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(typeof result.conflict).toBe('string');
  });

  it('allows a lodging when existing stay is in a different trip', () => {
    const tripA = makeTrip();
    const tripB = makeTrip();
    createReservationSafe(makeLodgingInput(tripA.id, '2025-06-10', '2025-06-20'));
    const result = createReservationSafe(makeLodgingInput(tripB.id, '2025-06-10', '2025-06-20'));
    expect(result.ok).toBe(true);
  });
});

// ── updateReservationSafe ─────────────────────────────────────────────────────

describe('updateReservationSafe()', () => {
  beforeEach(() => {
    db = createTestDb();
  });

  it('returns null for a non-existent reservation', () => {
    expect(updateReservationSafe(9999, { status: 'confirmed' })).toBeNull();
  });

  it('updates a non-lodging reservation without an overlap check', () => {
    const trip = makeTrip();
    const res = createReservation({
      trip_id: trip.id,
      day_id: null,
      type: 'flight',
      status: 'pending',
      details: { type: 'flight', airline: 'TAP', flight_number: 'TP100', origin: 'LIS', destination: 'JFK' },
    });
    const result = updateReservationSafe(res.id, { status: 'confirmed' });
    expect(result?.ok).toBe(true);
  });

  it('allows updating a lodging reservation to non-overlapping dates', () => {
    const trip = makeTrip();
    const r = createReservationSafe(makeLodgingInput(trip.id, '2025-06-10', '2025-06-15'));
    if (!r.ok) throw new Error('setup failed');
    const result = updateReservationSafe(r.item.id, {
      details: { type: 'lodging', property_name: 'Hotel Test', location: 'Lisbon', check_in_date: '2025-06-20', check_out_date: '2025-06-25' },
    });
    expect(result?.ok).toBe(true);
  });

  it('rejects updating a lodging when new dates overlap another stay', () => {
    const trip = makeTrip();
    createReservationSafe(makeLodgingInput(trip.id, '2025-06-10', '2025-06-20'));
    const r2 = createReservationSafe(makeLodgingInput(trip.id, '2025-06-25', '2025-06-30'));
    if (!r2.ok) throw new Error('setup failed');
    // Move r2 dates into the first stay — should conflict
    const result = updateReservationSafe(r2.item.id, {
      details: { type: 'lodging', property_name: 'Hotel Test', location: 'Lisbon', check_in_date: '2025-06-12', check_out_date: '2025-06-18' },
    });
    expect(result?.ok).toBe(false);
  });

  it('does not flag a lodging as overlapping itself when updating same dates', () => {
    const trip = makeTrip();
    const r = createReservationSafe(makeLodgingInput(trip.id, '2025-06-10', '2025-06-20'));
    if (!r.ok) throw new Error('setup failed');
    // Update to the same dates — should pass (excludeId prevents self-conflict)
    const result = updateReservationSafe(r.item.id, {
      details: { type: 'lodging', property_name: 'Hotel Test', location: 'Lisbon', check_in_date: '2025-06-10', check_out_date: '2025-06-20' },
    });
    expect(result?.ok).toBe(true);
  });

  it('persists a status change', () => {
    const trip = makeTrip();
    const res = createReservation({
      trip_id: trip.id,
      day_id: null,
      type: 'flight',
      status: 'pending',
      details: { type: 'flight', airline: 'TAP', flight_number: 'TP100', origin: 'LIS', destination: 'JFK' },
    });
    updateReservationSafe(res.id, { status: 'cancelled' });
    expect(findById(res.id)?.status).toBe('cancelled');
  });
});

// ── deleteReservation ─────────────────────────────────────────────────────────

describe('deleteReservation()', () => {
  beforeEach(() => {
    db = createTestDb();
  });

  it('removes the reservation', () => {
    const trip = makeTrip();
    const res = createReservation(makeLodgingInput(trip.id, '2025-06-10', '2025-06-15'));
    deleteReservation(res.id);
    expect(findById(res.id)).toBeNull();
  });

  it('is idempotent', () => {
    const trip = makeTrip();
    const res = createReservation(makeLodgingInput(trip.id, '2025-06-10', '2025-06-15'));
    deleteReservation(res.id);
    expect(() => deleteReservation(res.id)).not.toThrow();
  });
});
