// Row types match DB columns 1:1. Used only in the repository layer.

// ─── Enums (string unions) ────────────────────────────────────────────────────

export type TripStatus = 'draft' | 'planning' | 'confirmed' | 'ready' | 'completed' | 'archived';
export type ActivityType = 'attraction' | 'food' | 'shopping' | 'outdoors' | 'cultural' | 'note' | 'other';
export type ReservationType = 'lodging' | 'flight' | 'train' | 'bus' | 'ferry' | 'rental_car' | 'restaurant' | 'other';
export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled';
// Reason: free-form — no CHECK constraint in DB (migration 003)
export type ChecklistCategory = string | null;

// ─── Row interfaces ───────────────────────────────────────────────────────────

export interface TripRow {
  id: number;
  title: string;
  emoji: string;
  status: TripStatus;
  start_date: string | null;
  end_date: string | null;
  tags: string; // JSON string — parse with JSON.parse
  notes: string | null; // Tiptap JSON string
  cover_gradient: string;
  distance_total_m: number | null;
  distance_synced_at: string | null;
  created_at: string;
  updated_at: string;
  // Reason: populated only by findAllTrips via COUNT subqueries — undefined on single-row fetches
  day_count?: number;
  activity_count?: number;
}

export interface DayRow {
  id: number;
  trip_id: number;
  date: string; // YYYY-MM-DD
  title: string | null;
  subtitle: string | null;
  notes: string | null;
  created_at: string;
}

export interface ActivityRow {
  id: number;
  day_id: number | null;
  trip_id: number;
  title: string;
  activity_type: ActivityType;
  start_time: string | null; // HH:MM
  end_time: string | null;   // HH:MM
  sort_order: number;
  notes: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  updated_at: string;
}

export interface ReservationRow {
  id: number;
  trip_id: number;
  day_id: number | null;
  type: ReservationType;
  title: string;
  status: ReservationStatus;
  confirmation_ref: string | null;
  notes: string | null;
  cost_amount: number | null;
  cost_currency: string;
  details: string; // JSON string — parse with JSON.parse, validated by Zod
  sort_order: number;
  location: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItemRow {
  id: number;
  trip_id: number;
  label: string;
  category: ChecklistCategory;
  is_checked: number; // SQLite boolean: 0 | 1
  sort_order: number;
  source: 'template' | 'trip';
  created_at: string;
}

export interface ChecklistTemplateRow {
  id: number;
  name: string;
  icon_name: string | null;
  is_base: number; // SQLite boolean: 0 | 1
  sort_order: number;
  created_at: string;
}

export interface TemplateItemRow {
  id: number;
  template_id: number;
  label: string;
  category: string;
  sort_order: number;
}

export interface SettingRow {
  key: string;
  value: string; // JSON-encoded value
}

export interface MigrationRow {
  name: string;
  run_at: string;
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

export type CalendarDayStatus = 'ok' | 'gap' | 'travel' | 'empty';

export interface CalendarDayRow {
  date: string;            // ISO 'YYYY-MM-DD'
  day_number: number;      // 1-based index within the trip
  label: string;           // subtitle from the day record, or ''
  status: CalendarDayStatus;
  activity_count: number;
  activity_titles: string[];    // titles of all activities for the day
  has_lodging: boolean;
  lodging_title: string | null; // title of the covering lodging reservation, or null
  has_transit: boolean;
}
