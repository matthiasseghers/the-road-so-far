import { useState } from 'react';
import { FileDown, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { generateTripPDF } from '@/lib/export/pdf';
import IcsExportModal from './IcsExportModal';
import type { TripWithDays } from '@/types/domain';
import type { Reservation } from '@/domain/Reservation';

interface ExportButtonProps {
  trip:         TripWithDays;
  reservations: Reservation[];
}

/** Sanitise a trip title for use as a filename stem. */
function safeFilename(title: string): string {
  return title
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 60) || 'trip';
}

export default function ExportButton({ trip, reservations }: ExportButtonProps): JSX.Element {
  const [exportingPdf, setExportingPdf] = useState(false);
  const [icsModalOpen, setIcsModalOpen] = useState(false);

  async function handlePdf(): Promise<void> {
    setExportingPdf(true);
    try {
      const blob     = await generateTripPDF(trip, reservations);
      const filename = `${safeFilename(trip.title)}-itinerary.pdf`;
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF exported');
    } catch {
      toast.error('Failed to generate PDF');
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 6 }}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { void handlePdf(); }}
          disabled={exportingPdf}
          type="button"
        >
          <FileDown size={15} />
          {exportingPdf ? 'Exporting\u2026' : 'Export PDF'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIcsModalOpen(true)}
          type="button"
        >
          <Calendar size={15} />
          Export .ics
        </Button>
      </div>

      <IcsExportModal
        open={icsModalOpen}
        onClose={() => setIcsModalOpen(false)}
        trip={trip}
        reservations={reservations}
      />
    </>
  );
}


