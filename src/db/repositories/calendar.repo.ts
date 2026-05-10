import { getDb } from '../client.js';
import type { CalendarDayRow, CalendarDayStatus } from '@/types/db';

// Raw shape returned directly from SQLite (booleans come back as 0|1)
interface RawCalendarDay {
  date: string;
  label: string;
  activity_count: number;
  activity_titles_json: string;
  has_lodging: 0 | 1;
  lodging_title: string | null;
  has_transit: 0 | 1;
  status: CalendarDayStatus;
}

/**
 * Returns one CalendarDayRow per day in the trip's range.
 * Status derivation (applied in order):
 *  travel  — day has ≥1 reservation with type in (train, bus, ferry, rental_car)
 *  ok      — day has ≥1 activity AND lodging covers this date
 *  gap     — day has ≥1 activity but no lodging
 *  empty   — no activities at all
 *
 * Lodging is trip-level (day_id = NULL); it is matched by checking whether the
 * day's date falls within the reservation's check_in_date..check_out_date range
 * stored in the JSON details column. check_out_date is exclusive (checkout day
 * has no lodging), consistent with reservations.repo.
 *
 * Single query — no N+1.
 */
export function getDaysForTrip(tripId: number): CalendarDayRow[] {
  const rows = getDb()
    .prepare(
      `SELECT
         d.date,
         COALESCE(d.subtitle, '') AS label,
         (SELECT COUNT(*) FROM activities a WHERE a.day_id = d.id) AS activity_count,
         COALESCE(
           (SELECT json_group_array(a.title) FROM activities a WHERE a.day_id = d.id),
           '[]'
         ) AS activity_titles_json,
         CAST(COALESCE((SELECT 1 FROM reservations r
                        WHERE r.trip_id = d.trip_id
                          AND r.type = 'lodging'
                          AND json_extract(r.details, '$.check_in_date') <= d.date
                          AND json_extract(r.details, '$.check_out_date') > d.date
                        LIMIT 1), 0)
              AS INTEGER) AS has_lodging,
         (SELECT r.title FROM reservations r
          WHERE r.trip_id = d.trip_id
            AND r.type = 'lodging'
            AND json_extract(r.details, '$.check_in_date') <= d.date
            AND json_extract(r.details, '$.check_out_date') > d.date
          LIMIT 1) AS lodging_title,
         CAST(COALESCE((SELECT 1 FROM reservations r
                        WHERE r.day_id = d.id AND r.type IN ('train','bus','ferry','rental_car') LIMIT 1), 0)
              AS INTEGER) AS has_transit,
         CASE
           WHEN EXISTS(
             SELECT 1 FROM reservations r
             WHERE r.day_id = d.id AND r.type IN ('train','bus','ferry','rental_car')
           ) THEN 'travel'
           WHEN (SELECT COUNT(*) FROM activities a WHERE a.day_id = d.id) > 0
            AND EXISTS(
              SELECT 1 FROM reservations r
              WHERE r.trip_id = d.trip_id
                AND r.type = 'lodging'
                AND json_extract(r.details, '$.check_in_date') <= d.date
                AND json_extract(r.details, '$.check_out_date') > d.date
            ) THEN 'ok'
           WHEN (SELECT COUNT(*) FROM activities a WHERE a.day_id = d.id) > 0
            THEN 'gap'
           ELSE 'empty'
         END AS status
       FROM days d
       WHERE d.trip_id = ?
       ORDER BY d.date ASC`,
    )
    .all(tripId) as RawCalendarDay[];

  return rows.map((row, i) => ({
    date:             row.date,
    day_number:       i + 1,
    label:            row.label,
    status:           row.status,
    activity_count:   row.activity_count,
    activity_titles:  JSON.parse(row.activity_titles_json) as string[],
    has_lodging:      row.has_lodging === 1,
    lodging_title:    row.lodging_title,
    has_transit:      row.has_transit === 1,
  }));
}
