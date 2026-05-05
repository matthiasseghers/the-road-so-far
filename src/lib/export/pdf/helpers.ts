// Pure helper functions for PDF export — no React, no jsPDF, no side effects.
// All exported functions are unit-tested in tests/unit/export/pdf.test.ts.

import { format, parseISO } from 'date-fns';
import type { Reservation } from '@/domain/Reservation';

// ── Labels ────────────────────────────────────────────────────────────────────

export function reservationTypeLabel(type: string): string {
  const MAP: Record<string, string> = {
    lodging:    'Lodging',
    flight:     'Flight',
    train:      'Train',
    bus:        'Bus',
    ferry:      'Ferry',
    rental_car: 'Car Rental',
    restaurant: 'Restaurant',
    other:      'Other',
  };
  return MAP[type] ?? type;
}

export function activityTypeLabel(type: string): string {
  const MAP: Record<string, string> = {
    attraction: 'Attraction',
    food:       'Food & Drink',
    shopping:   'Shopping',
    outdoors:   'Outdoors',
    cultural:   'Cultural',
    note:       'Note',
    other:      'Other',
  };
  return MAP[type] ?? type;
}

// ── Formatting ────────────────────────────────────────────────────────────────

export function formatDayHeader(dateISO: string, dayIndex: number): string {
  return `Day ${dayIndex + 1}  \u00B7  ${format(parseISO(dateISO), 'EEEE, d MMMM yyyy')}`;
}

export function buildLodgingStripText(res: Reservation, dateISO: string): string | null {
  const label = res.lodgingStripLabel(dateISO);
  if (!label) return null;
  const details = res.parsedDetails<{
    property_name?: string;
    check_in_time?: string;
    check_out_time?: string;
  }>();
  const property = details.property_name ?? res.title;
  switch (label) {
    case 'check-in':  return `Check-in: ${property}${details.check_in_time  ? ` (${details.check_in_time})`  : ''}`;
    case 'staying':   return `Staying tonight: ${property}`;
    case 'check-out': return `Check-out: ${property}${details.check_out_time ? ` (${details.check_out_time})` : ''}`;
    default:          return null;
  }
}

/**
 * Strips Tiptap/ProseMirror JSON to plain text for PDF rendering.
 * Falls back to the raw string if it is not valid JSON.
 */
export function stripTiptapJson(raw: string | null): string {
  if (!raw) return '';
  try {
    const doc = JSON.parse(raw) as { content?: unknown[] };
    if (!doc.content) return raw;
    return extractText(doc.content).trim();
  } catch {
    return raw.trim();
  }
}

function extractText(nodes: unknown[]): string {
  return nodes.map(node => {
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (n.type === 'text') return n.text ?? '';
    if (n.content) return extractText(n.content) + '\n';
    return '';
  }).join('');
}

// ── Map projection ────────────────────────────────────────────────────────────

export interface GeoPoint { lat: number; lng: number; label: string; }

// ── Static map overlay types ──────────────────────────────────────────────────

/** Viewport parameters returned by the server static-map-image endpoint. */
export interface MapMeta {
  centerLat: number;
  centerLng: number;
  zoom:      number;
  imgW:      number;
  imgH:      number;
}

/** A pre-fetched static map ready for PDF rendering: image + viewport + point list. */
export interface StaticMapData {
  dataUrl: string;
  meta:    MapMeta;
  points:  { lat: number; lng: number }[];
}

/**
 * Projects lat/lng coordinates to pixel positions within the static map image
 * using Web Mercator (EPSG:3857), matching TomTom's tile coordinate system.
 * The resulting (x, y) values are in the image's original pixel space (0..imgW, 0..imgH),
 * matching the SVG viewBox so pins align with map features regardless of display scale.
 */
export function projectToMapPixels(
  pts:  { lat: number; lng: number }[],
  meta: MapMeta,
): Array<{ x: number; y: number }> {
  const TILE_SIZE = 256;
  const scale = TILE_SIZE * Math.pow(2, meta.zoom);

  function mercX(lng: number): number {
    return ((lng + 180) / 360) * scale;
  }
  function mercY(lat: number): number {
    const sinLat = Math.sin(lat * Math.PI / 180);
    return (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  }

  const cx = mercX(meta.centerLng);
  const cy = mercY(meta.centerLat);
  return pts.map(p => ({
    x: mercX(p.lng) - cx + meta.imgW / 2,
    y: mercY(p.lat) - cy + meta.imgH / 2,
  }));
}

interface Bounds { minLat: number; maxLat: number; minLng: number; maxLng: number; }

function computeBounds(pts: GeoPoint[]): Bounds {
  const lats = pts.map(p => p.lat);
  const lngs = pts.map(p => p.lng);
  const latSpan = Math.max(...lats) - Math.min(...lats) || 1;
  const lngSpan = Math.max(...lngs) - Math.min(...lngs) || 1;
  const pad = 0.15;
  return {
    minLat: Math.min(...lats) - latSpan * pad,
    maxLat: Math.max(...lats) + latSpan * pad,
    minLng: Math.min(...lngs) - lngSpan * pad,
    maxLng: Math.max(...lngs) + lngSpan * pad,
  };
}

/** Projects lat/lng to SVG [x, y] within a viewBox of width w × height h. */
export function projectPoints(
  pts: GeoPoint[],
  w:   number,
  h:   number,
): Array<GeoPoint & { x: number; y: number }> {
  if (pts.length === 0) return [];
  const b = computeBounds(pts);
  return pts.map(p => ({
    ...p,
    x: ((p.lng - b.minLng) / (b.maxLng - b.minLng)) * w,
    // Reason: SVG Y-axis is inverted — higher lat = smaller Y.
    y: ((b.maxLat - p.lat) / (b.maxLat - b.minLat)) * h,
  }));
}

// ── Mode label ────────────────────────────────────────────────────────────────

/** Returns a human-readable travel mode label for use in the travel section. */
export function formatModeLabel(mode: string): string {
  switch (mode) {
    case 'car':        return 'By car';
    case 'pedestrian': return 'On foot';
    case 'bicycle':    return 'By bike';
    default:           return 'Travel';
  }
}
