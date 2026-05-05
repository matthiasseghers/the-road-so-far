// Phase 7 — PDF export entry point.
// generateTripPDF is the only public API consumed by PdfExportModal.
// To add a layout: implement PdfLayout, add to LAYOUT_OPTIONS in PdfExportModal.

import React from 'react';
import { pdf } from '@react-pdf/renderer';
import type { TripWithDays } from '@/types/domain';
import type { Reservation } from '@/domain/Reservation';
import { DefaultLayout } from './layouts/default';
import type { PdfLayout } from './layouts';
import { buildCoverViewModel, buildDayViewModel } from './pdf.viewmodel';
import type { DayLegSummary } from './pdf.viewmodel';
import type { StaticMapData } from './helpers';
import { ItineraryDocument } from './ItineraryDocument';

// Re-export pure helpers so existing tests continue to import from '@/lib/export/pdf/pdf'.
export {
  reservationTypeLabel,
  activityTypeLabel,
  formatDayHeader,
  buildLodgingStripText,
  stripTiptapJson,
} from './helpers';

// ── Public API ────────────────────────────────────────────────────────────────

export type { PdfLayout } from './layouts';
export { DefaultLayout } from './layouts/default';
export { MinimalLayout } from './layouts/minimal';

export interface PdfGenerateOptions {
  layout?:          PdfLayout;
  staticMap?:       StaticMapData;
  dayStaticMaps?:   Record<number, StaticMapData>;
  dayLegSummaries?: Record<number, DayLegSummary>;
}

/**
 * Generates a PDF Blob for the given trip.
 * Caller (PdfExportModal) is responsible for triggering the download.
 *
 * @param options.layout - Defaults to DefaultLayout.
 */
export async function generateTripPDF(
  trip:         TripWithDays,
  reservations: Reservation[],
  options:      PdfGenerateOptions = {},
): Promise<Blob> {
  const {
    layout          = DefaultLayout,
    staticMap,
    dayStaticMaps,
    dayLegSummaries,
  } = options;

  const allDays    = trip.days ?? [];
  const lodgings   = reservations.filter(r => r.isLodging());
  const totalPages = allDays.length + 1;

  const cover = buildCoverViewModel(trip, reservations, new Date());
  cover.staticMap = staticMap;

  const days = allDays.map((day, i) => {
    const vm = buildDayViewModel(
      day, reservations, lodgings, i, allDays.length, i + 2, totalPages,
      dayLegSummaries?.[day.id],
    );
    vm.staticMap = dayStaticMaps?.[day.id];
    return vm;
  });

  const doc = React.createElement(ItineraryDocument, { cover, days, layout });
  // Reason: ItineraryDocument renders a react-pdf <Document> at its root so
  // it is valid to pass to pdf(). The type cast bypasses the overly-restrictive
  // DocumentProps check — ItineraryDocument is a transparent wrapper.
  return pdf(doc as Parameters<typeof pdf>[0]).toBlob();
}
