import { useState, Suspense, lazy } from 'react';
import { FileDown, Calendar, Package } from 'lucide-react';
import JSZip from 'jszip';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import IcsExportModal from './IcsExportModal';
// Reason: @react-pdf/renderer is ~700 KB; split into its own chunk and only
// downloaded when the user first opens the PDF export modal.
const PdfExportModal = lazy(() => import('./PdfExportModal'));
import { api } from '@/db/api-client';
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
  const [pdfModalOpen,  setPdfModalOpen]  = useState(false);
  const [exportingPack, setExportingPack] = useState(false);
  const [icsModalOpen,  setIcsModalOpen]  = useState(false);

  async function handleTrippack(): Promise<void> {
    setExportingPack(true);
    try {
      const data = await api.get<unknown>(`/trips/${trip.id}/export/trippack`);
      const zip  = new JSZip();
      zip.file('trip.json', JSON.stringify(data, null, 2));
      const blob = await zip.generateAsync({ type: 'blob' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${safeFilename(trip.title)}.trippack`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('.trippack exported');
    } catch {
      toast.error('Failed to export .trippack');
    } finally {
      setExportingPack(false);
    }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 6 }}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPdfModalOpen(true)}
          type="button"
        >
          <FileDown size={15} />
          Export PDF
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => { void handleTrippack(); }}
          disabled={exportingPack}
          type="button"
        >
          <Package size={15} />
          {exportingPack ? 'Packing\u2026' : 'Export .trippack'}
        </Button>
      </div>

      <Suspense fallback={null}>
        {pdfModalOpen && (
          <PdfExportModal
            open={pdfModalOpen}
            onClose={() => setPdfModalOpen(false)}
            trip={trip}
            reservations={reservations}
            safeFilename={safeFilename}
          />
        )}
      </Suspense>
      <IcsExportModal
        open={icsModalOpen}
        onClose={() => setIcsModalOpen(false)}
        trip={trip}
        reservations={reservations}
      />
    </>
  );
}


