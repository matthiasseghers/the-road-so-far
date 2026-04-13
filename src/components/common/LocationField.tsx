import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Spinner } from '@/components/ui/spinner';
import { Check } from 'lucide-react';

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
      <InputGroup>
        <InputGroupInput
          id={inputId}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="e.g. Alfama, Lisbon"
          maxLength={500}
        />
        {status === 'loading' && (
          <InputGroupAddon align="inline-end">
            <Spinner className="size-3.5" />
          </InputGroupAddon>
        )}
        {status === 'ok' && (
          <InputGroupAddon align="inline-end">
            <Check size={13} className="text-emerald-500" aria-label="Location found" />
          </InputGroupAddon>
        )}
      </InputGroup>
      {status === 'not_found' && (
        <span className="text-xs text-destructive">Location not found</span>
      )}
      {status === 'error' && (
        <span className="text-xs text-destructive">Geocoding failed</span>
      )}
    </div>
  );
}

