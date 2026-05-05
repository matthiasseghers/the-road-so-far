// Shared Document root consumed by both PdfExportModal (download) and
// PdfPreviewPage (live PDFViewer). Accepts any layout implementing PdfLayout.

import { Document } from '@react-pdf/renderer';
import type { PdfLayout } from './layouts';
import type { CoverViewModel, DayViewModel } from './pdf.viewmodel';

interface ItineraryDocumentProps {
  cover:  CoverViewModel;
  days:   DayViewModel[];
  layout: PdfLayout;
}

export function ItineraryDocument({ cover, days, layout }: ItineraryDocumentProps): JSX.Element {
  const { CoverLayout, DayLayout } = layout;
  return (
    <Document
      title={cover.tripTitle}
      author="The Road So Far"
      creator="The Road So Far"
    >
      <CoverLayout {...cover} />
      {days.map((day, i) => (
        <DayLayout key={i} {...day} />
      ))}
    </Document>
  );
}
