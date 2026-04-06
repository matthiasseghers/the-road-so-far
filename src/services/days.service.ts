import { getDb } from '@/db/client';
import { eachDayInRange } from '@/utils/dates';
import type { DayRow } from '@/types/db';

/**
 * Synchronises the days table for a trip to exactly match its date range.
 * - Inserts missing dates within [startDate, endDate].
 * - Deletes days that fall outside the new range (cascades to activities).
 * Runs everything in a single transaction.
 */
export function syncDaysForTrip(
  tripId: number,
  startDate: string,
  endDate: string,
): DayRow[] {
  const db = getDb();
  const targetDates = eachDayInRange(startDate, endDate);
  const targetSet = new Set(targetDates);

  const existing = db
    .prepare('SELECT * FROM days WHERE trip_id = ?')
    .all(tripId) as DayRow[];

  const existingDates = new Set(existing.map(d => d.date));

  const deleteSql = db.prepare('DELETE FROM days WHERE trip_id = ? AND date = ?');
  const insertSql = db.prepare(
    `INSERT OR IGNORE INTO days (trip_id, date) VALUES (?, ?)`,
  );

  const sync = db.transaction(() => {
    // Remove days no longer in range (their activities cascade-delete)
    for (const day of existing) {
      if (!targetSet.has(day.date)) {
        deleteSql.run(tripId, day.date);
      }
    }
    // Insert new dates
    for (const date of targetDates) {
      if (!existingDates.has(date)) {
        insertSql.run(tripId, date);
      }
    }
  });

  sync();

  return db
    .prepare('SELECT * FROM days WHERE trip_id = ? ORDER BY date ASC')
    .all(tripId) as DayRow[];
}
