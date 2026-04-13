import { describe, it, expect } from 'vitest';
import { buildMonthGrid, getMonthsForRange, prevMonth, nextMonth } from '@/utils/calendar';

describe('buildMonthGrid', () => {
  it('returns 35 cells for a month starting on Monday (April 2025)', () => {
    // April 2025: starts Monday, 30 days → 0 leading + 30 days + 5 trailing = 35
    const cells = buildMonthGrid(2025, 3); // month 3 = April
    expect(cells).toHaveLength(35);
  });

  it('first non-padding cell has dayOfMonth = 1', () => {
    const cells = buildMonthGrid(2025, 3);
    const first = cells.find(c => !c.isPadding);
    expect(first?.dayOfMonth).toBe(1);
    expect(first?.iso).toBe('2025-04-01');
  });

  it('last non-padding cell matches the last day of the month', () => {
    const cells = buildMonthGrid(2025, 3); // April has 30 days
    const last = [...cells].reverse().find(c => !c.isPadding);
    expect(last?.dayOfMonth).toBe(30);
    expect(last?.iso).toBe('2025-04-30');
  });

  it('total cells are always a multiple of 7', () => {
    for (let m = 0; m < 12; m++) {
      const cells = buildMonthGrid(2025, m);
      expect(cells.length % 7).toBe(0);
    }
  });

  it('leading padding cells come before the 1st', () => {
    // January 2025 starts on a Wednesday → Mon=0,Tue=1,Wed=2 → 2 leading padding cells
    const cells = buildMonthGrid(2025, 0);
    expect(cells[0]?.isPadding).toBe(true);
    expect(cells[1]?.isPadding).toBe(true);
    expect(cells[2]?.isPadding).toBe(false);
    expect(cells[2]?.dayOfMonth).toBe(1);
  });

  it('iso strings are zero-padded', () => {
    const cells = buildMonthGrid(2025, 0); // January 2025
    const first = cells.find(c => !c.isPadding);
    expect(first?.iso).toBe('2025-01-01');
  });

  it('padding cells have isPadding true and dayOfMonth 0', () => {
    const cells = buildMonthGrid(2025, 3);
    const padding = cells.filter(c => c.isPadding);
    expect(padding.every(c => c.dayOfMonth === 0 && c.iso === '')).toBe(true);
  });
});

describe('getMonthsForRange', () => {
  it('returns single month for same-month range', () => {
    const months = getMonthsForRange('2025-04-01', '2025-04-30');
    expect(months).toEqual([{ year: 2025, month: 3 }]);
  });

  it('returns consecutive months for multi-month range', () => {
    const months = getMonthsForRange('2025-04-10', '2025-06-05');
    expect(months).toEqual([
      { year: 2025, month: 3 },
      { year: 2025, month: 4 },
      { year: 2025, month: 5 },
    ]);
  });

  it('handles year boundary', () => {
    const months = getMonthsForRange('2025-11-15', '2026-01-20');
    expect(months).toEqual([
      { year: 2025, month: 10 },
      { year: 2025, month: 11 },
      { year: 2026, month: 0 },
    ]);
  });
});

describe('prevMonth / nextMonth', () => {
  it('prevMonth wraps from January to December', () => {
    expect(prevMonth(2025, 0)).toEqual({ year: 2024, month: 11 });
  });

  it('prevMonth returns previous month within the same year', () => {
    expect(prevMonth(2025, 5)).toEqual({ year: 2025, month: 4 });
  });

  it('nextMonth wraps from December to January', () => {
    expect(nextMonth(2025, 11)).toEqual({ year: 2026, month: 0 });
  });

  it('nextMonth returns next month within the same year', () => {
    expect(nextMonth(2025, 5)).toEqual({ year: 2025, month: 6 });
  });
});
