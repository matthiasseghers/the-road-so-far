import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import type { CreateTripInput } from '@/schemas/trip.schema';
import type { Trip } from '@/types/domain';
import type { TripStatus } from '@/types/db';
import type { UpdateTripInput } from '@/db/repositories/trips.repo';
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDefaultValues(trip?: Trip): CreateTripInput {
  return {
    title:          trip?.title          ?? '',
    emoji:          trip?.emoji          ?? '🗺️',
    status:         trip?.status         ?? 'planning',
    start_date:     trip?.start_date     ?? '',
    end_date:       trip?.end_date       ?? '',
    tags:           trip?.tags           ?? [],
    cover_gradient: trip?.cover_gradient ?? 'warm-brown',
    notes:          trip?.notes          ?? undefined,
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
  const isEdit = trip !== undefined;
  const titleLabel = isEdit ? 'Edit trip' : 'New trip';

  const [overlapConfirmOpen, setOverlapConfirmOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof CreateTripSchema>, unknown, CreateTripInput>({
    resolver: zodResolver(CreateTripSchema),
    defaultValues: buildDefaultValues(trip),
  });

  // Reason: re-seed form fields whenever the modal opens or trip prop changes.
  // react-hook-form holds its own state so reset() is the correct way to sync.
  useEffect(() => {
    if (open) {
      reset(buildDefaultValues(trip));
    } else {
      setOverlapConfirmOpen(false);
    }
  }, [open, trip, reset]);

  // Reason: trip.notes can be updated inline without opening this modal.
  // Keep the notes field in sync with the prop so the modal shows current data.
  useEffect(() => {
    reset((prev) => ({ ...prev, notes: trip?.notes ?? undefined }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.notes]);

  const watchedStartDate = watch('start_date');
  const watchedEndDate   = watch('end_date');

  const pastWarning: string | null =
    watchedEndDate && watchedEndDate < todayISO()
      ? "This trip's dates are in the past — is that intentional?"
      : null;

  // Reason: blocking overlap check — user must confirm before saving when dates collide.
  function findOverlapTrip(startDate: string, endDate: string): Trip | null {
    if (!startDate || !endDate) return null;
    return allTrips.find(t => {
      if (t.id === trip?.id) return false;
      if (!t.start_date || !t.end_date) return false;
      return dateRangesOverlap(
        { start: startDate, end: endDate },
        { start: t.start_date, end: t.end_date },
      );
    }) ?? null;
  }

  // Before/after: submit handler comparison
  // BEFORE: handleSubmit(e) { e.preventDefault(); setSubmitAttempted(true); if (!schemaResult.success) return;
  //         if (overlapTrip) { setOverlapConfirmOpen(true); return; } ... submittingRef.current = true; ... }
  // AFTER:  onValidWithOverlap(data) receives pre-validated CreateTripInput. isSubmitting is managed by RHF.
  //         Overlap check remains as plain state — it is not a Zod concern.

  async function doSave(data: CreateTripInput): Promise<void> {
    if (isEdit) {
      await onUpdate(trip.id, data);
    } else {
      await onCreate?.(data);
    }
    setOverlapConfirmOpen(false);
    onClose();
  }

  // Capture form values at the moment the overlap confirm is triggered so the
  // "Save anyway" button can call doSave with the same data.
  const [pendingData, setPendingData] = useState<CreateTripInput | null>(null);

  async function onValidWithOverlap(data: CreateTripInput): Promise<void> {
    const overlapTrip = findOverlapTrip(data.start_date, data.end_date);
    if (overlapTrip) {
      setPendingData(data);
      setOverlapConfirmOpen(true);
      return;
    }
    await doSave(data);
  }

  const overlapTrip = findOverlapTrip(watchedStartDate, watchedEndDate);

  return (
    <>
      <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{titleLabel}</DialogTitle>
          </DialogHeader>

          <form className="trip-form pb-1" onSubmit={handleSubmit(onValidWithOverlap)}>

            {/* Title */}
            <div className="trip-form__field trip-form__field--required">
              <Label htmlFor="trip-title">Trip title</Label>
              <div className="trip-form__title-row">
                {/* Controller: emoji Input doesn't need special treatment but maxLength
                    is not a register() constraint — keeping as controlled via register */}
                <Input
                  id="trip-emoji"
                  className="trip-form__emoji-input"
                  type="text"
                  maxLength={4}
                  aria-label="Trip emoji"
                  {...register('emoji')}
                />
                <Input
                  id="trip-title"
                  aria-invalid={!!errors.title}
                  type="text"
                  placeholder="e.g. Pacific Coast Highway"
                  autoFocus
                  {...register('title')}
                />
              </div>
              {errors.title && <span className="form-field-error">{errors.title.message}</span>}
            </div>

            {/* Status — Controller required: shadcn Select is not a native input */}
            <div className="trip-form__field">
              <Label htmlFor="trip-status">Status</Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="trip-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(s => (
                        <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Dates — Controller required: shadcn Calendar range picker */}
            <div className="trip-form__field trip-form__field--required">
              <Label>Trip dates</Label>
              <Controller
                name="start_date"
                control={control}
                render={({ field: startField }) => (
                  <Controller
                    name="end_date"
                    control={control}
                    render={({ field: endField }) => (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            aria-invalid={!!(errors.start_date || errors.end_date)}
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !startField.value && 'text-muted-foreground',
                            )}
                          >
                            <CalendarIcon className="mr-2 size-4 opacity-70" />
                            {startField.value && endField.value
                              ? `${format(parseISO(startField.value), 'd MMM yyyy')} – ${format(parseISO(endField.value), 'd MMM yyyy')}`
                              : startField.value
                              ? `${format(parseISO(startField.value), 'd MMM yyyy')} – pick end`
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
                              from: startField.value ? parseISO(startField.value) : undefined,
                              to:   endField.value   ? parseISO(endField.value)   : undefined,
                            }}
                            onSelect={range => {
                              startField.onChange(range?.from ? format(range.from, 'yyyy-MM-dd') : '');
                              endField.onChange(range?.to   ? format(range.to,   'yyyy-MM-dd') : '');
                            }}
                            defaultMonth={startField.value ? parseISO(startField.value) : undefined}
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  />
                )}
              />
              {errors.start_date && <span className="form-field-error">{errors.start_date.message}</span>}
              {errors.end_date   && <span className="form-field-error">{errors.end_date.message}</span>}
              {pastWarning       && <span className="trip-form__warning">{pastWarning}</span>}
            </div>

            {/* Tags — Controller required: custom TagInput component */}
            <div className="trip-form__field">
              <Label>Tags</Label>
              <Controller
                name="tags"
                control={control}
                render={({ field }) => (
                  <TagInput
                    tags={field.value ?? []}
                    onChange={field.onChange}
                    placeholder="Add tags (press Enter or comma)…"
                  />
                )}
              />
            </div>

            {/* Notes */}
            <div className="trip-form__field">
              <Label htmlFor="trip-notes">Notes</Label>
              <Textarea
                id="trip-notes"
                placeholder="Packing reminders, visa info, contacts…"
                rows={3}
                {...register('notes')}
              />
            </div>

            {/* Cover gradient — Controller required: custom swatch buttons */}
            <div className="trip-form__field">
              <Label>Cover colour</Label>
              <Controller
                name="cover_gradient"
                control={control}
                render={({ field }) => (
                  <div className="trip-form__gradients">
                    {GRADIENT_OPTIONS.map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        className={`trip-form__gradient-swatch${field.value === key ? ' trip-form__gradient-swatch--active' : ''}`}
                        onClick={() => field.onChange(key)}
                        title={label}
                        aria-label={`${label} gradient`}
                        // Reason: inline style needed because the gradient value is dynamic per-swatch
                        style={{ background: GRADIENT_CSS[key] }}
                      />
                    ))}
                  </div>
                )}
              />
            </div>

          </form>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} type="button">Cancel</Button>
            <Button
              variant="default"
              onClick={handleSubmit(onValidWithOverlap)}
              disabled={isSubmitting}
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
            <AlertDialogAction
              onClick={() => { if (pendingData) void doSave(pendingData); }}
              disabled={isSubmitting}
            >
              {isSubmitting ? <><Spinner className="mr-1.5 size-3.5" />Saving…</> : 'Save anyway'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
