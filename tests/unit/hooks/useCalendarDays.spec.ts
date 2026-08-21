import { describe, it, expect } from 'vitest';
import type { CalendarDayRow } from '@/types/db';

// Pure extraction of the byDate derivation logic from useCalendarDays.
function buildByDate(days: CalendarDayRow[]): Record<string, CalendarDayRow> {
  const map: Record<string, CalendarDayRow> = {};
  for (const day of days) map[day.date] = day;
  return map;
}

function makeDay(overrides: Partial<CalendarDayRow> = {}): CalendarDayRow {
  return {
    date: '2025-06-01',
    day_number: 1,
    label: '',
    status: 'empty',
    activity_count: 0,
    has_lodging: false,
    has_transit: false,
    ...overrides,
  };
}

describe('useCalendarDays — byDate derivation', () => {
  it('indexes days by ISO date string', () => {
    const days = [
      makeDay({ date: '2025-06-01', day_number: 1 }),
      makeDay({ date: '2025-06-02', day_number: 2 }),
      makeDay({ date: '2025-06-03', day_number: 3 }),
    ];
    const byDate = buildByDate(days);
    expect(Object.keys(byDate)).toEqual(['2025-06-01', '2025-06-02', '2025-06-03']);
    expect(byDate['2025-06-02']?.day_number).toBe(2);
  });

  it('returns empty object for empty input', () => {
    expect(buildByDate([])).toEqual({});
  });

  it('last duplicate date wins (deterministic overwrite)', () => {
    // Shouldn't happen in practice but ensures predictable behaviour
    const days = [
      makeDay({ date: '2025-06-01', day_number: 1 }),
      makeDay({ date: '2025-06-01', day_number: 99 }),
    ];
    expect(buildByDate(days)['2025-06-01']?.day_number).toBe(99);
  });

  it('preserves all CalendarDayRow fields', () => {
    const day = makeDay({
      date: '2025-07-04',
      day_number: 4,
      label: 'Paris',
      status: 'ok',
      activity_count: 3,
      has_lodging: true,
      has_transit: true,
    });
    const byDate = buildByDate([day]);
    expect(byDate['2025-07-04']).toEqual(day);
  });
});
