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

// ─── Settings domain ──────────────────────────────────────────────────────────

export type DistanceUnit = 'km' | 'mi';
export type DateFormat = 'DD MMM YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
export type Theme = 'light' | 'dark' | 'auto';

export interface TimeAreaConfig {
  label: string;
  start: number; // hour (0–23)
  end: number;   // hour (0–23)
}

export type GeocodingProviderName = 'nominatim' | 'tomtom';
export type RoutingProviderName   = 'tomtom';
export type MapsProviderName      = 'tomtom';

export interface AppSettings {
  theme: Theme;
  date_format: DateFormat;
  time_areas: Record<string, TimeAreaConfig>;
  tomtom_api_key: string;
  geocoding_provider: GeocodingProviderName;
  routing_provider:   RoutingProviderName;
  maps_provider:      MapsProviderName;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export type Screen = 'trips' | 'calendar' | 'map' | 'settings' | 'trip';

