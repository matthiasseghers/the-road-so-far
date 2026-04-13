import { useReducer, useEffect, useState, useRef } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import LocationField from '@/components/common/LocationField';
import { useGeocode } from '@/hooks/useGeocode';
import type { Activity } from '@/types/domain';
import type { ActivityType, ActivityRow } from '@/types/db';
import type { CreateActivityInput, UpdateActivityInput } from '@/db/repositories/activities.repo';
import './ActivityFormModal.css';

// ─── Form state ─────────────────────────────────────────────────────────────

interface FormState {
  title: string;
  activity_type: ActivityType;
  start_time: string; // HH:MM or ''
  end_time: string;   // HH:MM or ''
  notes: string;
  location: string;
}

type FormAction =
  | { type: 'SET_FIELD'; field: keyof FormState; value: string }
  | { type: 'RESET'; payload: FormState };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_FIELD': return { ...state, [action.field]: action.value };
    case 'RESET':     return action.payload;
  }
}

function makeBlankForm(): FormState {
  return {
    title:         '',
    activity_type: 'note',
    start_time:    '',
    end_time:      '',
    notes:         '',
    location:      '',
  };
}

function activityToForm(a: Activity): FormState {
  return {
    title:         a.title,
    activity_type: a.activity_type,
    start_time:    a.start_time ?? '',
    end_time:      a.end_time   ?? '',
    notes:         a.notes      ?? '',
    location:      a.data.location ?? '',
  };
}

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

const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: 'attraction', label: '🎯 Attraction' },
  { value: 'food',       label: '🍽️ Food' },
  { value: 'shopping',   label: '🛍️ Shopping' },
  { value: 'outdoors',   label: '🌿 Outdoors' },
  { value: 'cultural',   label: '🏛️ Cultural' },
  { value: 'note',       label: '📝 Note' },
  { value: 'other',      label: '📌 Other' },
];

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

  const [form, dispatch] = useReducer(formReducer, makeBlankForm());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Reason: ref guard ensures a second click while the promise is in-flight is a no-op,
  // guarding against duplicate POSTs on slow networks (the server enforces 1 req/s).
  const submittingRef = useRef(false);
  const geoHook = useGeocode('activities');

  useEffect(() => {
    if (!open) { setSubmitAttempted(false); setIsSubmitting(false); submittingRef.current = false; geoHook.reset(); }
  // Reason: reset geo status when modal closes; geoHook.reset is stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const titleError: string | null =
    submitAttempted && !form.title.trim() ? 'Title is required' : null;

  function isFormValid(): boolean {
    return form.title.trim().length > 0;
  }

  useEffect(() => {
    if (open) {
      dispatch({
        type: 'RESET',
        payload: isEditing ? activityToForm(activity) : makeBlankForm(),
      });
    }
  }, [open, isEditing, activity]);

  function set(field: keyof FormState, value: string): void {
    dispatch({ type: 'SET_FIELD', field, value });
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSubmitAttempted(true);
    if (!isFormValid() || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
    const locationTrimmed = form.location.trim();
    const base = {
      title:         form.title.trim(),
      activity_type: form.activity_type,
      start_time:    form.start_time || null,
      end_time:      form.end_time   || null,
      notes:         form.notes.trim() || null,
      location:      locationTrimmed || null,
      // Reason: clear stale coordinates when location is cleared.
      ...(locationTrimmed ? {} : { lat: null, lng: null }),
    };

    let savedRow: ActivityRow;
    if (isEditing) {
      savedRow = await onSave(base as UpdateActivityInput, activity.id);
    } else {
      savedRow = await onSave({ ...base, day_id: dayId ?? null, trip_id: tripId } as CreateActivityInput);
    }

    if (locationTrimmed) {
      await geoHook.geocode(savedRow.id, locationTrimmed);
      onGeocodeDone?.();
      // Reason: brief pause so user sees geocode status before modal closes.
      await new Promise<void>(resolve => { setTimeout(resolve, 800); });
    }

    onClose();
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  const footer = (
    <>
      <Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button
        variant="default"
        disabled={isSubmitting || (submitAttempted && !isFormValid())}
        onClick={e => { void handleSubmit(e as unknown as React.FormEvent); }}
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
        <form className="activity-form pb-1" onSubmit={e => { void handleSubmit(e); }}>
          {/* Title */}
          <div className="activity-form__field activity-form__field--required">
            <Label htmlFor="af-title">Title</Label>
            <Input
              id="af-title"
              aria-invalid={!!titleError}
              type="text"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Activity name"
              autoFocus
            />
            {titleError && <span className="form-field-error">{titleError}</span>}
          </div>

          {/* Activity type */}
          <div className="activity-form__field">
            <Label htmlFor="af-type">Type</Label>
            <Select value={form.activity_type} onValueChange={v => set('activity_type', v)}>
              <SelectTrigger id="af-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time window */}
          <div className="activity-form__row">
            <div className="activity-form__field">
              <Label htmlFor="af-start-time">Start time</Label>
              <Input
                id="af-start-time"
                className="activity-form__input--time"
                type="time"
                value={form.start_time}
                onChange={e => set('start_time', e.target.value)}
              />
            </div>
            <div className="activity-form__field">
              <Label htmlFor="af-end-time">End time</Label>
              <Input
                id="af-end-time"
                className="activity-form__input--time"
                type="time"
                value={form.end_time}
                onChange={e => set('end_time', e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="activity-form__field">
            <Label htmlFor="af-notes">Notes</Label>
            <Textarea
              id="af-notes"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Any extra details…"
              rows={3}
            />
          </div>
          {/* Location (geocodable place for the map) */}
          <LocationField
            value={form.location}
            onChange={val => set('location', val)}
            status={geoHook.status}
          />
        </form>
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
