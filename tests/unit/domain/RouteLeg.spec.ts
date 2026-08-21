import { describe, it, expect } from 'vitest';
import { RouteLeg, findLeg, findLegMode } from '@/domain/RouteLeg';
import type { RouteLegRow, LegModeRow } from '@/types/db';

// ── Factories ─────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<RouteLegRow> = {}): RouteLegRow {
  return {
    id:          1,
    trip_id:     1,
    from_lat:    48.8566,
    from_lng:    2.3522,
    to_lat:      51.5074,
    to_lng:      -0.1278,
    distance_m:  341_000,
    duration_s:  12_600,
    travel_mode: 'car',
    polyline:    '[]',
    fetched_at:  '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeModeRow(overrides: Partial<LegModeRow> = {}): LegModeRow {
  return {
    id:          1,
    trip_id:     1,
    from_lat:    48.8566,
    from_lng:    2.3522,
    to_lat:      51.5074,
    to_lng:      -0.1278,
    travel_mode: 'car',
    created_at:  '2025-01-01T00:00:00Z',
    updated_at:  '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── durationLabel() ───────────────────────────────────────────────────────────

describe('RouteLeg.durationLabel()', () => {
  it('returns "X min" when under an hour', () => {
    const leg = new RouteLeg(makeRow({ duration_s: 45 * 60 }));
    expect(leg.durationLabel()).toBe('45 min');
  });

  it('returns "X h" when exactly on the hour', () => {
    const leg = new RouteLeg(makeRow({ duration_s: 2 * 3600 }));
    expect(leg.durationLabel()).toBe('2 h');
  });

  it('returns "X h Y min" when over an hour with remainder', () => {
    const leg = new RouteLeg(makeRow({ duration_s: 1 * 3600 + 23 * 60 }));
    expect(leg.durationLabel()).toBe('1 h 23 min');
  });

  it('rounds seconds to nearest minute', () => {
    const leg = new RouteLeg(makeRow({ duration_s: 45 * 60 + 30 }));
    // 45 min 30 sec → rounds to 46 min
    expect(leg.durationLabel()).toBe('46 min');
  });
});

// ── distanceLabel() ───────────────────────────────────────────────────────────

describe('RouteLeg.distanceLabel()', () => {
  it('returns metres when under 1 km', () => {
    const leg = new RouteLeg(makeRow({ distance_m: 750 }));
    expect(leg.distanceLabel()).toBe('750 m');
  });

  it('returns km with one decimal when ≥ 1 km (default unit)', () => {
    const leg = new RouteLeg(makeRow({ distance_m: 1_500 }));
    expect(leg.distanceLabel()).toBe('1.5 km');
  });

  it('returns miles with one decimal when unit is mi', () => {
    const leg = new RouteLeg(makeRow({ distance_m: 1_609 })); // ≈ 1 mile
    const result = leg.distanceLabel('mi');
    expect(result).toMatch(/^1\.0 mi$/);
  });

  it('defaults to km when no unit provided', () => {
    const leg = new RouteLeg(makeRow({ distance_m: 10_000 }));
    expect(leg.distanceLabel()).toBe('10.0 km');
  });
});

// ── findLeg() ─────────────────────────────────────────────────────────────────

describe('findLeg()', () => {
  const leg = new RouteLeg(makeRow({ travel_mode: 'car' }));

  it('returns null when from is null', () => {
    expect(findLeg([leg], null, { lat: 51.5074, lng: -0.1278 })).toBeNull();
  });

  it('returns null when to is null', () => {
    expect(findLeg([leg], { lat: 48.8566, lng: 2.3522 }, null)).toBeNull();
  });

  it('returns null when coords do not match any leg', () => {
    expect(findLeg([leg], { lat: 0, lng: 0 }, { lat: 1, lng: 1 })).toBeNull();
  });

  it('finds a leg by exact coordinates', () => {
    const result = findLeg([leg], { lat: 48.8566, lng: 2.3522 }, { lat: 51.5074, lng: -0.1278 });
    expect(result).toBe(leg);
  });

  it('prefers the requested travel_mode when multiple legs share coords', () => {
    const carLeg  = new RouteLeg(makeRow({ id: 1, travel_mode: 'car' }));
    const bikeLeg = new RouteLeg(makeRow({ id: 2, travel_mode: 'bicycle' }));
    expect(findLeg([carLeg, bikeLeg], { lat: 48.8566, lng: 2.3522 }, { lat: 51.5074, lng: -0.1278 }, 'bicycle')).toBe(bikeLeg);
  });

  it('falls back to any mode when preferred mode not found', () => {
    const carLeg = new RouteLeg(makeRow({ id: 1, travel_mode: 'car' }));
    expect(findLeg([carLeg], { lat: 48.8566, lng: 2.3522 }, { lat: 51.5074, lng: -0.1278 }, 'bicycle')).toBe(carLeg);
  });
});

// ── findLegMode() ─────────────────────────────────────────────────────────────

describe('findLegMode()', () => {
  const mode = makeModeRow({ travel_mode: 'bicycle' });

  it('returns fallback when no modes stored', () => {
    expect(findLegMode([], 48.8566, 2.3522, 51.5074, -0.1278, 'car')).toBe('car');
  });

  it('returns the stored mode when coords match', () => {
    expect(findLegMode([mode], 48.8566, 2.3522, 51.5074, -0.1278, 'car')).toBe('bicycle');
  });

  it('returns fallback when coords do not match', () => {
    expect(findLegMode([mode], 0, 0, 1, 1, 'car')).toBe('car');
  });
});
