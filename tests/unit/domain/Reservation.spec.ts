import { describe, it, expect } from 'vitest';
import { Reservation } from '@/domain/Reservation';
import type { ReservationRow } from '@/types/db';

function makeRow(overrides: Partial<ReservationRow> = {}): ReservationRow {
  return {
    id: 1,
    trip_id: 1,
    day_id: null,
    type: 'lodging',
    title: 'Test Hotel',
    status: 'confirmed',
    confirmation_ref: null,
    notes: null,
    cost_amount: null,
    cost_currency: 'EUR',
    details: '{}',
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeDetails(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}

// ── isLodging ─────────────────────────────────────────────────────────────────

describe('Reservation.isLodging()', () => {
  it('returns true for lodging type', () => {
    const r = new Reservation(makeRow({ type: 'lodging' }));
    expect(r.isLodging()).toBe(true);
  });

  it('returns false for flight type', () => {
    const r = new Reservation(makeRow({ type: 'flight' }));
    expect(r.isLodging()).toBe(false);
  });
});

// ── status helpers ────────────────────────────────────────────────────────────

describe('Reservation status helpers', () => {
  it('isPending returns true when status is pending', () => {
    const r = new Reservation(makeRow({ status: 'pending' }));
    expect(r.isPending()).toBe(true);
    expect(r.isConfirmed()).toBe(false);
    expect(r.isCancelled()).toBe(false);
  });

  it('isConfirmed returns true when status is confirmed', () => {
    const r = new Reservation(makeRow({ status: 'confirmed' }));
    expect(r.isConfirmed()).toBe(true);
    expect(r.isPending()).toBe(false);
  });

  it('isCancelled returns true when status is cancelled', () => {
    const r = new Reservation(makeRow({ status: 'cancelled' }));
    expect(r.isCancelled()).toBe(true);
  });
});

// ── coversDay ─────────────────────────────────────────────────────────────────

describe('Reservation.coversDay()', () => {
  describe('lodging type', () => {
    const row = makeRow({
      type: 'lodging',
      details: makeDetails({ type: 'lodging', property_name: 'Hotel X', location: 'Paris', check_in_date: '2025-06-10', check_out_date: '2025-06-14' }),
    });
    const r = new Reservation(row);

    it('returns true for check-in date', () => {
      expect(r.coversDay('2025-06-10')).toBe(true);
    });

    it('returns true for a middle date', () => {
      expect(r.coversDay('2025-06-12')).toBe(true);
    });

    it('returns true for check-out date', () => {
      expect(r.coversDay('2025-06-14')).toBe(true);
    });

    it('returns false for date before check-in', () => {
      expect(r.coversDay('2025-06-09')).toBe(false);
    });

    it('returns false for date after check-out', () => {
      expect(r.coversDay('2025-06-15')).toBe(false);
    });
  });

  describe('flight type', () => {
    const row = makeRow({
      type: 'flight',
      details: makeDetails({ type: 'flight', airline: 'FR', flight_number: 'FR2108', depart_date: '2025-06-10', arrive_date: '2025-06-10' }),
    });

    it('returns true on the flight day', () => {
      expect(new Reservation(row).coversDay('2025-06-10')).toBe(true);
    });

    it('returns false outside the flight dates', () => {
      expect(new Reservation(row).coversDay('2025-06-11')).toBe(false);
    });
  });

  describe('other type', () => {
    it('returns false for types without date-range logic', () => {
      const r = new Reservation(makeRow({ type: 'restaurant', details: makeDetails({ type: 'restaurant', restaurant_name: 'La Terrasse', location: 'Paris', date: '2025-06-10', time: '19:00' }) }));
      expect(r.coversDay('2025-06-10')).toBe(false);
    });
  });
});

// ── lodgingStripLabel ─────────────────────────────────────────────────────────

describe('Reservation.lodgingStripLabel()', () => {
  const row = makeRow({
    type: 'lodging',
    details: makeDetails({ type: 'lodging', property_name: 'Hotel X', location: 'Paris', check_in_date: '2025-06-10', check_out_date: '2025-06-13' }),
  });
  const r = new Reservation(row);

  it('returns check-in on check-in date', () => {
    expect(r.lodgingStripLabel('2025-06-10')).toBe('check-in');
  });

  it('returns staying on a middle date', () => {
    expect(r.lodgingStripLabel('2025-06-11')).toBe('staying');
    expect(r.lodgingStripLabel('2025-06-12')).toBe('staying');
  });

  it('returns check-out on check-out date', () => {
    expect(r.lodgingStripLabel('2025-06-13')).toBe('check-out');
  });

  it('returns null for date outside range', () => {
    expect(r.lodgingStripLabel('2025-06-09')).toBeNull();
    expect(r.lodgingStripLabel('2025-06-14')).toBeNull();
  });

  it('returns null for non-lodging type', () => {
    const flight = new Reservation(makeRow({ type: 'flight' }));
    expect(flight.lodgingStripLabel('2025-06-10')).toBeNull();
  });
});

// ── autoTitle ─────────────────────────────────────────────────────────────────

describe('Reservation.autoTitle()', () => {
  it('returns flight number and route for flight type', () => {
    const r = new Reservation(makeRow({
      type: 'flight',
      title: 'Ryanair to Lisbon',
      details: makeDetails({ type: 'flight', airline: 'FR', flight_number: 'FR2108', depart_airport: 'LHR', arrive_airport: 'LIS' }),
    }));
    expect(r.autoTitle()).toBe('FR2108 · LHR → LIS');
  });

  it('returns property_name for lodging type', () => {
    const r = new Reservation(makeRow({
      type: 'lodging',
      title: 'Hotel',
      details: makeDetails({ type: 'lodging', property_name: 'Moxy Amsterdam', location: 'Amsterdam', check_in_date: '2025-06-10', check_out_date: '2025-06-13' }),
    }));
    expect(r.autoTitle()).toBe('Moxy Amsterdam');
  });

  it('returns route for train type', () => {
    const r = new Reservation(makeRow({
      type: 'train',
      title: 'Train',
      details: makeDetails({ type: 'train', from_stop: 'Paris', to_stop: 'Brussels', from_date: '2025-06-10', to_date: '2025-06-10' }),
    }));
    expect(r.autoTitle()).toBe('Paris → Brussels');
  });

  it('falls back to title when no useful details', () => {
    const r = new Reservation(makeRow({ type: 'other', title: 'Museum pass', details: makeDetails({ type: 'other' }) }));
    expect(r.autoTitle()).toBe('Museum pass');
  });
});

// ── parsedDetails ─────────────────────────────────────────────────────────────

describe('Reservation.parsedDetails()', () => {
  it('parses JSON details correctly', () => {
    const r = new Reservation(makeRow({ details: '{"type":"lodging","check_in_date":"2025-06-10"}' }));
    const d = r.parsedDetails<{ type: string; check_in_date: string }>();
    expect(d.type).toBe('lodging');
    expect(d.check_in_date).toBe('2025-06-10');
  });
});
