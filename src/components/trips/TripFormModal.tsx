import { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import TagInput from '@/components/ui/TagInput';
import { CalendarIcon, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { todayISO, dateRangesOverlap } from '@/utils/dates';
import { CreateTripSchema } from '@/schemas/trip.schema';
import type { CreateTripInput } from '@/schemas/trip.schema';
import type { Trip } from '@/types/domain';
import type { TripStatus } from '@/types/db';
import type { UpdateTripInput } from '@/db/repositories/trips.repo';
import { getConfiguredProviders, searchCoverPhotos, downloadCoverPhoto, removeCoverPhoto } from '@/db/api-client';
import type { ImageSearchResult, ConfiguredProvider } from '@/db/api-client';
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

  // ── Cover photo state ─────────────────────────────────────────────────────
  // coverTab tracks whether the user is on 'gradient' or 'photo' tab in the picker.
  // We keep it in local state so switching tab doesn't fire API calls.
  const [coverTab,            setCoverTab]            = useState<'gradient' | 'photo'>('gradient');
  const [providers,           setProviders]           = useState<ConfiguredProvider[]>([]);
  const [activeProvider,      setActiveProvider]      = useState<string>('');
  const [photoQuery,          setPhotoQuery]          = useState('');
  const [photoSearchLoading,  setPhotoSearchLoading]  = useState(false);
  const [photoResults,        setPhotoResults]        = useState<ImageSearchResult[]>([]);
  const [photoPage,           setPhotoPage]           = useState(1);
  const [photoTotalPages,     setPhotoTotalPages]     = useState(1);
  const [photoError,          setPhotoError]          = useState<string | null>(null);
  const [selectedPhoto,       setSelectedPhoto]       = useState<ImageSearchResult | null>(null);
  const [downloadingPhoto,    setDownloadingPhoto]    = useState(false);
  const photoQueryRef = useRef(photoQuery);

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
      // Seed cover tab from current trip cover_type.
      setCoverTab(trip?.cover_type ?? 'gradient');
      setSelectedPhoto(null);
      setPhotoResults([]);
      setPhotoQuery('');
      setPhotoError(null);
      // Load configured image providers when the modal opens.
      getConfiguredProviders()
        .then(r => {
          setProviders(r.providers);
          if (r.providers.length > 0 && !activeProvider) {
            setActiveProvider(r.providers[0].id);
          }
        })
        .catch(() => setProviders([]));
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
    if (coverTab === 'photo' && selectedPhoto && trip) {
      // Download and attach the selected photo, then update trip.
      setDownloadingPhoto(true);
      try {
        await downloadCoverPhoto(trip.id, selectedPhoto.fullUrl, selectedPhoto.provider, selectedPhoto.attribution);
      } finally {
        setDownloadingPhoto(false);
      }
    } else if (coverTab === 'gradient' && trip?.cover_type === 'photo') {
      // Switching back to gradient — delete the stored photo.
      try { await removeCoverPhoto(trip.id); } catch { /* non-fatal */ }
    }

    if (isEdit) {
      // Pass cover_type so the repo sets it correctly.
      await onUpdate(trip.id, {
        ...data,
        cover_type: coverTab === 'photo' && trip?.cover_image_path ? 'photo' : 'gradient',
      } as UpdateTripInput);
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

  async function runPhotoSearch(provider: string, query: string, page: number): Promise<void> {
    if (!query.trim()) return;
    setPhotoSearchLoading(true);
    setPhotoError(null);
    try {
      const result = await searchCoverPhotos(provider, query, page);
      setPhotoResults(result.photos);
      setPhotoPage(result.currentPage);
      setPhotoTotalPages(result.totalPages);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Search failed');
      setPhotoResults([]);
    } finally {
      setPhotoSearchLoading(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{titleLabel}</DialogTitle>
          </DialogHeader>

          <DialogBody>
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

            {/* Cover — Gradient | Photo tabs */}
            <div className="trip-form__field">
              <Label>Cover</Label>
              {/* Tab switcher */}
              <ToggleGroup
                type="single"
                value={coverTab}
                onValueChange={v => { if (v) setCoverTab(v as 'gradient' | 'photo'); }}
                variant="outline"
                size="sm"
                className="justify-start"
              >
                <ToggleGroupItem value="gradient">Gradient</ToggleGroupItem>
                <ToggleGroupItem value="photo">Photo</ToggleGroupItem>
              </ToggleGroup>

              {/* Gradient picker */}
              {coverTab === 'gradient' && (
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
                          style={{ background: GRADIENT_CSS[key] }}
                        />
                      ))}
                    </div>
                  )}
                />
              )}

              {/* Photo picker */}
              {coverTab === 'photo' && (
                <div className="trip-form__photo-picker">
                  {providers.length === 0 ? (
                    <p className="trip-form__photo-hint">
                      No image providers configured. Add an API key in{' '}
                      <strong>Settings → Services</strong>.
                    </p>
                  ) : (
                    <>
                      {/* Provider tabs */}
                      {providers.length > 1 && (
                        <ToggleGroup
                          type="single"
                          value={activeProvider}
                          onValueChange={v => {
                            if (!v) return;
                            setActiveProvider(v);
                            setPhotoResults([]);
                            setPhotoPage(1);
                          }}
                          variant="outline"
                          size="sm"
                          className="justify-start"
                        >
                          {providers.map(p => (
                            <ToggleGroupItem key={p.id} value={p.id}>{p.label}</ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      )}

                      {/* Search box */}
                      <div className="trip-form__photo-search">
                        <Input
                          placeholder="Search photos…"
                          value={photoQuery}
                          onChange={e => { setPhotoQuery(e.target.value); photoQueryRef.current = e.target.value; }}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void runPhotoSearch(activeProvider, photoQuery, 1); } }}
                          aria-label="Photo search query"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void runPhotoSearch(activeProvider, photoQuery, 1)}
                          disabled={photoSearchLoading}
                          aria-label="Search"
                        >
                          {photoSearchLoading ? <Spinner className="size-3.5" /> : <Search size={14} />}
                        </Button>
                      </div>

                      {/* Error */}
                      {photoError && (
                        <p className="trip-form__photo-error">{photoError}</p>
                      )}

                      {/* Current photo preview for photo-type trips */}
                      {!photoResults.length && !photoSearchLoading && trip?.cover_type === 'photo' && trip.cover_image_path && !selectedPhoto && (
                        <div className="trip-form__current-photo">
                          <img
                            src={`/covers/${encodeURIComponent(trip.cover_image_path)}`}
                            alt="Current cover"
                            className="trip-form__current-photo-img"
                          />
                          <p className="trip-form__photo-attr">{trip.cover_image_attribution}</p>
                        </div>
                      )}

                      {/* Results grid */}
                      {photoResults.length > 0 && (
                        <div className="trip-form__photo-grid">
                          {photoResults.map(photo => (
                            <button
                              key={photo.id}
                              type="button"
                              className={`trip-form__photo-thumb${selectedPhoto?.id === photo.id ? ' trip-form__photo-thumb--selected' : ''}`}
                              onClick={() => setSelectedPhoto(prev => prev?.id === photo.id ? null : photo)}
                              title={photo.attribution}
                            >
                              <img src={photo.thumbUrl} alt={photo.altText ?? ''} loading="lazy" />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Pagination */}
                      {photoTotalPages > 1 && photoResults.length > 0 && (
                        <div className="trip-form__photo-pagination">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={photoPage <= 1 || photoSearchLoading}
                            onClick={() => void runPhotoSearch(activeProvider, photoQuery, photoPage - 1)}
                            aria-label="Previous page"
                          >
                            <ChevronLeft size={14} />
                          </Button>
                          <span className="trip-form__photo-page">
                            {photoPage} / {photoTotalPages}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={photoPage >= photoTotalPages || photoSearchLoading}
                            onClick={() => void runPhotoSearch(activeProvider, photoQuery, photoPage + 1)}
                            aria-label="Next page"
                          >
                            <ChevronRight size={14} />
                          </Button>
                        </div>
                      )}

                      {/* Selected photo attribution */}
                      {selectedPhoto && (
                        <p className="trip-form__photo-attr">{selectedPhoto.attribution}</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

          </form>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} type="button">Cancel</Button>
            <Button
              variant="default"
              onClick={handleSubmit(onValidWithOverlap)}
              disabled={isSubmitting || downloadingPhoto}
              type="submit"
            >
              {isSubmitting || downloadingPhoto
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
