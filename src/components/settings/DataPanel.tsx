import { useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { api } from '@/db/api-client';

interface DataPanelProps {
  onDataWiped: () => void;
}

export default function DataPanel({ onDataWiped }: DataPanelProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport(): Promise<void> {
    try {
      const data = await api.get<unknown>('/export/all');
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'road-so-far-backup.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Backup downloaded');
    } catch {
      toast.error('Export failed');
    }
  }

  async function handleExportTrippack(): Promise<void> {
    try {
      const data = await api.get<unknown>('/export/all');
      const zip = new JSZip();
      zip.file('backup.json', JSON.stringify(data, null, 2));
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'road-so-far.trippack';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('.trippack exported');
    } catch {
      toast.error('Export failed');
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reason: reset value so selecting the same file again re-triggers onChange.
    e.target.value = '';
    try {
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const entry = zip.file('backup.json');
      if (!entry) {
        toast.error('Invalid .trippack: backup.json not found inside the archive');
        return;
      }
      const payload = JSON.parse(await entry.async('text')) as unknown;
      await api.post<void>('/import/trippack', payload);
      toast.success('Trips imported — reload to see them');
    } catch {
      toast.error('Import failed');
    }
  }

  async function handleWipe(): Promise<void> {
    try {
      await api.delete('/data/wipe');
      toast.success('All data wiped');
      onDataWiped();
    } catch {
      toast.error('Wipe failed');
    }
  }

  return (
    <div>
      <h2 className="settings-panel__title">Data</h2>

      {/* Export JSON backup */}
      <div className="data-card">
        <div className="data-card__text">
          <h3>Export backup</h3>
          <p>Download all your trips, activities, reservations, and checklist items as a JSON file.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void handleExport()}>
          <Download size={14} />
          Export JSON
        </Button>
      </div>

      {/* Export .trippack */}
      <div className="data-card">
        <div className="data-card__text">
          <h3>Export .trippack</h3>
          <p>Download a portable .trippack archive to restore or share on another device.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void handleExportTrippack()}>
          <Download size={14} />
          Export .trippack
        </Button>
      </div>

      {/* Import .trippack */}
      <div className="data-card">
        <div className="data-card__text">
          <h3>Import .trippack</h3>
          <p>Import trips from a .trippack file. Existing data is kept — imported trips are added alongside.</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".trippack"
          className="sr-only"
          onChange={e => void handleImport(e)}
        />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload size={14} />
          Import
        </Button>
      </div>

      {/* Danger zone */}
      <div className="danger-zone">
        <div className="danger-zone__text">
          <h3>Wipe all data</h3>
          <p>
            Permanently delete all trips, activities, reservations, and checklist items.
            This cannot be undone.
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">Wipe</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Wipe all data?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all your trips, activities, reservations, and checklist
                items. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => void handleWipe()}
              >
                Yes, wipe everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
