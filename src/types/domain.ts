import type {
  DayRow,
  ChecklistItemRow,
  ChecklistTemplateRow,
  TemplateItemRow,
} from './db.js';

// ─── Domain class re-exports ──────────────────────────────────────────────────
// Consumers import Trip, Activity, Reservation, ChecklistItem from here — never from domain/ directly.
export type { Trip } from '@/domain/Trip';
export type { Activity } from '@/domain/Activity';
export type { Reservation } from '@/domain/Reservation';
export type { ChecklistItem } from '@/domain/ChecklistItem';

// Re-export raw row types used directly outside the domain layer.
export type { ChecklistItemRow, ChecklistTemplateRow, TemplateItemRow };

// ─── Nested / enriched types ──────────────────────────────────────────────────

import type { Trip } from '@/domain/Trip';
import type { Activity } from '@/domain/Activity';

// Reason: TripWithDays is a Trip class instance extended with nested days.
// useTrip builds it via Object.assign(new Trip(raw), { days }).
export type TripWithDays = Trip & {
  readonly days: DayWithActivities[];
};

export interface DayWithActivities extends DayRow {
  activities: Activity[];
}

// Activities grouped by day for rendering (used by DayCard / buildDayViewModel)
export interface DayViewModel {
  day: DayRow;
  activities: Activity[];
}

// ─── Result type ─────────────────────────────────────────────────────────────

export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export interface AppError {
  code: 'API_OFFLINE' | 'API_KEY_MISSING' | 'INVALID_DATA' | 'DB_ERROR' | 'NOT_FOUND';
  message: string;
  cause?: unknown;
}

// ─── Settings domain ──────────────────────────────────────────────────────────

export type DistanceUnit = 'km' | 'mi';
export type DateFormat = 'DD MMM YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
export type Theme = 'light' | 'dark';

export interface TimeAreaConfig {
  label: string;
  start: number; // hour (0–23)
  end: number;   // hour (0–23)
}

export interface AppSettings {
  theme: Theme;
  distance_unit: DistanceUnit;
  date_format: DateFormat;
  time_areas: Record<string, TimeAreaConfig>;
  tomtom_api_key: string;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export type Screen = 'trips' | 'calendar' | 'map' | 'settings' | 'trip';

