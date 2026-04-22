// Phase 7 — PDF export entry point.
// Composes CoverPage + DayPage into a full itinerary Document using @react-pdf/renderer.
// `generateTripPDF` is the only public API consumed by ExportButton.

import { Document, pdf } from '@react-pdf/renderer';
import type { TripWithDays } from '@/types/domain';
import type { Reservation } from '@/domain/Reservation';
import { THEME_WARM } from './theme';
import type { PdfTheme } from './theme';
import { CoverPage } from './CoverPage';
import { DayPage } from './DayPage';

// Re-export pure helpers so existing tests continue to import from '@/lib/export/pdf'.
export {
  reservationTypeLabel,
  activityTypeLabel,
  formatDayHeader,
  buildLodgingStripText,
  stripTiptapJson,
} from './helpers';
export type { PdfTheme } from './theme';
export { THEME_WARM, THEME_PRINT } from './theme';

// ── Document component ────────────────────────────────────────────────────────

interface FullItineraryPDFProps {
  trip:         TripWithDays;
  reservations: Reservation[];
  theme:        PdfTheme;
  generated:    Date;
}

/**
 * Full itinerary document: cover page + one page per day.
 * Adding a new export type (e.g. SummaryPDF) = new component that picks from
 * CoverPage / DayPage / any future section component.
 */
function FullItineraryPDF({ trip, reservations, theme, generated }: FullItineraryPDFProps): JSX.Element {
  const days    = trip.days ?? [];
  const lodgings = reservations.filter(r => r.isLodging());
  // +1 for cover page; used by DayPage footers.
  const totalPages = days.length + 1;

  return (
    <Document
      title={trip.title}
      author="The Road So Far"
      creator="The Road So Far"
    >
      <CoverPage
        trip={trip}
        reservations={reservations}
        theme={theme}
        generated={generated}
      />
      {days.map((day, i) => (
        <DayPage
          key={day.id}
          day={day}
          dayIndex={i}
          totalDays={days.length}
          pageNumber={i + 2}
          totalPages={totalPages}
          reservations={reservations}
          lodgings={lodgings}
          theme={theme}
        />
      ))}
    </Document>
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generates a PDF Blob for the given trip.
 * Caller (ExportButton) is responsible for triggering the download.
 *
 * @param theme - Defaults to THEME_WARM. Pass THEME_PRINT for ink-efficient output.
 */
export async function generateTripPDF(
  trip:         TripWithDays,
  reservations: Reservation[],
  theme:        PdfTheme = THEME_WARM,
): Promise<Blob> {
  const doc = (
    <FullItineraryPDF
      trip={trip}
      reservations={reservations}
      theme={theme}
      generated={new Date()}
    />
  );
  return pdf(doc).toBlob();
}
