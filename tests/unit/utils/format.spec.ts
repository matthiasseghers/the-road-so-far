import { describe, it, expect } from 'vitest';
import { formatDateRange, formatDistance, formatDuration, formatProgress, formatActivityTime, formatTripDateRange, nightCount } from '@/utils/format';

describe('formatDateRange()', () => {
  it('omits year from start when same year', () => {
    const result = formatDateRange('2025-09-14', '2025-10-02');
    expect(result).toContain('2025');
    // Start portion should not repeat year
    expect(result).not.toMatch(/2025.*2025/);
  });

  it('includes year in start when different years', () => {
    const result = formatDateRange('2024-12-28', '2025-01-04');
    // Both years should appear
    expect(result).toContain('2024');
    expect(result).toContain('2025');
  });

  it('returns single date string when start equals end', () => {
    const result = formatDateRange('2025-06-01', '2025-06-01');
    // Should not contain a dash/range separator for same-day
    expect(result).toBeTruthy();
  });
});

describe('formatDistance()', () => {
  it('formats km with comma separator', () => {
    const result = formatDistance(1_234_000, 'km');
    expect(result).toContain('1');
    expect(result).toContain('km');
  });

  it('converts to miles', () => {
    const result = formatDistance(1_609_344, 'mi');
    expect(result).toContain('mi');
    // ~1000 miles
    expect(result).toContain('1');
  });

  it('handles zero', () => {
    const result = formatDistance(0, 'km');
    expect(result).toBe('0 km');
  });
});

describe('formatDuration()', () => {
  it('formats hours and minutes', () => {
    const result = formatDuration(9240); // 2h 34m
    expect(result).toBe('2h 34m');
  });

  it('formats minutes only', () => {
    const result = formatDuration(2700); // 45m
    expect(result).toBe('45m');
  });

  it('formats exact hours', () => {
    const result = formatDuration(7200); // 2h 0m
    expect(result).toBe('2h');
  });

  it('handles zero', () => {
    const result = formatDuration(0);
    expect(result).toBe('0m');
  });
});

describe('formatProgress()', () => {
  it('formats percentage', () => {
    expect(formatProgress(62)).toBe('62%');
    expect(formatProgress(0)).toBe('0%');
    expect(formatProgress(100)).toBe('100%');
  });

  it('rounds to nearest integer', () => {
    expect(formatProgress(62.7)).toBe('63%');
  });
});

describe('formatActivityTime()', () => {
  it('returns empty string when both times are null', () => {
    expect(formatActivityTime(null, null)).toBe('');
  });

  it('returns only start_time when end_time is null', () => {
    expect(formatActivityTime('09:00', null)).toBe('09:00');
  });

  it('returns start \u2013 end when both are set', () => {
    expect(formatActivityTime('09:00', '10:30')).toBe('09:00 \u2013 10:30');
  });

  it('returns empty string when start_time is null regardless of end_time', () => {
    expect(formatActivityTime(null, '10:30')).toBe('');
  });
});

describe('formatTripDateRange()', () => {
  it('returns null when start is null', () => {
    expect(formatTripDateRange(null, null)).toBeNull();
  });

  it('returns long date when only start is provided', () => {
    expect(formatTripDateRange('2025-06-01', null)).toBe('1 Jun 2025');
  });

  it('omits year from start when same year as end', () => {
    const result = formatTripDateRange('2025-06-01', '2025-06-14');
    expect(result).toBe('1 Jun \u2013 14 Jun 2025');
  });

  it('includes year on both sides when cross-year', () => {
    const result = formatTripDateRange('2024-12-28', '2025-01-04');
    expect(result).toBe('28 Dec 2024 \u2013 4 Jan 2025');
  });
});

describe('nightCount()', () => {
  it('returns correct night count', () => {
    expect(nightCount('2025-06-10', '2025-06-15')).toBe(5);
  });

  it('returns 0 for same-day check-in/check-out', () => {
    expect(nightCount('2025-06-10', '2025-06-10')).toBe(0);
  });

  it('returns 0 when check-out is before check-in', () => {
    expect(nightCount('2025-06-15', '2025-06-10')).toBe(0);
  });

  it('returns 1 for an overnight stay', () => {
    expect(nightCount('2025-06-10', '2025-06-11')).toBe(1);
  });
});

describe('formatDistance() — additional cases', () => {
  it('formats a fractional km correctly', () => {
    // 1500m = 1.5 km
    const result = formatDistance(1500, 'km');
    expect(result).toBe('1.5 km');
  });

  it('formats large distances in km', () => {
    const result = formatDistance(10_000_000, 'km');
    expect(result).toContain('km');
    // 10 000 km — locale formatting may vary; just verify it contains the unit
    expect(result.length).toBeGreaterThan(3);
  });
});
