import { useReducer, useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import TagInput from '@/components/ui/TagInput';
import { CalendarIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { todayISO, dateRangesOverlap } from '@/utils/dates';
import { CreateTripSchema } from '@/schemas/trip.schema';
import type { Trip } from '@/types/domain';
import type { TripStatus } from '@/types/db';
import type { CreateTripInput, UpdateTripInput } from '@/db/repositories/trips.repo';
import './TripFormModal.css';

// ── Gradient options ──────────────────────────────────────────────────────────

const GRADIENT_OPTIONS: { key: string; label: string }[] = [
  { key: 'warm-brown', label: 'Terracotta' },
  { key: 'cool-blue',  label: 'Blue' },
  { key: 'sage',       label: 'Sage' },
  { key: 'dusk',       label: 'Dusk' },
  { key: 'sand',       label: 'Sand' },
  { key: 'slate',      label: 'Slate' },
];

const GRADIENT_CSS: Record<string, string> = {
  'warm-brown': 'var(--gradient-warm-brown)',
  'cool-blue':  'var(--gradient-cool-blue)',
  'sage':       'var(--gradient-sage)',
  'dusk':       'var(--gradient-dusk)',
  'sand':       'var(--gradient-sand)',
  'slate':      'var(--gradient-slate)',
};

const STATUS_OPTIONS: TripStatus[] = [
  'draft', 'planning', 'confirmed', 'ready', 'completed', 'archived',
];

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  title: string;
  emoji: string;
  status: TripStatus;
  start_date: string;
  end_date: string;
  tags: string[];
  cover_gradient: string;
  notes: string;
}

type FormAction =
  | { type: 'set_title';          value: string }
  | { type: 'set_emoji';          value: string }
  | { type: 'set_status';         value: TripStatus }
  | { type: 'set_start_date';     value: string }
  | { type: 'set_end_date';       value: string }
  | { type: 'set_tags';           value: string[] }
  | { type: 'set_cover_gradient'; value: string }
  | { type: 'set_notes';          value: string };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'set_title':          return { ...state, title: action.value };
    case 'set_emoji':          return { ...state, emoji: action.value };
    case 'set_status':         return { ...state, status: action.value };
    case 'set_start_date':     return { ...state, start_date: action.value };
    case 'set_end_date':       return { ...state, end_date: action.value };
    case 'set_tags':           return { ...state, tags: action.value };
    case 'set_cover_gradient': return { ...state, cover_gradient: action.value };
    case 'set_notes':          return { ...state, notes: action.value };
  }
}

function buildInitialState(trip?: Trip): FormState {
  return {
    title:          trip?.title          ?? '',
    emoji:          trip?.emoji          ?? '🗺️',
    status:         trip?.status         ?? 'planning',
    start_date:     trip?.start_date     ?? '',
    end_date:       trip?.end_date       ?? '',
    tags:           trip?.tags           ?? [],
    cover_gradient: trip?.cover_gradient ?? 'warm-brown',
    notes:          trip?.notes          ?? '',
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface TripFormModalProps {
  open: boolean;
  onClose: () => void;
  /** If provided the modal is in edit mode, otherwise create mode. */
  trip?: Trip;
  /** All trips from the parent hook — used for date-overlap detection. */
  allTrips: Trip[];
  onCreate?: (input: CreateTripInput) => Promise<Trip>;
  onUpdate: (id: number, input: UpdateTripInput) => Promise<Trip>;
}

export default function TripFormModal({
  open,
  onClose,
  trip,
  allTrips,
  onCreate,
  onUpdate,
}: TripFormModalProps): JSX.Element {
  const [state, dispatch] = useReducer(formReducer, buildInitialState(trip));
  const isEdit = trip !== undefined;

  // Re-seed when switching between create/edit
  // Reason: useReducer state doesn't re-init on prop change; reset manually via key prop on modal
  const titleLabel = isEdit ? 'Edit trip' : 'New trip';

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [overlapConfirmOpen, setOverlapConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Reason: ref prevents a double-save if the overlap confirm button is clicked twice.
  const submittingRef = useRef(false);

  // Reason: reset validation state when the modal closes.
  useEffect(() => {
    if (!open) {
      setSubmitAttempted(false);
      setOverlapConfirmOpen(false);
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  }, [open]);

  // Reason: trip.notes can be updated inline on the overview tab without opening this modal.
  // Re-sync the local notes field whenever the prop changes so the modal stays up to date.
  useEffect(() => {
    dispatch({ type: 'set_notes', value: trip?.notes ?? '' });
  }, [trip?.notes]);

  // Reason: schema is the single source of validation truth — no inline checks.
  const schemaResult = CreateTripSchema.safeParse(state);
  const fieldErrors = !schemaResult.success ? schemaResult.error.flatten().fieldErrors : {};

  const titleError: string | null      = submitAttempted ? (fieldErrors.title?.[0]      ?? null) : null;
  const startDateError: string | null  = submitAttempted ? (fieldErrors.start_date?.[0] ?? null) : null;
  const endDateError: string | null    = submitAttempted
    ? (fieldErrors.end_date?.[0] ?? null)
    : null;

  // Reason: fires on every onChange — no blur gate so manual text input also triggers it.
  const pastWarning: string | null =
    state.end_date && state.end_date < todayISO()
      ? "This trip's dates are in the past — is that intentional?"
      : null;

  // Reason: blocking overlap check — user must confirm before saving when dates collide.
  const overlapTrip: Trip | null = (() => {
    if (!state.start_date || !state.end_date) return null;
    const found = allTrips.find(t => {
      if (t.id === trip?.id) return false;
      if (!t.start_date || !t.end_date) return false;
      return dateRangesOverlap(
        { start: state.start_date, end: state.end_date },
        { start: t.start_date, end: t.end_date },
      );
    });
    return found ?? null;
  })();

  function isFormValid(): boolean {
    return schemaResult.success;
  }

  async function doSave(): Promise<void> {
    // Reason: guard for TypeScript narrowing; submit already confirmed validity before calling doSave.
    if (!schemaResult.success || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const payload = schemaResult.data;
      if (isEdit) {
        await onUpdate(trip.id, payload);
      } else {
        await onCreate?.(payload);
      }
      setOverlapConfirmOpen(false);
      onClose();
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSubmitAttempted(true);
    if (!schemaResult.success) return;
    if (overlapTrip) {
      setOverlapConfirmOpen(true);
      return;
    }
    await doSave();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{titleLabel}</DialogTitle>
          </DialogHeader>

          <form className="trip-form pb-1" onSubmit={handleSubmit}>

            {/* Title */}
            <div className="trip-form__field trip-form__field--required">
              <Label htmlFor="trip-title">Trip title</Label>
              <div className="trip-form__title-row">
                <Input
                  id="trip-emoji"
                  className="trip-form__emoji-input"
                  type="text"
                  value={state.emoji}
                  onChange={e => dispatch({ type: 'set_emoji', value: e.target.value })}
                  maxLength={4}
                  aria-label="Trip emoji"
                />
                <Input
                  id="trip-title"
                  aria-invalid={!!titleError}
                  type="text"
                  value={state.title}
                  onChange={e => dispatch({ type: 'set_title', value: e.target.value })}
                  placeholder="e.g. Pacific Coast Highway"
                  autoFocus
                />
              </div>
              {titleError && <span className="form-field-error">{titleError}</span>}
            </div>

            {/* Status */}
            <div className="trip-form__field">
              <Label htmlFor="trip-status">Status</Label>
              <Select value={state.status} onValueChange={v => dispatch({ type: 'set_status', value: v as TripStatus })}>
                <SelectTrigger id="trip-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dates */}
            <div className="trip-form__field trip-form__field--required">
              <Label>Trip dates</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    aria-invalid={!!(startDateError || endDateError)}
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !state.start_date && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="mr-2 size-4 opacity-70" />
                    {state.start_date && state.end_date
                      ? `${format(parseISO(state.start_date), 'd MMM yyyy')} – ${format(parseISO(state.end_date), 'd MMM yyyy')}`
                      : state.start_date
                      ? `${format(parseISO(state.start_date), 'd MMM yyyy')} – pick end`
                      : 'Pick date range'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  {/* Reason: numberOfMonths=2 lets the user see start and end month
                      side-by-side so a multi-week trip can be selected in one view. */}
                  <Calendar
                    mode="range"
                    numberOfMonths={2}
                    selected={{
                      from: state.start_date ? parseISO(state.start_date) : undefined,
                      to:   state.end_date   ? parseISO(state.end_date)   : undefined,
                    }}
                    onSelect={range => {
                      dispatch({ type: 'set_start_date', value: range?.from ? format(range.from, 'yyyy-MM-dd') : '' });
                      dispatch({ type: 'set_end_date',   value: range?.to   ? format(range.to,   'yyyy-MM-dd') : '' });
                    }}
                    defaultMonth={state.start_date ? parseISO(state.start_date) : undefined}
                  />
                </PopoverContent>
              </Popover>
              {startDateError && <span className="form-field-error">{startDateError}</span>}
              {endDateError   && <span className="form-field-error">{endDateError}</span>}
              {pastWarning    && <span className="trip-form__warning">{pastWarning}</span>}
            </div>

            {/* Tags */}
            <div className="trip-form__field">
              <Label>Tags</Label>
              <TagInput
                tags={state.tags}
                onChange={tags => dispatch({ type: 'set_tags', value: tags })}
                placeholder="Add tags (press Enter or comma)…"
              />
            </div>

            {/* Notes */}
            <div className="trip-form__field">
              <Label htmlFor="trip-notes">Notes</Label>
              <Textarea
                id="trip-notes"
                value={state.notes}
                onChange={e => dispatch({ type: 'set_notes', value: e.target.value })}
                placeholder="Packing reminders, visa info, contacts…"
                rows={3}
              />
            </div>

            {/* Cover gradient */}
            <div className="trip-form__field">
              <Label>Cover colour</Label>
              <div className="trip-form__gradients">
                {GRADIENT_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    className={`trip-form__gradient-swatch${state.cover_gradient === key ? ' trip-form__gradient-swatch--active' : ''}`}
                    onClick={() => dispatch({ type: 'set_cover_gradient', value: key })}
                    title={label}
                    aria-label={`${label} gradient`}
                    // Reason: inline style needed because the gradient value is dynamic per-swatch
                    style={{ background: GRADIENT_CSS[key] }}
                  />
                ))}
              </div>
            </div>

          </form>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} type="button">Cancel</Button>
            <Button
              variant="default"
              onClick={handleSubmit as unknown as React.MouseEventHandler}
              disabled={isSubmitting || (submitAttempted && !isFormValid())}
              type="submit"
            >
              {isSubmitting
                ? <><Spinner className="mr-1.5 size-3.5" />{isEdit ? 'Saving…' : 'Creating…'}</>
                : (isEdit ? 'Save changes' : 'Create trip')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Overlap confirmation */}
      <AlertDialog open={overlapConfirmOpen} onOpenChange={o => { if (!o) setOverlapConfirmOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Date overlap</AlertDialogTitle>
            <AlertDialogDescription>
              These dates overlap with &ldquo;{overlapTrip?.title}&rdquo;. Save anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOverlapConfirmOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { void doSave(); }} disabled={isSubmitting}>
              {isSubmitting ? <><Spinner className="mr-1.5 size-3.5" />Saving…</> : 'Save anyway'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
