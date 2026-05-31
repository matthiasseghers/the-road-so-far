import type { ActivityRow } from '@/types/db';

export class Activity {
  readonly data: ActivityRow;
  constructor(data: ActivityRow) { this.data = data; }

  get id(): number { return this.data.id; }
  get day_id(): number | null { return this.data.day_id; }
  get trip_id(): number { return this.data.trip_id; }
  get title(): string { return this.data.title; }
  get activity_type(): ActivityRow['activity_type'] { return this.data.activity_type; }
  get activity_type_icon(): string | null { return this.data.activity_type_icon; }
  get activity_type_id(): number { return this.data.activity_type_id; }
  get start_time(): string | null { return this.data.start_time; }
  get end_time(): string | null { return this.data.end_time; }
  get sort_order(): number { return this.data.sort_order; }
  get notes(): string | null { return this.data.notes; }
  get location(): string | null { return this.data.location; }
  get lat(): number | null { return this.data.lat; }
  get lng(): number | null { return this.data.lng; }
  get created_at(): string { return this.data.created_at; }
  get updated_at(): string { return this.data.updated_at; }

  /** True when a start_time is present. */
  hasTime(): boolean {
    return this.data.start_time !== null;
  }

  /** True when both lat and lng are set (i.e. the activity has been geocoded). */
  isGeocoded(): boolean {
    return this.data.lat != null && this.data.lng != null;
  }

}

