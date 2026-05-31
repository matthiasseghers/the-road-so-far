import {
  Camera, Utensils, ShoppingBag, TreePine, Landmark, FileText, Tag,
  MapPin, Bike, Music, Ticket, Heart, Star, Coffee, Beer, Wine,
  Plane, Ship, Bus, Train, Car, Footprints, Mountain, Sunset,
  Palette, Book, Gamepad2, Dumbbell, Waves, Tent, Church,
  Building2, GraduationCap, Sparkles, Globe, Compass,
  BedDouble,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReservationType } from '@/types/db';

// ── Curated icon set for activity types ───────────────────────────────────────
// Maps Lucide icon name strings (as stored in the DB) to components.
// Only includes travel/activity-relevant icons to keep the picker manageable.

export const ACTIVITY_TYPE_ICON_MAP: Record<string, LucideIcon> = {
  camera:         Camera,
  utensils:       Utensils,
  'shopping-bag': ShoppingBag,
  'tree-pine':    TreePine,
  landmark:       Landmark,
  'file-text':    FileText,
  tag:            Tag,
  'map-pin':      MapPin,
  bike:           Bike,
  music:          Music,
  ticket:         Ticket,
  heart:          Heart,
  star:           Star,
  coffee:         Coffee,
  beer:           Beer,
  wine:           Wine,
  plane:          Plane,
  ship:           Ship,
  bus:            Bus,
  train:          Train,
  car:            Car,
  footprints:     Footprints,
  mountain:       Mountain,
  sunset:         Sunset,
  palette:        Palette,
  book:           Book,
  gamepad2:       Gamepad2,
  dumbbell:       Dumbbell,
  waves:          Waves,
  tent:           Tent,
  church:         Church,
  building2:      Building2,
  'graduation-cap': GraduationCap,
  sparkles:       Sparkles,
  globe:          Globe,
  compass:        Compass,
};

/** Ordered list of available icon names for the picker UI. */
export const AVAILABLE_ICONS = Object.keys(ACTIVITY_TYPE_ICON_MAP);

/** Resolve an icon_name string to its Lucide component. Falls back to Tag. */
export function resolveIcon(iconName: string | null | undefined): LucideIcon {
  if (iconName && ACTIVITY_TYPE_ICON_MAP[iconName]) {
    return ACTIVITY_TYPE_ICON_MAP[iconName];
  }
  return Tag;
}

// ── Reservation type icons ────────────────────────────────────────────────────

const RESERVATION_TYPE_ICON_MAP: Record<ReservationType, LucideIcon> = {
  lodging:    BedDouble,
  flight:     Plane,
  train:      Train,
  bus:        Bus,
  ferry:      Ship,
  rental_car: Car,
  restaurant: Utensils,
  other:      Tag,
};

/** Resolve a ReservationType to its Lucide icon component. */
export function resolveReservationTypeIcon(type: ReservationType): LucideIcon {
  return RESERVATION_TYPE_ICON_MAP[type] ?? Tag;
}
