// Data preparation layer for PDF export.
// Transforms domain objects into flat, pre-formatted view models that PDF
// components receive as props. PDF components do zero data transformation.

import { format, parseISO } from 'date-fns';
import type { Activity } from '@/domain/Activity';
import type { Reservation } from '@/domain/Reservation';
import type { TripWithDays, DayWithActivities } from '@/types/domain';
import {
  activityTypeLabel,
  reservationTypeLabel,
  buildLodgingStripText,
  stripTiptapJson,
  formatModeLabel,
} from './helpers';
import type { StaticMapData } from './helpers';
import { formatActivityTime } from '@/utils/format';

// ── Leg types (single source of truth — DayPage re-exports these) ─────────────

export interface PdfLeg {
  mode:         string; // raw: 'car' | 'pedestrian' | 'bicycle'
  duration:     string; // pre-formatted e.g. "1h 23m"
  distance:     string; // pre-formatted e.g. "87.3 km"
  from:         string;
  to:           string;
  fromLocation: string | null;
  toLocation:   string | null;
}

export interface DayLegSummary {
  legs:          PdfLeg[];
  totalDuration: string;
  totalDistance: string;
}

// ── Component view models ─────────────────────────────────────────────────────

export interface ActivityViewModel {
  id:            number;
  title:         string;
  timeLabel:     string | null; // formatted start/end time, or null
  locationLabel: string | null; // location string, or null
  typeLabel:     string;        // human-readable activity type
  hasLocation:   boolean;
  notes:         string | null; // stripped notes text, or null
}

export interface ReservationViewModel {
  id:               number;
  title:            string;
  typeLabel:        string;         // e.g. 'Flight', 'Hotel', 'Car Rental'
  confirmationCode: string | null;
  timeLabel:        string | null;  // departure/check-in time, or null
  detailLines:      string[];       // pre-formatted key details
  status:           string;
}

export interface LodgingStripViewModel {
  label:        'Check-in' | 'Staying' | 'Check-out';
  propertyName: string;
  displayText:  string; // pre-formatted string ready for rendering
}

/** PdfLeg extended with a pre-formatted mode label for the travel section. */
export interface PdfLegViewModel extends PdfLeg {
  modeLabel: string; // e.g. "By car"
}

// ── Day view model ────────────────────────────────────────────────────────────

export interface DayViewModel {
  dayNumber:         number;
  dayNumberLabel:    string;       // zero-padded, e.g. "01"
  totalDays:         number;
  pageNumber:        number;
  totalPages:        number;
  dateLabel:         string;       // e.g. "Monday, 5 May 2025"
  footerLabel:       string;       // e.g. "Day 1 of 14 · Page 2 of 15"
  title:             string | null;
  subtitle:          string | null;
  noteText:          string | null;
  activities:        ActivityViewModel[];
  reservations:      ReservationViewModel[];
  lodgingStrips:     LodgingStripViewModel[];
  legs:              PdfLegViewModel[];
  legsTotalDuration: string | null;
  legsTotalDistance: string | null;
  legSummary:        string | null; // e.g. "2h 15m · 180 km by car"
  hasContent:        boolean;       // false = rest day
  /** Pre-fetched static map image — set by generateTripPDF after building. */
  staticMap?:        StaticMapData;
}

// ── Cover view model ──────────────────────────────────────────────────────────

export interface LodgingSummary {
  id:        number;
  name:      string;
  dateRange: string; // "1 Jun – 4 Jun · 3 nights"
  status:    string;
}

export interface DaySummaryItem {
  dayNumber: number;
  dateLabel: string;       // "Mon 1 Jun"
  title:     string | null;
}

export interface CoverViewModel {
  tripTitle:      string;
  emoji:          string | null;
  generatedLabel: string;  // "5 May 2026"
  dateRangeLabel: string;  // "1 Jun – 15 Jun 2026"
  durationLabel:  string;  // "14 days"
  status:         string;
  noteSubtitle:   string | null; // first line of trip notes
  lodgings:       LodgingSummary[];
  days:           DaySummaryItem[];
  routePoints:    Array<{ lat: number; lng: number; label: string }>; // for SVG map
  /** Pre-fetched static map image — set by generateTripPDF after building. */
  staticMap?:     StaticMapData;
  /** Pre-fetched cover photo as base64 data URL — set by generateTripPDF when trip has a photo cover. */
  coverImageDataUrl?:    string;
  /** Attribution line for the cover photo. */
  coverImageAttribution?: string;
  /** The trip's gradient key — used as fallback when no photo is available. */
  coverGradient:  string;
  stats: {
    activitiesCount:   number;
    reservationsCount: number;
    countriesLabel:    string | null;
  };
}

// ── Private builders ──────────────────────────────────────────────────────────

function buildActivityViewModel(act: Activity): ActivityViewModel {
  const time = formatActivityTime(act.start_time, act.end_time);
  return {
    id:            act.id,
    title:         act.title,
    timeLabel:     time.length > 0 ? time : null,
    locationLabel: act.location,
    typeLabel:     activityTypeLabel(act.activity_type),
    hasLocation:   act.location !== null && act.location.length > 0,
    notes:         act.notes && act.notes.length > 0 ? act.notes : null,
  };
}

/** Formats an ISO date string as "d MMM yyyy"; returns the raw string on parse failure. */
function fmtDate(iso: string): string {
  try { return format(parseISO(iso), 'd MMM yyyy'); } catch { return iso; }
}

/** Derives timeLabel and detailLines from a reservation's type-specific details. */
function buildReservationDetails(
  res: Reservation,
): { timeLabel: string | null; detailLines: string[] } {
  switch (res.type) {
    case 'flight': {
      const d = res.parsedDetails<{
        airline?: string; flight_number?: string;
        depart_date?: string; depart_time?: string; depart_airport?: string;
        arrive_date?: string; arrive_time?: string; arrive_airport?: string;
      }>();
      const lines: string[] = [];
      const carrier = [d.airline, d.flight_number].filter(Boolean).join(' ');
      if (carrier) lines.push(carrier);
      const airports = [d.depart_airport, d.arrive_airport].filter(Boolean);
      if (airports.length) lines.push(airports.join(' \u2192 '));
      if (d.depart_date)
        lines.push(`Dep: ${fmtDate(d.depart_date)}${d.depart_time ? ` ${d.depart_time}` : ''}`);
      if (d.arrive_date)
        lines.push(`Arr: ${fmtDate(d.arrive_date)}${d.arrive_time ? ` ${d.arrive_time}` : ''}`);
      return { timeLabel: d.depart_time ?? null, detailLines: lines };
    }

    case 'lodging': {
      const d = res.parsedDetails<{
        check_in_date?: string; check_in_time?: string;
        check_out_date?: string; check_out_time?: string;
      }>();
      const lines: string[] = [];
      if (d.check_in_date)
        lines.push(`Check-in: ${fmtDate(d.check_in_date)}${d.check_in_time ? ` ${d.check_in_time}` : ''}`);
      if (d.check_out_date)
        lines.push(`Check-out: ${fmtDate(d.check_out_date)}${d.check_out_time ? ` ${d.check_out_time}` : ''}`);
      return { timeLabel: d.check_in_time ?? null, detailLines: lines };
    }

    case 'train':
    case 'bus':
    case 'ferry': {
      const d = res.parsedDetails<{
        from_stop?: string; to_stop?: string;
        from_date?: string; from_time?: string;
        to_date?: string; to_time?: string;
        carrier?: string;
      }>();
      const lines: string[] = [];
      const route = [d.from_stop, d.to_stop].filter(Boolean).join(' \u2192 ');
      if (route) lines.push(route);
      if (d.carrier) lines.push(d.carrier);
      if (d.from_date)
        lines.push(`Dep: ${fmtDate(d.from_date)}${d.from_time ? ` ${d.from_time}` : ''}`);
      if (d.to_date)
        lines.push(`Arr: ${fmtDate(d.to_date)}${d.to_time ? ` ${d.to_time}` : ''}`);
      return { timeLabel: d.from_time ?? null, detailLines: lines };
    }

    case 'rental_car': {
      const d = res.parsedDetails<{
        company?: string; vehicle_type?: string;
        pickup_location?: string; pickup_date?: string; pickup_time?: string;
        dropoff_location?: string; dropoff_date?: string; dropoff_time?: string;
      }>();
      const lines: string[] = [];
      const co = [d.company, d.vehicle_type].filter(Boolean).join(' \u00B7 ');
      if (co) lines.push(co);
      if (d.pickup_location ?? d.pickup_date) {
        const datePart = d.pickup_date
          ? `${fmtDate(d.pickup_date)}${d.pickup_time ? ` ${d.pickup_time}` : ''}`
          : undefined;
        lines.push(`Pick-up: ${[d.pickup_location, datePart].filter(Boolean).join(', ')}`);
      }
      if (d.dropoff_location ?? d.dropoff_date) {
        const datePart = d.dropoff_date
          ? `${fmtDate(d.dropoff_date)}${d.dropoff_time ? ` ${d.dropoff_time}` : ''}`
          : undefined;
        lines.push(`Drop-off: ${[d.dropoff_location, datePart].filter(Boolean).join(', ')}`);
      }
      return { timeLabel: d.pickup_time ?? null, detailLines: lines };
    }

    case 'restaurant': {
      const d = res.parsedDetails<{
        location?: string; date?: string; time?: string; party_size?: number;
      }>();
      const lines: string[] = [];
      if (d.location) lines.push(d.location);
      if (d.date)
        lines.push(`${fmtDate(d.date)}${d.time ? ` at ${d.time}` : ''}`);
      if (d.party_size) lines.push(`Party of ${d.party_size}`);
      return { timeLabel: d.time ?? null, detailLines: lines };
    }

    default: {
      const d = res.parsedDetails<{ description?: string }>();
      return { timeLabel: null, detailLines: d.description ? [d.description] : [] };
    }
  }
}

export function buildReservationViewModel(res: Reservation): ReservationViewModel {
  const { timeLabel, detailLines } = buildReservationDetails(res);
  return {
    id:               res.id,
    title:            res.title,
    typeLabel:        reservationTypeLabel(res.type),
    confirmationCode: res.confirmation_ref,
    timeLabel,
    detailLines,
    status:           res.status,
  };
}

function buildLodgingStripViewModel(
  res:     Reservation,
  dateISO: string,
): LodgingStripViewModel | null {
  const displayText = buildLodgingStripText(res, dateISO);
  if (!displayText) return null;
  const rawLabel = res.lodgingStripLabel(dateISO);
  const details  = res.parsedDetails<{ property_name?: string }>();
  const labelMap = {
    'check-in':  'Check-in',
    'staying':   'Staying',
    'check-out': 'Check-out',
  } as const;
  return {
    label:        labelMap[rawLabel as keyof typeof labelMap] ?? 'Staying',
    propertyName: details.property_name ?? res.title,
    displayText,
  };
}

// ── Exported builders ─────────────────────────────────────────────────────────

export function buildDayViewModel(
  day:             DayWithActivities,
  allReservations: Reservation[],
  allLodgings:     Reservation[],
  dayIndex:        number,
  totalDays:       number,
  pageNumber:      number,
  totalPages:      number,
  legSummary?:     DayLegSummary,
  includeBookings: boolean = true,
): DayViewModel {
  const dayRes      = allReservations.filter(r => !r.isLodging() && r.day_id === day.id);
  const dayLodgings = allLodgings.filter(r => r.coversDay(day.date));

  const activities    = day.activities.map(buildActivityViewModel);
  const reservations  = includeBookings ? dayRes.map(buildReservationViewModel) : [];
  const lodgingStrips = dayLodgings
    .map(r => buildLodgingStripViewModel(r, day.date))
    .filter((v): v is LodgingStripViewModel => v !== null);

  const legs: PdfLegViewModel[] = (legSummary?.legs ?? []).map(l => ({
    ...l,
    modeLabel: formatModeLabel(l.mode),
  }));

  const dayNumber      = dayIndex + 1;
  const dayNumberLabel = String(dayNumber).padStart(2, '0');
  const dateLabel      = format(parseISO(day.date), 'EEEE, d MMMM yyyy');
  const rawNotes       = stripTiptapJson(day.notes);
  const footerLabel    = `Day ${dayNumber} of ${totalDays} \u00B7 Page ${pageNumber} of ${totalPages}`;

  // Reason: single-leg days show mode; multi-leg days show just total.
  let legSummaryStr: string | null = null;
  if (legSummary && legSummary.legs.length > 0) {
    const modeStr = legSummary.legs.length === 1
      ? ` ${formatModeLabel(legSummary.legs[0].mode).toLowerCase()}`
      : '';
    legSummaryStr = `${legSummary.totalDuration} \u00B7 ${legSummary.totalDistance}${modeStr}`;
  }

  return {
    dayNumber,
    dayNumberLabel,
    totalDays,
    pageNumber,
    totalPages,
    dateLabel,
    footerLabel,
    title:             day.title,
    subtitle:          day.subtitle,
    noteText:          rawNotes.length > 0 ? rawNotes : null,
    activities,
    reservations,
    lodgingStrips,
    legs,
    legsTotalDuration: legSummary?.totalDuration ?? null,
    legsTotalDistance: legSummary?.totalDistance ?? null,
    legSummary:        legSummaryStr,
    hasContent:        activities.length > 0 || reservations.length > 0,
  };
}

export function buildCoverViewModel(
  trip:         TripWithDays,
  reservations: Reservation[],
  generated:    Date,
): CoverViewModel {
  const days     = trip.days ?? [];
  const lodgings = reservations.filter(r => r.isLodging());
  const rawNotes = stripTiptapJson(trip.notes);

  const startLabel = trip.start_date ? format(parseISO(trip.start_date), 'd MMM yyyy') : '\u2014';
  const endLabel   = trip.end_date   ? format(parseISO(trip.end_date),   'd MMM yyyy') : '\u2014';
  const dayCount   = trip.durationDays();

  const lodgingSummaries: LodgingSummary[] = lodgings.map(res => {
    const d       = res.parsedDetails<{ property_name?: string; check_in_date?: string; check_out_date?: string }>();
    const name    = d.property_name ?? res.title;
    const inDate  = d.check_in_date  ? format(parseISO(d.check_in_date),  'd MMM') : '?';
    const outDate = d.check_out_date ? format(parseISO(d.check_out_date), 'd MMM') : '?';
    const nights  = d.check_in_date && d.check_out_date
      ? Math.round((parseISO(d.check_out_date).getTime() - parseISO(d.check_in_date).getTime()) / 86_400_000)
      : 0;
    return {
      id:        res.id,
      name,
      dateRange: `${inDate} \u2013 ${outDate}${nights > 0 ? ` \u00B7 ${nights} night${nights > 1 ? 's' : ''}` : ''}`,
      status:    res.status,
    };
  });

  const daySummaries: DaySummaryItem[] = days.map((day, i) => ({
    dayNumber: i + 1,
    dateLabel: format(parseISO(day.date), 'EEE d MMM'),
    title:     day.title,
  }));

  const routePoints = lodgings
    .filter(r => r.lat !== null && r.lng !== null)
    .map(r => ({
      lat:   r.lat!,
      lng:   r.lng!,
      label: r.parsedDetails<{ property_name?: string }>().property_name ?? r.title,
    }));

  return {
    tripTitle:      trip.title,
    emoji:          trip.emoji,
    generatedLabel: format(generated, 'd MMMM yyyy'),
    dateRangeLabel: `${startLabel} \u2013 ${endLabel}`,
    durationLabel:  dayCount > 0 ? `${dayCount} day${dayCount === 1 ? '' : 's'}` : '',
    status:         trip.status,
    noteSubtitle:   rawNotes.length > 0 ? rawNotes.split('\n')[0] ?? null : null,
    lodgings:       lodgingSummaries,
    days:           daySummaries,
    routePoints,
    coverGradient:  trip.cover_gradient,
    stats: {
      activitiesCount:   days.flatMap(d => d.activities).length,
      reservationsCount: reservations.length,
      // Reason: country data not yet tracked — reserved for a future phase.
      countriesLabel:    null,
    },
  };
}

// ── Convenience builder ───────────────────────────────────────────────────────

/**
 * Builds both cover and day view models from a trip in one call.
 * Used by PdfPreviewPage and generateTripPDF internally.
 * Static maps and leg summaries are set separately by the caller.
 */
export function buildTripViewModels(
  trip:         TripWithDays,
  reservations: Reservation[],
  generated:    Date = new Date(),
): { cover: CoverViewModel; days: DayViewModel[] } {
  const allDays    = trip.days ?? [];
  const lodgings   = reservations.filter(r => r.isLodging());
  const totalPages = allDays.length + 1;
  const cover      = buildCoverViewModel(trip, reservations, generated);
  const days       = allDays.map((day, i) =>
    buildDayViewModel(day, reservations, lodgings, i, allDays.length, i + 2, totalPages),
  );
  return { cover, days };
}
