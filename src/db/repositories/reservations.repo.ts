import { getDb } from '../client.js';
import type { ReservationRow } from '@/types/db';
import type { CreateReservationInput, UpdateReservationInput } from '@/schemas/reservation.schema';
import { reservationAutoTitle } from '@/utils/format';

export type { CreateReservationInput, UpdateReservationInput };

// ─── Result type ──────────────────────────────────────────────────────────────

/**
 * Typed discriminated union returned by safe create/update operations.
 * Routes pattern-match on `ok` — no overlap logic ever leaks into route handlers.
 */
export type ReservationResult =
  | { ok: true;  item: ReservationRow }
  | { ok: false; conflict: string };

// ─── Queries ──────────────────────────────────────────────────────────────────

export function findAllByTripId(tripId: number): ReservationRow[] {
  return getDb()
    .prepare('SELECT * FROM reservations WHERE trip_id = ? ORDER BY sort_order ASC, created_at ASC')
    .all(tripId) as ReservationRow[];
}

export function findAllByDayId(dayId: number): ReservationRow[] {
  return getDb()
    .prepare('SELECT * FROM reservations WHERE day_id = ? ORDER BY sort_order ASC, created_at ASC')
    .all(dayId) as ReservationRow[];
}

export function findById(id: number): ReservationRow | null {
  const row = getDb()
    .prepare('SELECT * FROM reservations WHERE id = ?')
    .get(id) as ReservationRow | undefined;
  return row ?? null;
}

/**
 * Returns the first overlapping lodging reservation for the given trip and date range.
 * Used before INSERT to detect conflicts.
 *
 * NOTE: json_extract() in the WHERE clause cannot use a B-tree index.
 * For trips with large numbers of lodging reservations this degrades to
 * a full scan of reservations filtered by trip_id. The long-term fix is
 * to promote check_in_date/check_out_date to real columns or use a
 * SQLite generated column index (requires SQLite >= 3.31).
 * Acceptable at current scale; revisit if reservation counts grow.
 */
export function findLodgingOverlap(
  tripId: number,
  checkInDate: string,
  checkOutDate: string,
  excludeId?: number,
): ReservationRow | null {
  // Reason: push date comparison into SQL via json_extract so only the single
  // conflicting row is returned instead of loading all lodging rows into JS.
  // Overlap condition: existing check_in < new check_out AND existing check_out > new check_in.
  // Strict inequality so back-to-back lodgings on the same date are allowed.
  const sql = `
    SELECT * FROM reservations
    WHERE  trip_id = ?
    AND    type    = 'lodging'
    AND    json_extract(details, '$.check_out_date') > ?
    AND    json_extract(details, '$.check_in_date')  < ?
    ${excludeId != null ? 'AND id != ?' : ''}
    LIMIT 1
  `;
  const params: unknown[] = excludeId != null
    ? [tripId, checkInDate, checkOutDate, excludeId]
    : [tripId, checkInDate, checkOutDate];

  const row = getDb().prepare(sql).get(...params) as ReservationRow | undefined;
  return row ?? null;
}

/**
 * Returns the lodging reservation that covers a given night for the trip, or
 * null if none. "Night of date" means check_in_date <= date < check_out_date —
 * strict upper bound so a check-out day is not counted as a staying night.
 */
export function getLodgingForNight(tripId: number, date: string): ReservationRow | null {
  const row = getDb().prepare(`
    SELECT * FROM reservations
    WHERE  trip_id = ?
    AND    type    = 'lodging'
    AND    json_extract(details, '$.check_in_date')  <= ?
    AND    json_extract(details, '$.check_out_date') >  ?
    LIMIT 1
  `).get(tripId, date, date) as ReservationRow | undefined;
  return row ?? null;
}

export interface LodgingDayAnchor {
  day_id:         number;
  date:           string;
  check_in_date:  string;
  check_out_date: string;
  lat:            number;
  lng:            number;
}

/**
 * Returns one row per (lodging, day) pair where the lodging covers that day.
 * "Covers" uses the night-of semantics for overnight days (check_in <= date <
 * check_out) PLUS check-in day itself — so callers get both the arriving day
 * and all overnight days in a single query.
 *
 * Used by the route-leg graph to inject lodgings as silent anchor points
 * without needing a day_id FK on the reservation.
 */
export function getLodgingDayAnchors(tripId: number): LodgingDayAnchor[] {
  return getDb().prepare(`
    SELECT d.id  AS day_id,
           d.date,
           json_extract(r.details, '$.check_in_date')  AS check_in_date,
           json_extract(r.details, '$.check_out_date') AS check_out_date,
           r.lat, r.lng
    FROM   reservations r
    JOIN   days d ON d.trip_id = r.trip_id
           AND d.date >= json_extract(r.details, '$.check_in_date')
           AND d.date <  json_extract(r.details, '$.check_out_date')
    WHERE  r.trip_id = ?
    AND    r.type    = 'lodging'
    AND    r.lat     IS NOT NULL
    AND    r.lng     IS NOT NULL
  `).all(tripId) as LodgingDayAnchor[];
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function createReservation(input: CreateReservationInput): ReservationRow {
  const db = getDb();

  // Reason: sort_order appended after last reservation in the same day bucket.
  const sortOrder = (() => {
    if (input.day_id != null) {
      const max = db.prepare('SELECT MAX(sort_order) AS m FROM reservations WHERE day_id = ?').get(input.day_id) as { m: number | null };
      return (max.m ?? -1) + 1;
    }
    return 0;
  })();

  // Reason: title is derived from details so callers never need to supply it.
  const detailsObj = input.details as Record<string, string>;
  const title = (input.title != null && input.title.trim() !== '') ? input.title.trim() : reservationAutoTitle(input.type, detailsObj);

  const result = db
    .prepare(
      `INSERT INTO reservations
         (trip_id, day_id, type, title, status, confirmation_ref, notes,
          cost_amount, cost_currency, details, sort_order, location, lat, lng)
       VALUES
         (@trip_id, @day_id, @type, @title, @status, @confirmation_ref, @notes,
          @cost_amount, @cost_currency, @details, @sort_order, @location, @lat, @lng)`,
    )
    .run({
      trip_id:          input.trip_id,
      day_id:           input.day_id ?? null,
      type:             input.type,
      title,
      status:           input.status ?? 'pending',
      confirmation_ref: input.confirmation_ref ?? null,
      notes:            input.notes ?? null,
      cost_amount:      input.cost_amount ?? null,
      cost_currency:    input.cost_currency ?? 'EUR',
      // Reason: details is the validated Zod object; serialise to JSON here so
      // the DB stores a single text column and the hook/domain class parses it.
      details:          JSON.stringify(input.details),
      sort_order:       sortOrder,
      location:         input.location ?? null,
      lat:              input.lat ?? null,
      lng:              input.lng ?? null,
    });
  return findById(result.lastInsertRowid as number) ?? (() => { throw new Error('Insert succeeded but row not found'); })();
}

export function updateReservation(id: number, input: UpdateReservationInput): ReservationRow | null {
  const db = getDb();
  const cur = db
    .prepare('SELECT * FROM reservations WHERE id = ?')
    .get(id) as ReservationRow | undefined;
  if (!cur) return null;

  // Reason: re-derive title when details are being updated.
  const newDetails = input.details !== undefined ? input.details as Record<string, string> : null;
  const newType = input.type ?? cur.type;
  const derivedTitle = newDetails != null ? reservationAutoTitle(newType, newDetails) : cur.title;
  const title = (input.title != null && input.title.trim() !== '') ? input.title.trim() : derivedTitle;

  db.prepare(
    `UPDATE reservations SET
       day_id = @day_id, type = @type, title = @title, status = @status,
       confirmation_ref = @confirmation_ref, notes = @notes,
       cost_amount = @cost_amount, cost_currency = @cost_currency,
       details = @details, sort_order = @sort_order,
       location = @location, lat = @lat, lng = @lng
     WHERE id = @id`,
  ).run({
    id,
    day_id:           input.day_id   !== undefined ? (input.day_id ?? null) : cur.day_id,
    type:             newType,
    title,
    status:           input.status           ?? cur.status,
    confirmation_ref: input.confirmation_ref !== undefined ? (input.confirmation_ref ?? null) : cur.confirmation_ref,
    notes:            input.notes            !== undefined ? (input.notes ?? null) : cur.notes,
    cost_amount:      input.cost_amount      !== undefined ? (input.cost_amount ?? null) : cur.cost_amount,
    cost_currency:    input.cost_currency    ?? cur.cost_currency,
    details:          input.details !== undefined ? JSON.stringify(input.details) : cur.details,
    sort_order:       cur.sort_order,
    location:         input.location !== undefined ? (input.location ?? null) : cur.location,
    lat:              input.lat      !== undefined ? (input.lat ?? null) : cur.lat,
    lng:              input.lng      !== undefined ? (input.lng ?? null) : cur.lng,
  });

  return findById(id);
}

export function updateReservationLatLng(id: number, lat: number, lng: number): void {
  getDb()
    .prepare('UPDATE reservations SET lat = @lat, lng = @lng WHERE id = @id')
    .run({ id, lat, lng });
}

export function deleteReservation(id: number): void {
  getDb().prepare('DELETE FROM reservations WHERE id = ?').run(id);
}

// ─── Safe mutations (include overlap check) ───────────────────────────────────

/**
 * Creates a reservation, running the lodging overlap check first.
 * Routes should always call this instead of createReservation directly.
 */
export function createReservationSafe(input: CreateReservationInput): ReservationResult {
  if (input.type === 'lodging') {
    const d = input.details as { check_in_date?: string; check_out_date?: string };
    if (d.check_in_date && d.check_out_date) {
      const conflict = findLodgingOverlap(input.trip_id, d.check_in_date, d.check_out_date);
      if (conflict) return { ok: false, conflict: conflict.title };
    }
  }
  return { ok: true, item: createReservation(input) };
}

/**
 * Updates a reservation, running the lodging overlap check first.
 * Routes should always call this instead of updateReservation directly.
 */
export function updateReservationSafe(id: number, input: UpdateReservationInput): ReservationResult | null {
  const existing = findById(id);
  if (!existing) return null;

  const effectiveType = input.type ?? existing.type;
  if (effectiveType === 'lodging') {
    const d = input.details as { check_in_date?: string; check_out_date?: string } | undefined;
    if (d?.check_in_date && d?.check_out_date) {
      const conflict = findLodgingOverlap(existing.trip_id, d.check_in_date, d.check_out_date, id);
      if (conflict) return { ok: false, conflict: conflict.title };
    }
  }
  const item = updateReservation(id, input);
  return item ? { ok: true, item } : null;
}

/**
 * Reorders a mixed list of activities and reservations within a day.
 * Runs in a single transaction for atomicity.
 * Returns the number of rows actually updated so the route can detect out-of-scope IDs.
 */
export function reorderDayItems(
  dayId: number,
  items: { id: number; itemType: 'activity' | 'reservation' }[],
): number {
  const db = getDb();
  const updateAct = db.prepare('UPDATE activities   SET sort_order = ? WHERE id = ? AND day_id = ?');
  const updateRes = db.prepare('UPDATE reservations SET sort_order = ? WHERE id = ? AND day_id = ?');
  const txn = db.transaction((list: { id: number; itemType: 'activity' | 'reservation' }[]) => {
    let matched = 0;
    list.forEach((item, index) => {
      if (item.itemType === 'activity') {
        matched += updateAct.run(index, item.id, dayId).changes;
      } else {
        matched += updateRes.run(index, item.id, dayId).changes;
      }
    });
    return matched;
  });
  return txn(items);
}
