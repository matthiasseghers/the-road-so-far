import { describe, it, expect } from 'vitest';
import {
  todayISO,
  eachDayInRange,
  getDaysBetween,
  isDateInRange,
  dateRangesOverlap,
  toISODate,
} from '@/utils/dates';

describe('todayISO()', () => {
  it('returns a YYYY-MM-DD formatted string', () => {
    const result = todayISO();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('eachDayInRange()', () => {
  it('returns all days inclusive', () => {
    const days = eachDayInRange('2025-06-01', '2025-06-03');
    expect(days).toEqual(['2025-06-01', '2025-06-02', '2025-06-03']);
  });

  it('returns single day for same start and end', () => {
    const days = eachDayInRange('2025-06-01', '2025-06-01');
    expect(days).toEqual(['2025-06-01']);
  });
});

describe('getDaysBetween()', () => {
  it('counts days between two dates', () => {
    expect(getDaysBetween('2025-06-01', '2025-06-10')).toBe(9);
  });

  it('returns 0 for same date', () => {
    expect(getDaysBetween('2025-06-01', '2025-06-01')).toBe(0);
  });
});

describe('isDateInRange()', () => {
  it('returns true for date within range', () => {
    expect(isDateInRange('2025-06-05', '2025-06-01', '2025-06-10')).toBe(true);
  });

  it('returns true for date on boundary', () => {
    expect(isDateInRange('2025-06-01', '2025-06-01', '2025-06-10')).toBe(true);
    expect(isDateInRange('2025-06-10', '2025-06-01', '2025-06-10')).toBe(true);
  });

  it('returns false for date outside range', () => {
    expect(isDateInRange('2025-05-31', '2025-06-01', '2025-06-10')).toBe(false);
    expect(isDateInRange('2025-06-11', '2025-06-01', '2025-06-10')).toBe(false);
  });
});

describe('dateRangesOverlap()', () => {
  it('returns true for overlapping ranges', () => {
    const result = dateRangesOverlap(
      { start: '2025-06-01', end: '2025-06-10' },
      { start: '2025-06-08', end: '2025-06-15' },
    );
    expect(result).toBe(true);
  });

  it('returns false for non-overlapping ranges', () => {
    const result = dateRangesOverlap(
      { start: '2025-06-01', end: '2025-06-07' },
      { start: '2025-06-08', end: '2025-06-15' },
    );
    expect(result).toBe(false);
  });

  it('returns true when one range contains the other', () => {
    const result = dateRangesOverlap(
      { start: '2025-06-01', end: '2025-06-30' },
      { start: '2025-06-10', end: '2025-06-15' },
    );
    expect(result).toBe(true);
  });
});

describe('toISODate()', () => {
  it('formats Date to YYYY-MM-DD', () => {
    const d = new Date('2025-06-01T12:00:00Z');
    expect(toISODate(d)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
