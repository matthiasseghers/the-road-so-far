import { useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import LocationField from '@/components/common/LocationField';
import type { StructuredAddress } from '@/components/common/LocationField';
import ActivityTypeToggle from './ActivityTypeToggle';
import { useGeocode } from '@/hooks/useGeocode';
import type { Activity } from '@/types/domain';
import type { ActivityRow } from '@/types/db';
import type { CreateActivityInput, UpdateActivityInput } from '@/db/repositories/activities.repo';
import { ActivityBaseSchema } from '@/schemas/activity.schema';
import './ActivityFormModal.css';

// ─── Form schema ──────────────────────────────────────────────────────────────
// Reason: the full CreateActivitySchema includes server-only fields (trip_id,
// day_id, sort_order) AND has a .refine() on it. Zod disallows .pick() on
// refined schemas, so we pick from ActivityBaseSchema (pre-refinement) and
// re-add the end_time cross-field check ourselves.

const ActivityFormSchema = ActivityBaseSchema
  .pick({
    title:            true,
    activity_type_id: true,
    start_time:       true,
    end_time:         true,
    notes:            true,
    location:         true,
  })
  .refine(
    d => !(d.end_time && !d.start_time),
    { message: 'end_time requires start_time', path: ['end_time'] },
  );

type ActivityFormValues = z.infer<typeof ActivityFormSchema>;
type ActivityFormInput  = z.input<typeof ActivityFormSchema>;

// ─── Component ───────────────────────────────────────────────────────────────

interface ActivityFormModalProps {
  open: boolean;
  onClose: () => void;
  activity?: Activity | null;
  dayId?: number;
  tripId: number;
  onSave: (input: CreateActivityInput | UpdateActivityInput, id?: number) => Promise<ActivityRow>;
  onGeocodeDone?: () => void;
}

function buildDefaultValues(activity?: Activity | null): ActivityFormValues {
  return {
    title:            activity?.title              ?? '',
    activity_type_id: activity?.activity_type_id   ?? 1,
    start_time:       activity?.start_time         ?? null,
    end_time:         activity?.end_time           ?? null,
    notes:            activity?.notes              ?? null,
    location:         activity?.data.location      ?? null,
  };
}

export default function ActivityFormModal({
  open,
  onClose,
  activity,
  dayId,
  tripId,
  onSave,
  onGeocodeDone,
}: ActivityFormModalProps): JSX.Element {
  const isEditing = activity != null;

  // Reason: store coordinates from autocomplete selection so the geocode call
  // can skip the Nominatim round-trip and use them directly.
  const coordsRef = useRef<{ lat: number; lng: number } | undefined>(undefined);
  const addressRef = useRef<StructuredAddress | undefined>(undefined);
  const geoHook = useGeocode('activities');

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ActivityFormInput, unknown, ActivityFormValues>({
    resolver: zodResolver(ActivityFormSchema),
    defaultValues: buildDefaultValues(activity),
  });

  useEffect(() => {
    if (open) {
      reset(buildDefaultValues(activity));
      coordsRef.current = undefined;
      addressRef.current = undefined;
      geoHook.reset();
    }
  // Reason: geoHook.reset is stable; only open/activity trigger a re-seed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activity, reset]);

  // Before: handleSubmit(e) { e.preventDefault(); setSubmitAttempted(true);
  //   if (!isFormValid() || submittingRef.current) return; submittingRef.current = true;
  //   setIsSubmitting(true); try { ... } finally { submittingRef.current = false; setIsSubmitting(false); } }
  // After: onValid(data) receives pre-validated values; isSubmitting managed by RHF.
  //   No submittingRef needed — RHF prevents double-submit while isSubmitting is true.
  async function onValid(data: ActivityFormValues): Promise<void> {
    const locationTrimmed = data.location?.trim() ?? '';
    const base = {
      title:            data.title.trim(),
      activity_type_id: data.activity_type_id,
      start_time:       data.start_time || null,
      end_time:         data.end_time   || null,
      notes:         data.notes?.trim() || null,
      location:      locationTrimmed || null,
      // Reason: clear stale coordinates when location is cleared.
      ...(locationTrimmed ? {} : { lat: null, lng: null }),
      address_street:      addressRef.current?.addressStreet      ?? null,
      address_number:      addressRef.current?.addressNumber      ?? null,
      address_postal_code: addressRef.current?.addressPostalCode  ?? null,
      address_city:        addressRef.current?.addressCity        ?? null,
      address_country:     addressRef.current?.addressCountry     ?? null,
    };

    let savedRow: ActivityRow;
    if (isEditing) {
      savedRow = await onSave(base, activity.id);
    } else {
      savedRow = await onSave({ ...base, day_id: dayId ?? null, trip_id: tripId });
    }

    if (locationTrimmed) {
      await geoHook.geocode(savedRow.id, locationTrimmed, coordsRef.current);
      onGeocodeDone?.();
      // Reason: brief pause so user sees geocode status before modal closes.
      /** Brief pause so the geocode success indicator is visible before
       *  the modal dismisses. Purely cosmetic — not a real async wait. */
      const GEOCODE_FEEDBACK_DELAY_MS = 800;
      await new Promise<void>(resolve => { setTimeout(resolve, GEOCODE_FEEDBACK_DELAY_MS); });
    }

    onClose();
  }

  const footer = (
    <>
      <Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button
        variant="default"
        disabled={isSubmitting}
        onClick={() => { void handleSubmit(onValid)(); }}
      >
        {isSubmitting
          ? <><Spinner className="mr-1.5 size-3.5" />{isEditing ? 'Saving…' : 'Adding…'}</>
          : (isEditing ? 'Save changes' : 'Add activity')}
      </Button>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit activity' : 'New activity'}</DialogTitle>
        </DialogHeader>
        <DialogBody>
        <form className="activity-form pb-1" onSubmit={(e) => { void handleSubmit(onValid)(e); }}>
          {/* Title */}
          <div className="activity-form__field activity-form__field--required">
            <Label htmlFor="af-title">Title</Label>
            <Input
              id="af-title"
              aria-invalid={!!errors.title}
              type="text"
              placeholder="Activity name"
              autoFocus
              {...register('title')}
            />
            {errors.title && <span className="form-field-error">{errors.title.message}</span>}
          </div>

          {/* Activity type — ToggleGroup chips with manage-types button */}
          <div className="activity-form__field">
            <Label>Type</Label>
            <Controller
              name="activity_type_id"
              control={control}
              render={({ field }) => (
                <ActivityTypeToggle value={field.value} onChange={field.onChange} />
              )}
            />
          </div>

          {/* Location — Controller required: custom LocationField component */}
          <Controller
            name="location"
            control={control}
            render={({ field }) => (
              <LocationField
                value={field.value ?? ''}
                onChange={val => { coordsRef.current = undefined; addressRef.current = undefined; field.onChange(val); }}
                onCoordinates={(lat, lng) => { coordsRef.current = { lat, lng }; }}
                onStructuredAddress={a => { addressRef.current = a; }}
                status={geoHook.status}
              />
            )}
          />

          {/* Time window */}
          <div className="activity-form__row">
            <div className="activity-form__field">
              <Label htmlFor="af-start-time">Start time</Label>
              <Input
                id="af-start-time"
                className="activity-form__input--time"
                type="time"
                {...register('start_time')}
              />
            </div>
            <div className="activity-form__field">
              <Label htmlFor="af-end-time">End time</Label>
              <Input
                id="af-end-time"
                className="activity-form__input--time"
                type="time"
                {...register('end_time')}
              />
              {errors.end_time && <span className="form-field-error">{errors.end_time.message}</span>}
            </div>
          </div>

          {/* Notes */}
          <div className="activity-form__field">
            <Label htmlFor="af-notes">Notes</Label>
            <Textarea
              id="af-notes"
              placeholder="Any extra details…"
              rows={3}
              {...register('notes')}
            />
          </div>
        </form>
        </DialogBody>
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
