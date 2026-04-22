// Modal for configuring and downloading an .ics calendar export.
// Uses three toggles: trip coverage, activities, and reservations.

import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Switch } from '@/components/ui/switch';
import { generateTripIcs, ICS_DEFAULTS } from '@/lib/export/ics';
import type { IcsOptions } from '@/lib/export/ics';
import type { TripWithDays } from '@/types/domain';
import type { Reservation } from '@/domain/Reservation';

interface IcsExportModalProps {
  open:         boolean;
  onClose:      () => void;
  trip:         TripWithDays;
  reservations: Reservation[];
}

/** Sanitise a trip title for use as a filename stem. */
function safeFilename(title: string): string {
  return (
    title
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 60) || 'trip'
  );
}

export default function IcsExportModal({
  open,
  onClose,
  trip,
  reservations,
}: IcsExportModalProps): JSX.Element {
  const [opts, setOpts] = useState<IcsOptions>(ICS_DEFAULTS);
  const [exporting, setExporting] = useState(false);

  function handleExport(): void {
    setExporting(true);
    try {
      const icsString = generateTripIcs(trip, reservations, opts);
      const blob      = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
      const filename  = `${safeFilename(trip.title)}-itinerary.ics`;
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Calendar exported');
      onClose();
    } catch {
      toast.error('Failed to generate calendar file');
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent style={{ maxWidth: 420 }}>
        <DialogHeader>
          <DialogTitle>Export Calendar (.ics)</DialogTitle>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '4px 0' }}>

          {/* ── Trip coverage ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Label>Trip coverage</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={opts.tripCoverage}
              onValueChange={v => {
                if (v) setOpts(o => ({ ...o, tripCoverage: v as IcsOptions['tripCoverage'] }));
              }}
            >
              <ToggleGroupItem value="single">Single event</ToggleGroupItem>
              <ToggleGroupItem value="per-day">Day by day</ToggleGroupItem>
            </ToggleGroup>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
              {opts.tripCoverage === 'single'
                ? `One event spanning ${trip.start_date ?? '?'} \u2013 ${trip.end_date ?? '?'}.`
                : `One all-day event per calendar day (${trip.days?.length ?? 0} events).`}
            </p>
          </div>

          {/* ── Activities ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Label>Activities</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={opts.activities}
              onValueChange={v => {
                if (v) setOpts(o => ({ ...o, activities: v as IcsOptions['activities'] }));
              }}
            >
              <ToggleGroupItem value="none">None</ToggleGroupItem>
              <ToggleGroupItem value="timed">Timed only</ToggleGroupItem>
              <ToggleGroupItem value="all">All</ToggleGroupItem>
            </ToggleGroup>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
              {opts.activities === 'none'  && 'No activity events will be included.'}
              {opts.activities === 'timed' && 'Only activities with a start time — exported as timed events.'}
              {opts.activities === 'all'   && 'Timed activities as time-specific events; untimed as all-day events.'}
            </p>
          </div>

          {/* ── Reservations ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Label style={{ fontSize: 13, fontWeight: 600 }}>Reservations</Label>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Lodging (multi-day) and other bookings (all-day).
              </p>
            </div>
            <Switch
              checked={opts.reservations}
              onCheckedChange={v => setOpts(o => ({ ...o, reservations: v }))}
            />
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button size="sm" onClick={handleExport} disabled={exporting} type="button">
            <Calendar size={14} />
            {exporting ? 'Exporting\u2026' : 'Export .ics'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
