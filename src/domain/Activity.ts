import type { ActivityRow } from '@/types/db';

export class Activity {
  readonly data: ActivityRow;
  constructor(data: ActivityRow) { this.data = data; }

  get id(): number { return this.data.id; }
  get day_id(): number | null { return this.data.day_id; }
  get trip_id(): number { return this.data.trip_id; }
  get title(): string { return this.data.title; }
  get activity_type(): ActivityRow['activity_type'] { return this.data.activity_type; }
  get start_time(): string | null { return this.data.start_time; }
  get end_time(): string | null { return this.data.end_time; }
  get sort_order(): number { return this.data.sort_order; }
  get notes(): string | null { return this.data.notes; }
  get created_at(): string { return this.data.created_at; }
  get updated_at(): string { return this.data.updated_at; }

  /** True when a start_time is present. */
  hasTime(): boolean {
    return this.data.start_time !== null;
  }

  /**
   * Returns a display string for the time window.
   * "HH:MM – HH:MM" if both start and end are set.
   * "HH:MM" if only start_time is set.
   * "" if neither is set.
   */
  timeDisplay(): string {
    if (!this.data.start_time) return '';
    if (this.data.end_time) return `${this.data.start_time} – ${this.data.end_time}`;
    return this.data.start_time;
  }
}

