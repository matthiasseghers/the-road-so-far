import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

type GeocodeStatus = 'idle' | 'loading' | 'ok' | 'not_found' | 'error';

interface LocationFieldProps {
  value: string;
  onChange: (val: string) => void;
  status?: GeocodeStatus;
}

// Reason: self-contained so a future phase can swap the input for an autocomplete
// dropdown without touching any parent form.
export default function LocationField({ value, onChange, status = 'idle' }: LocationFieldProps): JSX.Element {
  const inputId = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={inputId}>Location</Label>
      <Input
        id={inputId}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="e.g. Alfama, Lisbon"
        maxLength={500}
      />
      {status === 'loading' && (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 size={11} className="animate-spin" aria-hidden="true" />
          Looking up…
        </span>
      )}
      {status === 'ok' && (
        <span className="text-xs text-emerald-500">● Location found</span>
      )}
      {status === 'not_found' && (
        <span className="text-xs text-destructive">Location not found</span>
      )}
    </div>
  );
}
