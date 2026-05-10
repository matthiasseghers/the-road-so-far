import type { TripRow, TripStatus } from '@/types/db';
import { todayISO, dateRangesOverlap } from '@/utils/dates';
import { parseISO, differenceInCalendarDays, isValid } from 'date-fns';

// Reason: the constructor accepts tags as either the raw JSON string (TripRow)
// or a pre-parsed string[] (when constructing from API responses that have
// already round-tripped through JSON.parse). The tags getter normalises both.
export type TripData = Omit<TripRow, 'tags'> & {
  tags: string | string[];
  day_count?: number;
  activity_count?: number;
};

export class Trip {
  readonly data: TripData;
  constructor(data: TripData) { this.data = data; }

  // ── Identity getters ──────────────────────────────────────────────────────

  get id(): number { return this.data.id; }
  get title(): string { return this.data.title; }
  get emoji(): string { return this.data.emoji; }
  get status(): TripStatus { return this.data.status; }
  get start_date(): string | null { return this.data.start_date; }
  get end_date(): string | null { return this.data.end_date; }
  get cover_gradient(): string { return this.data.cover_gradient; }
  get cover_type(): 'gradient' | 'photo' { return this.data.cover_type ?? 'gradient'; }
  get cover_image_path(): string | null { return this.data.cover_image_path ?? null; }
  get cover_image_attribution(): string | null { return this.data.cover_image_attribution ?? null; }
  get notes(): string | null { return this.data.notes; }
  get created_at(): string { return this.data.created_at; }
  get updated_at(): string { return this.data.updated_at; }
  get distance_total_m(): number | null { return this.data.distance_total_m; }
  get distance_synced_at(): string | null { return this.data.distance_synced_at; }
  get day_count(): number | undefined { return this.data.day_count; }
  get activity_count(): number | undefined { return this.data.activity_count; }

  // Reason: tags comes as JSON string from SQLite but as string[] from the API
  // (JSON.parse on the server before sending). Handle both transparently.
  get tags(): string[] {
    if (typeof this.data.tags === 'string') {
      return JSON.parse(this.data.tags) as string[];
    }
    return this.data.tags;
  }

  // ── Domain methods ────────────────────────────────────────────────────────

  isOngoing(): boolean {
    // Reason: archived trips must never appear in the ongoing bucket even if their
    // dates straddle today — status takes precedence over date arithmetic.
    if (this.data.status === 'archived') return false;
    if (!this.data.start_date || !this.data.end_date) return false;
    const today = todayISO();
    return this.data.start_date <= today && today <= this.data.end_date;
  }

  isUpcoming(): boolean {
    if (!this.data.start_date) return false;
    return this.data.start_date > todayISO();
  }

  isPast(): boolean {
    if (!this.data.end_date) return false;
    if (this.data.status === 'archived') return true;
    return this.data.end_date < todayISO();
  }

  overlapsWith(other: Trip): boolean {
    if (!this.data.start_date || !this.data.end_date) return false;
    if (!other.data.start_date || !other.data.end_date) return false;
    return dateRangesOverlap(
      { start: this.data.start_date, end: this.data.end_date },
      { start: other.data.start_date, end: other.data.end_date },
    );
  }

  computeProgress(): number {
    if (this.data.status === 'completed' || this.data.status === 'archived') return 100;
    const days = this.data.day_count ?? 0;
    const activities = this.data.activity_count ?? 0;
    if (days === 0) return 0;
    // Reason: 1 activity per day ≈ fully planned; clamp so dense trips don't exceed 100%.
    return Math.min(100, Math.round((activities / days) * 100));
  }

  durationDays(): number {
    if (!this.data.start_date || !this.data.end_date) return 0;
    const start = parseISO(this.data.start_date);
    const end   = parseISO(this.data.end_date);
    if (!isValid(start) || !isValid(end)) return 0;
    return differenceInCalendarDays(end, start) + 1;
  }
}
