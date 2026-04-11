import { getDb } from '../client.js';
import type { ReservationRow } from '@/types/db';
import type { CreateReservationInput, UpdateReservationInput } from '@/schemas/reservation.schema';

export type { CreateReservationInput, UpdateReservationInput };

// ─── Auto-title helper ────────────────────────────────────────────────────────

function deriveTitle(type: string, details: Record<string, string>): string {
  switch (type) {
    case 'flight':
      return `${details['flight_number'] ?? ''} · ${details['depart_airport'] ?? '?'} → ${details['arrive_airport'] ?? '?'}`.trim();
    case 'lodging':
      return details['property_name'] ?? 'Lodging';
    case 'restaurant':
      return details['restaurant_name'] ?? 'Restaurant';
    case 'train':
    case 'bus':
    case 'ferry':
      return `${details['from_stop'] ?? '?'} → ${details['to_stop'] ?? '?'}`;
    case 'rental_car':
      return `${details['company'] ?? 'Car'} · ${details['pickup_location'] ?? '?'} → ${details['dropoff_location'] ?? '?'}`;
    default:
      return details['description'] ?? 'Reservation';
  }
}

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
 */
export function findLodgingOverlap(
  tripId: number,
  checkInDate: string,
  checkOutDate: string,
  excludeId?: number,
): ReservationRow | null {
  const db = getDb();
  // Reason: fetch all lodging for this trip then check overlap in JS,
  // since dates are stored inside the JSON details column.
  const rows = db
    .prepare(`SELECT * FROM reservations WHERE trip_id = ? AND type = 'lodging'${excludeId != null ? ' AND id != ?' : ''}`)
    .all(excludeId != null ? [tripId, excludeId] : [tripId]) as ReservationRow[];

  for (const row of rows) {
    const d = JSON.parse(row.details) as Record<string, string>;
    const ci = d['check_in_date'];
    const co = d['check_out_date'];
    if (!ci || !co) continue;
    // Reason: check-out on the same date as the next check-in is NOT an overlap.
    // Use strict inequality so back-to-back lodgings on the same date are allowed.
    if (checkInDate < co && checkOutDate > ci) return row;
  }
  return null;
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
  const title = (input.title != null && input.title.trim() !== '') ? input.title.trim() : deriveTitle(input.type, detailsObj);

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
  return findById(result.lastInsertRowid as number)!;
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
  const derivedTitle = newDetails != null ? deriveTitle(newType, newDetails) : cur.title;
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

/**
 * Reorders a mixed list of activities and reservations within a day.
 * Runs in a single transaction for atomicity.
 */
export function reorderDayItems(
  dayId: number,
  items: { id: number; itemType: 'activity' | 'reservation' }[],
): void {
  const db = getDb();
  const updateAct = db.prepare('UPDATE activities   SET sort_order = ? WHERE id = ? AND day_id = ?');
  const updateRes = db.prepare('UPDATE reservations SET sort_order = ? WHERE id = ? AND day_id = ?');
  const txn = db.transaction((list: { id: number; itemType: 'activity' | 'reservation' }[]) => {
    list.forEach((item, index) => {
      if (item.itemType === 'activity') {
        updateAct.run(index, item.id, dayId);
      } else {
        updateRes.run(index, item.id, dayId);
      }
    });
  });
  txn(items);
}
