/**
 * Pure date-based predicates for lodging reservations.
 *
 * All comparisons use YYYY-MM-DD string comparison only — no Date objects —
 * to avoid timezone edge cases when the user's locale differs from the trip
 * locale. Callers must pass ISO date strings.
 */

/**
 * Returns true when the guest is actively staying on `date` as a night —
 * i.e. they have checked in on or before `date` and have NOT yet checked out.
 * check_out_date is treated as the morning of departure: if you check out on
 * 2025-06-03, you are NOT staying the night of 2025-06-03.
 */
export function isNightOf(checkInDate: string, checkOutDate: string, date: string): boolean {
  return date >= checkInDate && date < checkOutDate;
}

/**
 * Returns true when `date` is the day the guest checks in.
 */
export function isCheckinDay(checkInDate: string, date: string): boolean {
  return checkInDate === date;
}

/**
 * Returns true when `date` is the day the guest checks out.
 */
export function isCheckoutDay(checkOutDate: string, date: string): boolean {
  return checkOutDate === date;
}
