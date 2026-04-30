import { useId, useEffect, useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { Check, MapPin } from 'lucide-react';
import { api } from '@/db/api-client';
import type { AutocompleteSuggestion } from '@/services/providers/types';

type GeocodeStatus = 'idle' | 'loading' | 'ok' | 'not_found' | 'error';

export interface LocationFieldProps {
  value: string;
  onChange: (val: string) => void;
  /** Called immediately when the user picks a suggestion — coordinates are pre-known. */
  onCoordinates?: (lat: number, lng: number) => void;
  status?: GeocodeStatus;
}

const DEBOUNCE_MS = 400;
const MIN_QUERY_LEN = 2;

// Reason: autocomplete is proxied through Express so API keys never leave the
// server, regardless of which geocoding provider is active.
async function fetchAutocomplete(query: string): Promise<AutocompleteSuggestion[]> {
  try {
    const { suggestions } = await api.get<{ suggestions: AutocompleteSuggestion[] }>(
      `/geocode/autocomplete?q=${encodeURIComponent(query)}`,
    );
    return suggestions;
  } catch {
    return [];
  }
}

// Reason: self-contained autocomplete so no parent form needs to know about
// the active geocoding provider — only `onCoordinates` fires when a suggestion is selected.
export default function LocationField({
  value,
  onChange,
  onCoordinates,
  status = 'idle',
}: LocationFieldProps): JSX.Element {
  const inputId          = useId();
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [open, setOpen]               = useState(false);
  const [isFetching, setIsFetching]   = useState(false);
  // Reason: skip the fetch triggered by setting value after a suggestion is selected.
  const skipNextFetchRef = useRef(false);
  const debounceRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < MIN_QUERY_LEN) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setIsFetching(true);
      fetchAutocomplete(value).then(results => {
        setSuggestions(results);
        setOpen(results.length > 0);
        setIsFetching(false);
      });
    }, DEBOUNCE_MS);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value]);

  function selectSuggestion(s: AutocompleteSuggestion): void {
    skipNextFetchRef.current = true;
    onChange(s.name);
    onCoordinates?.(s.lat, s.lng);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={inputId}>Location</Label>
      <Popover
        open={open}
        onOpenChange={(v) => { if (!v) { setOpen(false); setSuggestions([]); } }}
      >
        <PopoverAnchor asChild>
          <div className="relative">
            <Input
              id={inputId}
              type="text"
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder="e.g. Alfama, Lisbon"
              maxLength={500}
              autoComplete="off"
              className={isFetching || status === 'loading' || status === 'ok' ? 'pr-8' : ''}
            />
            {(isFetching || status === 'loading') && (
              <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                <Spinner className="size-3.5" />
              </span>
            )}
            {status === 'ok' && !isFetching && (
              <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                <Check size={13} className="text-emerald-500" aria-label="Location found" />
              </span>
            )}
          </div>
        </PopoverAnchor>

        <PopoverContent
          className="p-0 overflow-hidden"
          style={{ width: 'var(--radix-popover-trigger-width)' }}
          align="start"
          sideOffset={4}
          onOpenAutoFocus={e => e.preventDefault()}
        >
          <ul role="listbox" aria-label="Place suggestions">
            {suggestions.map((s, i) => (
              <li key={i} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                  onMouseDown={e => { e.preventDefault(); selectSuggestion(s); }}
                >
                  <MapPin size={13} className="mt-0.5 shrink-0 text-muted-foreground" />
                  <span>
                    <span className="block text-sm font-medium leading-tight">{s.name}</span>
                    {s.context && (
                      <span className="text-xs text-muted-foreground">{s.context}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>

      {status === 'not_found' && (
        <span className="text-xs text-destructive">Location not found</span>
      )}
      {status === 'error' && (
        <span className="text-xs text-destructive">Geocoding failed</span>
      )}
    </div>
  );
}

