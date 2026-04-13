// Shared pure helpers for calendar grid construction.
// Extracted here so they can be unit-tested without a DOM.

export const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export interface GridCell {
  /** ISO 'YYYY-MM-DD', empty string for padding cells */
  iso: string;
  /** Day of month 1–31, or 0 for padding */
  dayOfMonth: number;
  isPadding: boolean;
}

/**
 * Builds the full 7-column grid for a given month.
 * Week starts on Monday. Padding cells are added at the start and end
 * to complete the first/last row.
 */
export function buildMonthGrid(year: number, month: number): GridCell[] {
  // month is 0-indexed (Jan=0)
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Convert JS Sunday=0 to Mon=0: (day + 6) % 7
  const leadingOffset = (firstDay.getDay() + 6) % 7;

  const cells: GridCell[] = [];

  for (let i = 0; i < leadingOffset; i++) {
    cells.push({ iso: '', dayOfMonth: 0, isPadding: true });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ iso, dayOfMonth: d, isPadding: false });
  }

  const trailing = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < trailing; i++) {
    cells.push({ iso: '', dayOfMonth: 0, isPadding: true });
  }

  return cells;
}

/**
 * Returns the list of [year, month] pairs (0-indexed months) that a date
 * range spans, inclusive of both endpoints.
 */
export function getMonthsForRange(
  startISO: string,
  endISO: string,
): Array<{ year: number; month: number }> {
  const [sy, sm] = startISO.split('-').map(Number) as [number, number, number];
  const [ey, em] = endISO.split('-').map(Number) as [number, number, number];
  const months: Array<{ year: number; month: number }> = [];
  let y = sy;
  let m = sm - 1; // convert to 0-indexed
  const endMonth0 = em - 1;

  while (y < ey || (y === ey && m <= endMonth0)) {
    months.push({ year: y, month: m });
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return months;
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** Returns previous month as { year, month } (month 0-indexed) */
export function prevMonth(year: number, month: number): { year: number; month: number } {
  return month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
}

/** Returns next month as { year, month } (month 0-indexed) */
export function nextMonth(year: number, month: number): { year: number; month: number } {
  return month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
}
