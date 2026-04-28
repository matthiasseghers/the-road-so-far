import type { ReservationRow, ReservationType, ReservationStatus } from '@/types/db';
import type { LodgingDetails } from '@/schemas/reservation.schema';
import { reservationAutoTitle } from '@/utils/format';

export class Reservation {
  readonly data: ReservationRow;
  constructor(data: ReservationRow) { this.data = data; }

  get id(): number               { return this.data.id; }
  get trip_id(): number          { return this.data.trip_id; }
  get day_id(): number | null    { return this.data.day_id; }
  get type(): ReservationType    { return this.data.type; }
  get title(): string            { return this.data.title; }
  get status(): ReservationStatus { return this.data.status; }
  get confirmation_ref(): string | null { return this.data.confirmation_ref; }
  get notes(): string | null     { return this.data.notes; }
  get cost_amount(): number | null { return this.data.cost_amount; }
  get cost_currency(): string    { return this.data.cost_currency; }
  get sort_order(): number       { return this.data.sort_order; }
  get location(): string | null  { return this.data.location; }
  get lat(): number | null       { return this.data.lat; }
  get lng(): number | null       { return this.data.lng; }
  get created_at(): string       { return this.data.created_at; }
  get updated_at(): string       { return this.data.updated_at; }

  isLodging():  boolean { return this.data.type === 'lodging'; }
  isPending():  boolean { return this.data.status === 'pending'; }
  isConfirmed(): boolean { return this.data.status === 'confirmed'; }
  isCancelled(): boolean { return this.data.status === 'cancelled'; }

  parsedDetails<T = Record<string, unknown>>(): T {
    // Reason: guard against malformed JSON in the details column (manual DB edit,
    // import corruption) so callers get a safe empty object instead of a SyntaxError.
    try {
      return JSON.parse(this.data.details) as T;
    } catch {
      return {} as T;
    }
  }

  /**
   * Returns true if this reservation covers the given ISO date.
   * For lodging: check_in_date <= date <= check_out_date.
   * For flights: depart_date <= date <= arrive_date.
   * For other transit types: from_date <= date <= to_date.
   * For rental car: pickup_date <= date <= dropoff_date.
   * For others: uses day_id association (always returns false here — caller checks day_id).
   */
  coversDay(dateISO: string): boolean {
    const d = this.parsedDetails<Record<string, string>>();
    switch (this.data.type) {
      case 'lodging':
        return !!(d['check_in_date'] && d['check_out_date'] &&
          dateISO >= d['check_in_date'] && dateISO <= d['check_out_date']);
      case 'flight':
        return !!(d['depart_date'] && d['arrive_date'] &&
          dateISO >= d['depart_date'] && dateISO <= d['arrive_date']);
      case 'train':
      case 'bus':
      case 'ferry':
        return !!(d['from_date'] && d['to_date'] &&
          dateISO >= d['from_date'] && dateISO <= d['to_date']);
      case 'rental_car':
        return !!(d['pickup_date'] && d['dropoff_date'] &&
          dateISO >= d['pickup_date'] && dateISO <= d['dropoff_date']);
      default:
        return false;
    }
  }

  /**
   * For lodging only: returns the label for the amber strip shown on a day card.
   * Returns null if this is not a lodging reservation or does not cover the date.
   */
  lodgingStripLabel(dateISO: string): 'check-in' | 'staying' | 'check-out' | null {
    if (!this.isLodging()) return null;
    const d = this.parsedDetails<LodgingDetails>();
    if (!d.check_in_date || !d.check_out_date) return null;
    if (dateISO < d.check_in_date || dateISO > d.check_out_date) return null;
    if (dateISO === d.check_in_date) return 'check-in';
    if (dateISO === d.check_out_date) return 'check-out';
    return 'staying';
  }

  /**
   * Generates a short display title from the details object.
   * Used when no explicit title is set, or to show in list views.
   */
  autoTitle(): string {
    return reservationAutoTitle(this.data.type, this.parsedDetails<Record<string, string>>(), this.data.title);
  }
}
