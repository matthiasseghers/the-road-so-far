import { describe, it, expect } from 'vitest';
import { formatDateRange, formatDistance, formatDuration, formatProgress, formatActivityTime } from '@/utils/format';

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
