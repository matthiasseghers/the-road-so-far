import { describe, it, expect } from 'vitest';
import { isNightOf, isCheckinDay, isCheckoutDay } from '@/utils/lodging';

describe('isNightOf()', () => {
  it('returns true when date is the check-in date', () => {
    expect(isNightOf('2025-06-01', '2025-06-04', '2025-06-01')).toBe(true);
  });

  it('returns true for a mid-stay night', () => {
    expect(isNightOf('2025-06-01', '2025-06-04', '2025-06-02')).toBe(true);
  });

  it('returns true for the last night (day before checkout)', () => {
    expect(isNightOf('2025-06-01', '2025-06-04', '2025-06-03')).toBe(true);
  });

  it('returns false on the check-out date — guest is leaving that morning', () => {
    expect(isNightOf('2025-06-01', '2025-06-04', '2025-06-04')).toBe(false);
  });

  it('returns false before check-in', () => {
    expect(isNightOf('2025-06-01', '2025-06-04', '2025-05-31')).toBe(false);
  });

  it('returns false well after check-out', () => {
    expect(isNightOf('2025-06-01', '2025-06-04', '2025-06-10')).toBe(false);
  });

  it('handles single-night stays (check-in and check-out on consecutive days)', () => {
    expect(isNightOf('2025-06-01', '2025-06-02', '2025-06-01')).toBe(true);
    expect(isNightOf('2025-06-01', '2025-06-02', '2025-06-02')).toBe(false);
  });
});

describe('isCheckinDay()', () => {
  it('returns true when date matches check-in date', () => {
    expect(isCheckinDay('2025-06-01', '2025-06-01')).toBe(true);
  });

  it('returns false when date is after check-in', () => {
    expect(isCheckinDay('2025-06-01', '2025-06-02')).toBe(false);
  });

  it('returns false when date is before check-in', () => {
    expect(isCheckinDay('2025-06-01', '2025-05-31')).toBe(false);
  });
});

describe('isCheckoutDay()', () => {
  it('returns true when date matches check-out date', () => {
    expect(isCheckoutDay('2025-06-04', '2025-06-04')).toBe(true);
  });

  it('returns false when date is before check-out', () => {
    expect(isCheckoutDay('2025-06-04', '2025-06-03')).toBe(false);
  });

  it('returns false when date is after check-out', () => {
    expect(isCheckoutDay('2025-06-04', '2025-06-05')).toBe(false);
  });
});
