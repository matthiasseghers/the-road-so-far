// Unit tests for Phase 7 PDF export helpers.
// @react-pdf/renderer is mocked so tests run in the Vitest node environment
// without requiring a browser DOM or canvas.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Reservation } from '@/domain/Reservation';
import type { ReservationRow } from '@/types/db';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Reason: react-pdf requires a browser-like rendering environment. We mock the
// entire module so that: (a) component imports don't blow up in node, and
// (b) pdf().toBlob() returns a predictable Blob without real rendering.
vi.mock('@react-pdf/renderer', () => {
  const stub = ({ children }: { children?: unknown }) => children;
  return {
    Document:   stub,
    Page:       stub,
    View:       stub,
    Text:       stub,
    Svg:        stub,
    Circle:     () => null,
    Line:       () => null,
    Path:       () => null,
    Rect:       () => null,
    G:          stub,
    StyleSheet: { create: (s: unknown) => s },
    pdf: vi.fn(() => ({
      toBlob: () => Promise.resolve(new Blob(['mock-pdf'], { type: 'application/pdf' })),
    })),
  };
});

// Import after mocks are established.
const { generateTripPDF } = await import('@/lib/export/pdf/pdf');
const {
  reservationTypeLabel,
  activityTypeLabel,
  formatDayHeader,
  buildLodgingStripText,
} = await import('@/lib/export/pdf/helpers');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReservation(overrides: Partial<ReservationRow> = {}): Reservation {
  const base: ReservationRow = {
    id:               1,
    trip_id:          10,
    day_id:           null,
    type:             'lodging',
    title:            'Hotel du Soleil',
    status:           'confirmed',
    confirmation_ref: 'ABC123',
    notes:            null,
    cost_amount:      null,
    cost_currency:    'EUR',
    details:          JSON.stringify({
      property_name:  'Hotel du Soleil',
      check_in_date:  '2025-06-01',
      check_out_date: '2025-06-04',
      check_in_time:  '15:00',
      check_out_time: '11:00',
    }),
    sort_order:  0,
    location:    null,
    lat:         null,
    lng:         null,
    created_at:  '2025-01-01T00:00:00.000Z',
    updated_at:  '2025-01-01T00:00:00.000Z',
  };
  return new Reservation({ ...base, ...overrides });
}

// ── reservationTypeLabel ──────────────────────────────────────────────────────

describe('reservationTypeLabel', () => {
  it.each([
    ['lodging',    'Lodging'],
    ['flight',     'Flight'],
    ['train',      'Train'],
    ['bus',        'Bus'],
    ['ferry',      'Ferry'],
    ['rental_car', 'Car Rental'],
    ['restaurant', 'Restaurant'],
    ['other',      'Other'],
  ])('maps %s → %s', (type, expected) => {
    expect(reservationTypeLabel(type)).toBe(expected);
  });

  it('returns the raw value for unknown types', () => {
    expect(reservationTypeLabel('helicopter')).toBe('helicopter');
  });
});

// ── activityTypeLabel ─────────────────────────────────────────────────────────

describe('activityTypeLabel', () => {
  it.each([
    ['attraction', 'Attraction'],
    ['food',       'Food & Drink'],
    ['shopping',   'Shopping'],
    ['outdoors',   'Outdoors'],
    ['cultural',   'Cultural'],
    ['note',       'Note'],
    ['other',      'Other'],
  ])('maps %s → %s', (type, expected) => {
    expect(activityTypeLabel(type)).toBe(expected);
  });

  it('returns the raw value for unknown types', () => {
    expect(activityTypeLabel('mystery')).toBe('mystery');
  });
});

// ── formatDayHeader ───────────────────────────────────────────────────────────

describe('formatDayHeader', () => {
  it('formats the first day correctly (index 0)', () => {
    const result = formatDayHeader('2025-06-01', 0);
    expect(result).toMatch(/^Day 1\s+·\s+/);
    expect(result).toContain('Sunday');
    expect(result).toContain('1 June 2025');
  });

  it('uses 1-based day numbers', () => {
    expect(formatDayHeader('2025-06-05', 4)).toMatch(/^Day 5\s+/);
  });
});

// ── buildLodgingStripText ─────────────────────────────────────────────────────

describe('buildLodgingStripText', () => {
  it('returns check-in text on check-in date', () => {
    const res = makeReservation();
    const text = buildLodgingStripText(res, '2025-06-01');
    expect(text).toBe('Check-in: Hotel du Soleil (15:00)');
  });

  it('returns staying text for intermediate dates', () => {
    const res = makeReservation();
    expect(buildLodgingStripText(res, '2025-06-02')).toBe('Staying tonight: Hotel du Soleil');
    expect(buildLodgingStripText(res, '2025-06-03')).toBe('Staying tonight: Hotel du Soleil');
  });

  it('returns check-out text on check-out date', () => {
    const res = makeReservation();
    const text = buildLodgingStripText(res, '2025-06-04');
    expect(text).toBe('Check-out: Hotel du Soleil (11:00)');
  });

  it('returns null for dates outside the lodging range', () => {
    const res = makeReservation();
    expect(buildLodgingStripText(res, '2025-05-31')).toBeNull();
    expect(buildLodgingStripText(res, '2025-06-05')).toBeNull();
  });

  it('returns null for non-lodging reservation types', () => {
    const res = makeReservation({ type: 'flight' });
    expect(buildLodgingStripText(res, '2025-06-01')).toBeNull();
  });

  it('omits the time when check_in_time is absent', () => {
    const res = makeReservation({
      details: JSON.stringify({
        property_name:  'Plain Hotel',
        check_in_date:  '2025-06-01',
        check_out_date: '2025-06-03',
      }),
    });
    expect(buildLodgingStripText(res, '2025-06-01')).toBe('Check-in: Plain Hotel');
  });

  it('falls back to reservation title when property_name is absent', () => {
    const res = makeReservation({
      title:   'Fallback Inn',
      details: JSON.stringify({
        check_in_date:  '2025-06-01',
        check_out_date: '2025-06-02',
        check_in_time:  '14:00',
      }),
    });
    expect(buildLodgingStripText(res, '2025-06-01')).toBe('Check-in: Fallback Inn (14:00)');
  });
});

// ── generateTripPDF (smoke test — real rendering mocked) ──────────────────────

describe('generateTripPDF', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  function makeTrip(overrides: object = {}) {
    return {
      id: 1, title: 'Test Trip', emoji: '🗺️', status: 'confirmed',
      start_date: '2025-06-01', end_date: '2025-06-03',
      notes: null, tags: [], cover_gradient: 'warm-brown',
      distance_total_m: null, distance_synced_at: null,
      created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z',
      durationDays:    () => 3,
      isOngoing:       () => false,
      isUpcoming:      () => false,
      isPast:          () => false,
      overlapsWith:    () => false,
      computeProgress: () => 0,
      days: [{
        id: 100, trip_id: 1, date: '2025-06-01',
        title: 'Arrival', subtitle: 'Old Town', notes: null,
        created_at: '2025-01-01T00:00:00Z', activities: [],
      }],
      ...overrides,
    };
  }

  it('resolves to a Blob without throwing for a minimal trip', async () => {
    const blob = await generateTripPDF(makeTrip() as never, []);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('resolves to a Blob for a trip with no days', async () => {
    const blob = await generateTripPDF(makeTrip({ days: [] }) as never, []);
    expect(blob).toBeInstanceOf(Blob);
  });
});
