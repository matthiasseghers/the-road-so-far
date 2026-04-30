import { useReducer, useEffect, useState, useRef } from 'react';
import { BedDouble, Plane, Train, Bus, Ship, Car, Utensils, Tag, Camera, ShoppingBag, TreePine, Landmark, FileText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import LocationField from '@/components/common/LocationField';
import { useGeocode } from '@/hooks/useGeocode';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/db/api-client';
import type { Reservation } from '@/domain/Reservation';
import type { Activity } from '@/domain/Activity';
import type { ReservationType, ActivityType } from '@/types/db';
import type { CreateReservationInput } from '@/hooks/useReservations';
import type { CreateActivityInput } from '@/db/repositories/activities.repo';
import { CreateReservationSchema } from '@/schemas/reservation.schema';
import { CreateActivitySchema } from '@/schemas/activity.schema';
import './ReservationFormModal.css';

// ── Category / type selection ────────────────────────────────────────────────

type CategorySelection = 'activity' | 'reservation';

// Step 2b has 6 chips; "transit" groups train/bus/ferry
type Step2bChip = 'lodging' | 'flight' | 'transit' | 'rental_car' | 'restaurant' | 'other';
const TRANSIT_TYPES: ReservationType[] = ['train', 'bus', 'ferry'];

function chipForType(type: ReservationType): Step2bChip {
  if (TRANSIT_TYPES.includes(type)) return 'transit';
  return type as Step2bChip;
}

interface Step2bChipDef {
  value: Step2bChip;
  label: string;
  sub: string;
  icon: LucideIcon;
  defaultType: ReservationType;
}

const STEP2B_CHIPS: Step2bChipDef[] = [
  { value: 'lodging',    label: 'Lodging',     sub: 'Hotel, hostel, Airbnb',   icon: BedDouble,  defaultType: 'lodging' },
  { value: 'flight',     label: 'Flight',       sub: 'Any airline booking',     icon: Plane,      defaultType: 'flight' },
  { value: 'transit',    label: 'Transit',      sub: 'Train, bus, or ferry',    icon: Train,      defaultType: 'train' },
  { value: 'rental_car', label: 'Rental car',   sub: 'Pick-up and drop-off',    icon: Car,        defaultType: 'rental_car' },
  { value: 'restaurant', label: 'Restaurant',   sub: 'Table booking with time', icon: Utensils,   defaultType: 'restaurant' },
  { value: 'other',      label: 'Other',        sub: 'Tours, tickets, events',  icon: Tag,        defaultType: 'other' },
];

// ── Activity form state ───────────────────────────────────────────────────────

interface ActivityFormState {
  title: string;
  activity_type: ActivityType;
  start_time: string;
  end_time: string;
  notes: string;
  location: string;
}

const BLANK_ACTIVITY: ActivityFormState = {
  title: '',
  activity_type: 'note',
  start_time: '',
  end_time: '',
  notes: '',
  location: '',
};

const ACTIVITY_TYPE_OPTIONS: { value: ActivityType; label: string; icon: LucideIcon }[] = [
  { value: 'attraction', label: 'Attraction',  icon: Camera },
  { value: 'food',       label: 'Food',        icon: Utensils },
  { value: 'shopping',   label: 'Shopping',    icon: ShoppingBag },
  { value: 'outdoors',   label: 'Outdoors',    icon: TreePine },
  { value: 'cultural',   label: 'Cultural',    icon: Landmark },
  { value: 'note',       label: 'Note',        icon: FileText },
  { value: 'other',      label: 'Other',       icon: Tag },
];

// ── Reservation form state ────────────────────────────────────────────────────

// Generic record for flexible per-type detail fields
type DetailsState = Record<string, string>;

interface ReservationFormState {
  status: 'pending' | 'confirmed' | 'cancelled';
  confirmation_ref: string;
  notes: string;
  cost_amount: string;
  cost_currency: string;
  details: DetailsState;
  location: string;
}

const BLANK_RESERVATION: ReservationFormState = {
  status: 'pending',
  confirmation_ref: '',
  notes: '',
  cost_amount: '',
  cost_currency: 'EUR',
  details: {},
  location: '',
};

// ── Per-type detail field definitions ─────────────────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  type?: 'text' | 'date' | 'time' | 'number';
  required?: boolean;
  placeholder?: string;
}

// Reason: train, bus, and ferry share identical field definitions — only the
// type key differs. A shared constant keeps them in sync.
const TRANSIT_FIELDS: FieldDef[] = [
  { key: 'from_stop', label: 'From', required: true },
  { key: 'from_date', label: 'Depart date', type: 'date', required: true },
  { key: 'from_time', label: 'Depart time', type: 'time' },
  { key: 'to_stop',   label: 'To',   required: true },
  { key: 'to_date',   label: 'Arrive date', type: 'date', required: true },
  { key: 'to_time',   label: 'Arrive time', type: 'time' },
  { key: 'carrier',   label: 'Carrier' },
];

const RESERVATION_TYPE_FIELDS: Record<ReservationType, FieldDef[]> = {
  lodging: [
    { key: 'property_name',  label: 'Property name',  required: true },
    { key: 'check_in_date',  label: 'Check-in date',  type: 'date', required: true },
    { key: 'check_in_time',  label: 'Check-in time',  type: 'time' },
    { key: 'check_out_date', label: 'Check-out date', type: 'date', required: true },
    { key: 'check_out_time', label: 'Check-out time', type: 'time' },
  ],
  flight: [
    { key: 'airline',        label: 'Airline',        required: true },
    { key: 'flight_number',  label: 'Flight number',  required: true },
    { key: 'depart_airport', label: 'From airport' },
    { key: 'depart_date',    label: 'Depart date',    type: 'date', required: true },
    { key: 'depart_time',    label: 'Depart time',    type: 'time' },
    { key: 'arrive_airport', label: 'To airport' },
    { key: 'arrive_date',    label: 'Arrive date',    type: 'date', required: true },
    { key: 'arrive_time',    label: 'Arrive time',    type: 'time' },
  ],
  train:  TRANSIT_FIELDS,
  bus:    TRANSIT_FIELDS,
  ferry:  TRANSIT_FIELDS,
  rental_car: [
    { key: 'company',          label: 'Company',         required: true },
    { key: 'pickup_location',  label: 'Pick-up location', required: true },
    { key: 'pickup_date',      label: 'Pick-up date',    type: 'date', required: true },
    { key: 'pickup_time',      label: 'Pick-up time',    type: 'time' },
    { key: 'dropoff_location', label: 'Drop-off location', required: true },
    { key: 'dropoff_date',     label: 'Drop-off date',   type: 'date', required: true },
    { key: 'dropoff_time',     label: 'Drop-off time',   type: 'time' },
    { key: 'vehicle_type',     label: 'Vehicle type' },
  ],
  restaurant: [
    { key: 'restaurant_name', label: 'Restaurant name', required: true },
    { key: 'date',            label: 'Date',             type: 'date', required: true },
    { key: 'time',            label: 'Time',             type: 'time', required: true },
    { key: 'party_size',      label: 'Party size',       type: 'number' },
  ],
  other: [
    { key: 'description', label: 'Description' },
  ],
};

// Reason: single source of truth for which details field holds the reference date
// used to place a reservation on the correct day. Derived from RESERVATION_TYPE_FIELDS
// so adding a new type only requires updating that definition.
const RESERVATION_TYPE_DATE_KEY: Partial<Record<ReservationType, string>> = Object.fromEntries(
  (Object.entries(RESERVATION_TYPE_FIELDS) as [ReservationType, FieldDef[]][]).flatMap(
    ([type, fields]) => {
      // Reason: prefer the first required date field as the canonical reference date.
      const dateField = fields.find(f => f.type === 'date' && f.required);
      return dateField ? [[type, dateField.key]] : [];
    },
  ),
) as Partial<Record<ReservationType, string>>;

const TYPE_LABELS: Record<ReservationType, string> = {
  lodging:    'Lodging',
  flight:     'Flight',
  train:      'Train',
  bus:        'Bus',
  ferry:      'Ferry',
  rental_car: 'Rental car',
  restaurant: 'Restaurant',
  other:      'Other',
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface ReservationFormModalProps {
  open: boolean;
  onClose: () => void;
  tripId: number;
  dayId?: number | null;
  editingReservation?: Reservation | null;
  editingActivity?: Activity | null;
  /** If set, skip step 1 and go directly to the activity or reservation flow. */
  defaultCategory?: CategorySelection | null;
  /** If set, skip steps 1+2 and open directly to this reservation type's form. */
  initialType?: ReservationType | null;
  onCreateReservation: (input: CreateReservationInput) => Promise<Reservation>;
  onCreateActivity: (input: CreateActivityInput) => Promise<Activity | void>;
  onUpdateReservation?: (id: number, input: CreateReservationInput) => Promise<Reservation>;
  onUpdateActivity?: (id: number, input: Partial<CreateActivityInput>) => Promise<Activity | void>;
  /** Trip days used to derive the correct day_id from reservation date fields. */
  days?: { id: number; date: string }[];
  onGeocodeDone?: () => void;
}

// ── Step indicator ────────────────────────────────────────────────────────────

// ── Activity sub-form ─────────────────────────────────────────────────────────

function ActivitySubForm({
  form,
  onChange,
  errors,
  locationStatus,
  onLocationCoordinates,
}: {
  form: ActivityFormState;
  onChange: (field: keyof ActivityFormState, value: string) => void;
  errors: Partial<Record<keyof ActivityFormState, string>>;
  locationStatus: ReturnType<typeof useGeocode>['status'];
  onLocationCoordinates?: (lat: number, lng: number) => void;
}): JSX.Element {
  return (
    <div className="rfm__form">
      <div className="rfm__field rfm__field--required">
        <Label htmlFor="rfm-act-title">Title</Label>
        <Input
          id="rfm-act-title"
          aria-invalid={!!errors.title}
          type="text"
          value={form.title}
          onChange={e => onChange('title', e.target.value)}
          placeholder="e.g. Visit the Colosseum"
          autoFocus
        />
        {errors.title && <span className="form-field-error">{errors.title}</span>}
      </div>

      <div className="rfm__field">
        <Label htmlFor="rfm-act-type">Type</Label>
        <Select value={form.activity_type} onValueChange={v => onChange('activity_type', v)}>
          <SelectTrigger id="rfm-act-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTIVITY_TYPE_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>
                <span className="flex items-center gap-1.5"><o.icon size={13} />{o.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rfm__row">
        <div className="rfm__field">
          <Label htmlFor="rfm-start-time">Start time</Label>
          <Input
            id="rfm-start-time"
            type="time"
            value={form.start_time}
            onChange={e => onChange('start_time', e.target.value)}
          />
        </div>
        <div className="rfm__field">
          <Label htmlFor="rfm-end-time">End time</Label>
          <Input
            id="rfm-end-time"
            type="time"
            value={form.end_time}
            onChange={e => onChange('end_time', e.target.value)}
          />
        </div>
      </div>

      <div className="rfm__field">
        <Label htmlFor="rfm-act-notes">Notes</Label>
        <Textarea
          id="rfm-act-notes"
          value={form.notes}
          onChange={e => onChange('notes', e.target.value)}
          placeholder="Any details…"
          rows={3}
        />
      </div>

      <LocationField
        value={form.location}
        onChange={val => onChange('location', val)}
        onCoordinates={onLocationCoordinates}
        status={locationStatus}
      />
    </div>
  );
}

// ── Reservation sub-form ──────────────────────────────────────────────────────

function ReservationSubForm({
  resType,
  form,
  onField,
  onShared,
  onTransitTypeChange,
  errors,
  apiError,
  locationStatus,
  onLocationCoordinates,
}: {
  resType: ReservationType;
  form: ReservationFormState;
  onField: (key: string, value: string) => void;
  onShared: (field: keyof ReservationFormState, value: string) => void;
  onTransitTypeChange: (t: ReservationType) => void;
  errors: Record<string, string>;
  apiError: string | null;
  locationStatus: ReturnType<typeof useGeocode>['status'];
  onLocationCoordinates?: (lat: number, lng: number) => void;
}): JSX.Element {
  const fields = RESERVATION_TYPE_FIELDS[resType] ?? [];
  const isTransit = TRANSIT_TYPES.includes(resType);

  return (
    <div className="rfm__form">
      {apiError && (
        <div className="rfm__api-error">
          <span>⚠</span>
          <span>{apiError}</span>
        </div>
      )}

      {/* Transit sub-type segmented control */}
      {isTransit && (
        <div className="rfm__field">
          <Label>Transit type</Label>
          {/* Reason: ToggleGroup type=single provides aria-pressed, keyboard nav between
              items, and controlled value/onValueChange — replaces manual active-class buttons */}
          <ToggleGroup
            type="single"
            value={resType}
            onValueChange={v => { if (v) onTransitTypeChange(v as ReservationType); }}
            className="rfm__segment"
          >
            {(['train', 'bus', 'ferry'] as ReservationType[]).map(t => (
              <ToggleGroupItem key={t} value={t} className="rfm__segment-btn">
                <span className="flex items-center gap-1.5">
                  {t === 'train' ? <Train size={13} /> : t === 'bus' ? <Bus size={13} /> : <Ship size={13} />}
                  {t === 'train' ? 'Train' : t === 'bus' ? 'Bus' : 'Ferry'}
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}

      {/* Transit from/to rows: 3-column layout */}
      {isTransit ? (
        <>
          <div className="rfm__field rfm__field--required">
            <Label>From</Label>
            <Input
              aria-invalid={!!errors['from_stop']}
              type="text"
              value={form.details['from_stop'] ?? ''}
              onChange={e => onField('from_stop', e.target.value)}
              placeholder="Departure station / stop"
            />
            {errors['from_stop'] && <span className="form-field-error">{errors['from_stop']}</span>}
          </div>
          <div className="rfm__field rfm__field--required">
            <Label>Depart date & time</Label>
              <div className="rfm__datetime-row">
                <DatePicker
                  value={form.details['from_date'] ?? ''}
                  onChange={v => onField('from_date', v)}
                  placeholder="Depart date"
                  hasError={!!errors['from_date']}
                />
                <ClearableTimeInput
                  value={form.details['from_time'] ?? ''}
                  onChange={v => onField('from_time', v)}
                />
              </div>
              {errors['from_date'] && <span className="form-field-error">{errors['from_date']}</span>}
          </div>

          <div className="rfm__field rfm__field--required">
            <Label>To</Label>
            <Input
              aria-invalid={!!errors['to_stop']}
              type="text"
              value={form.details['to_stop'] ?? ''}
              onChange={e => onField('to_stop', e.target.value)}
              placeholder="Arrival station / stop"
            />
            {errors['to_stop'] && <span className="form-field-error">{errors['to_stop']}</span>}
          </div>
          <div className="rfm__field rfm__field--required">
            <Label>Arrive date & time</Label>
              <div className="rfm__datetime-row">
                <DatePicker
                  value={form.details['to_date'] ?? ''}
                  onChange={v => onField('to_date', v)}
                  placeholder="Arrive date"
                  hasError={!!errors['to_date']}
                />
                <ClearableTimeInput
                  value={form.details['to_time'] ?? ''}
                  onChange={v => onField('to_time', v)}
                />
              </div>
              {errors['to_date'] && <span className="form-field-error">{errors['to_date']}</span>}
          </div>
          {/* Carrier (optional) */}
          <div className="rfm__field">
            <Label>Carrier</Label>
            <Input
              type="text"
              value={form.details['carrier'] ?? ''}
              onChange={e => onField('carrier', e.target.value)}
            />
          </div>
        </>
      ) : (
        /* Generic field layout for non-transit types — adjacent date+time pairs rendered side-by-side */
        pairDateTimeFields(fields).map((item) => {
          if ('date' in item) {
            const { date: df, time: tf } = item;
            return (
              <div key={df.key} className={`rfm__field${df.required ? ' rfm__field--required' : ''}`}>
                <Label htmlFor={`rfm-${df.key}`}>{df.label.replace(' date', '')} date & time</Label>
                <div className="rfm__datetime-row">
                  <DatePicker
                    value={form.details[df.key] ?? ''}
                    onChange={v => onField(df.key, v)}
                    placeholder={df.label}
                    hasError={!!errors[df.key]}
                  />
                  <ClearableTimeInput
                    id={`rfm-${tf.key}`}
                    value={form.details[tf.key] ?? ''}
                    onChange={v => onField(tf.key, v)}
                  />
                </div>
                {errors[df.key] && <span className="form-field-error">{errors[df.key]}</span>}
              </div>
            );
          }
          const f = item as FieldDef;
          return (
            <div key={f.key} className={`rfm__field${f.required ? ' rfm__field--required' : ''}`}>
              <Label htmlFor={`rfm-${f.key}`}>{f.label}</Label>
              {f.type === 'date' ? (
                <DatePicker
                  value={form.details[f.key] ?? ''}
                  onChange={v => onField(f.key, v)}
                  placeholder={f.label}
                  hasError={!!errors[f.key]}
                />
              ) : f.type === 'time' ? (
                <ClearableTimeInput
                  id={`rfm-${f.key}`}
                  value={form.details[f.key] ?? ''}
                  onChange={v => onField(f.key, v)}
                />
              ) : (
                <Input
                  id={`rfm-${f.key}`}
                  aria-invalid={!!errors[f.key]}
                  type={f.type ?? 'text'}
                  value={form.details[f.key] ?? ''}
                  onChange={e => onField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
              )}
              {errors[f.key] && <span className="form-field-error">{errors[f.key]}</span>}
            </div>
          );
        })
      )}

      {/* Booking details — always visible, separated by dashed border */}
      <div className="rfm__booking-details">
        <div className="rfm__booking-details-label">Booking details</div>
        <div className="rfm__field">
          <Label htmlFor="rfm-conf-ref">Confirmation ref</Label>
          <Input
            id="rfm-conf-ref"
            type="text"
            value={form.confirmation_ref}
            onChange={e => onShared('confirmation_ref', e.target.value)}
            placeholder="#ABC123"
          />
        </div>
        <div className="rfm__row">
          <div className="rfm__field">
            <Label htmlFor="rfm-cost">Cost</Label>
            <Input
              id="rfm-cost"
              type="number"
              min="0"
              step="0.01"
              value={form.cost_amount}
              onChange={e => onShared('cost_amount', e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="rfm__field rfm__field--narrow">
            <Label htmlFor="rfm-currency">Currency</Label>
            <Input
              id="rfm-currency"
              type="text"
              maxLength={3}
              value={form.cost_currency}
              onChange={e => onShared('cost_currency', e.target.value.toUpperCase())}
            />
          </div>
          <div className="rfm__field">
            <Label htmlFor="rfm-status">Status</Label>
            <Select value={form.status} onValueChange={v => onShared('status', v)}>
              <SelectTrigger id="rfm-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="rfm__field">
          <Label htmlFor="rfm-res-notes">Notes</Label>
          <Textarea
            id="rfm-res-notes"
            value={form.notes}
            onChange={e => onShared('notes', e.target.value)}
            rows={2}
          />
        </div>

        {/* Geocodable map location */}
        <LocationField
          value={form.location}
          onChange={val => onShared('location', val)}
          onCoordinates={onLocationCoordinates}
          status={locationStatus}
        />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

// Reason: groups adjacent date+time FieldDef pairs so they render side-by-side in one row.
function pairDateTimeFields(fields: FieldDef[]): Array<FieldDef | { date: FieldDef; time: FieldDef }> {
  const result: Array<FieldDef | { date: FieldDef; time: FieldDef }> = [];
  let i = 0;
  while (i < fields.length) {
    const f = fields[i];
    const next = fields[i + 1];
    if (
      f.type === 'date' &&
      next?.type === 'time' &&
      next.key.replace('_time', '') === f.key.replace('_date', '')
    ) {
      result.push({ date: f, time: next });
      i += 2;
    } else {
      result.push(f);
      i += 1;
    }
  }
  return result;
}

// Reason: native <input type="time"> cannot be cleared in all browsers once set;
// this wrapper adds an explicit × button when a value is present.
function ClearableTimeInput({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
}): JSX.Element {
  return (
    <div className="rfm__time-wrap">
      <Input
        id={id}
        type="time"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {value && (
        <Button
          variant="ghost"
          type="button"
          tabIndex={-1}
          className="rfm__time-clear"
          onClick={() => onChange('')}
          aria-label="Clear time"
        >×</Button>
      )}
    </div>
  );
}

type ActivityAction =
  | { type: 'SET'; field: keyof ActivityFormState; value: string }
  | { type: 'RESET'; payload: ActivityFormState };

function activityReducer(state: ActivityFormState, action: ActivityAction): ActivityFormState {
  switch (action.type) {
    case 'SET':   return { ...state, [action.field]: action.value };
    case 'RESET': return action.payload;
  }
}

// ── Helper: derive day_id from reservation date fields ───────────────────────

function resolveDayId(
  type: ReservationType,
  details: DetailsState,
  days: { id: number; date: string }[] | undefined,
  fallbackDayId: number | null | undefined,
): number | null {
  // Reason: lodging spans multiple days and is always stored trip-level.
  if (type === 'lodging') return null;

  // Derive the relevant reference date for each type using the shared lookup.
  const dateKey = RESERVATION_TYPE_DATE_KEY[type];
  const refDate = dateKey ? details[dateKey] : undefined;

  if (refDate && days) {
    const match = days.find(d => d.date === refDate);
    if (match) return match.id;
  }
  return fallbackDayId ?? null;
}

export default function ReservationFormModal({
  open,
  onClose,
  tripId,
  dayId,
  editingReservation,
  editingActivity,
  defaultCategory,
  initialType,
  onCreateReservation,
  onCreateActivity,
  onUpdateReservation,
  onUpdateActivity,
  days,
  onGeocodeDone,
}: ReservationFormModalProps): JSX.Element {
  const [category, setCategory]     = useState<CategorySelection>('reservation');
  const [step2bChip, setStep2bChip] = useState<Step2bChip>('lodging');
  const [resType, setResType]       = useState<ReservationType>('lodging');

  // ── Activity form ─────────────────────────────────────────────────────────
  const [actForm, dispatchAct] = useReducer(activityReducer, BLANK_ACTIVITY);
  const [actErrors, setActErrors] = useState<Partial<Record<keyof ActivityFormState, string>>>({});

  // ── Reservation form ──────────────────────────────────────────────────────
  const [resForm, setResForm] = useState<ReservationFormState>(BLANK_RESERVATION);
  const [resErrors, setResErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError]   = useState<string | null>(null);

  // ── Geocoding ─────────────────────────────────────────────────────────────
  const actGeocode = useGeocode('activities');
  const resGeocode = useGeocode('reservations');
  // Reason: store coordinates from autocomplete so the geocode call can skip
  // the Nominatim round-trip and use them directly.
  const actCoordsRef = useRef<{ lat: number; lng: number } | undefined>(undefined);
  const resCoordsRef = useRef<{ lat: number; lng: number } | undefined>(undefined);

  // ── Submission guard ──────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Reason: ref prevents a second click while an async submit is in-flight
  // from enqueuing a duplicate POST, regardless of React re-render timing.
  const submittingRef = useRef(false);

  // Seed form from editing props / reset on close
  useEffect(() => {
    if (!open) {
      setActErrors({});
      setResErrors({});
      setApiError(null);
      setIsSubmitting(false);
      submittingRef.current = false;
      actGeocode.reset();
      resGeocode.reset();
      actCoordsRef.current = undefined;
      resCoordsRef.current = undefined;
      return;
    }

    if (editingActivity) {
      setCategory('activity');
      dispatchAct({
        type: 'RESET',
        payload: {
          title:         editingActivity.title,
          activity_type: editingActivity.activity_type,
          start_time:    editingActivity.start_time ?? '',
          end_time:      editingActivity.end_time   ?? '',
          notes:         editingActivity.notes      ?? '',
          location:      editingActivity.data.location ?? '',
        },
      });
      return;
    }

    if (editingReservation) {
      const t = editingReservation.type;
      setCategory('reservation');
      setResType(t);
      setStep2bChip(chipForType(t));
      const details = editingReservation.parsedDetails<Record<string, string>>();
      setResForm({
        status:           editingReservation.status,
        confirmation_ref: editingReservation.confirmation_ref ?? '',
        notes:            editingReservation.notes            ?? '',
        cost_amount:      editingReservation.cost_amount != null ? String(editingReservation.cost_amount) : '',
        cost_currency:    editingReservation.cost_currency,
        details:          Object.fromEntries(Object.entries(details).filter(([k]) => k !== 'type')),
        location:         editingReservation.data.location ?? '',
      });
      return;
    }

    if (initialType) {
      setCategory('reservation');
      setResType(initialType);
      setStep2bChip(chipForType(initialType));
      setResForm(BLANK_RESERVATION);
      return;
    }

    if (defaultCategory === 'activity') {
      setCategory('activity');
      dispatchAct({ type: 'RESET', payload: BLANK_ACTIVITY });
      return;
    }

    // Fresh open — default to reservation / lodging form
    setCategory('reservation');
    setStep2bChip('lodging');
    setResType('lodging');
    dispatchAct({ type: 'RESET', payload: BLANK_ACTIVITY });
    setResForm(BLANK_RESERVATION);
  }, [open, editingActivity, editingReservation, initialType, defaultCategory]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  // Reason: clicking a type chip immediately updates resType — no "Next" step needed.
  function handleChipChange(chip: Step2bChip): void {
    setStep2bChip(chip);
    const chipDef = STEP2B_CHIPS.find(c => c.value === chip);
    if (chipDef) setResType(chipDef.defaultType);
    // Clear field errors when switching type so stale errors don't persist.
    setResErrors({});
  }

  function handleResFieldChange(key: string, value: string): void {
    setResForm(prev => ({
      ...prev,
      details: { ...prev.details, [key]: value },
      // Reason: lodging and restaurant both have a 'location' detail field. Mirror it to
      // the geocodable location so the user doesn't have to fill in two separate fields.
      ...(key === 'location' ? { location: value } : {}),
    }));
  }

  function handleResSharedChange(field: keyof ReservationFormState, value: string): void {
    if (field === 'location') resCoordsRef.current = undefined;
    setResForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(): Promise<void> {
    setApiError(null);
    if (submittingRef.current) return;

    if (category === 'activity') {
      const locationTrimmed = actForm.location.trim();
      const parsed = CreateActivitySchema.safeParse({
        day_id:        dayId ?? null,
        trip_id:       tripId,
        title:         actForm.title.trim(),
        activity_type: actForm.activity_type,
        start_time:    actForm.start_time || null,
        end_time:      actForm.end_time   || null,
        notes:         actForm.notes.trim() || null,
        location:      locationTrimmed || null,
        // Reason: clear stale coordinates when location is cleared.
        ...(locationTrimmed ? {} : { lat: null, lng: null }),
      });
      if (!parsed.success) {
        const fe = parsed.error.flatten().fieldErrors;
        setActErrors({
          title:    fe['title']?.[0],
          end_time: fe['end_time']?.[0],
        });
        return;
      }
      submittingRef.current = true;
      setIsSubmitting(true);
      try {
        let saved: Activity | void;
        if (editingActivity && onUpdateActivity) {
          saved = await onUpdateActivity(editingActivity.id, parsed.data);
        } else {
          saved = await onCreateActivity(parsed.data);
        }
        const savedId = (saved as Activity | undefined)?.id ?? editingActivity?.id;
        if (savedId && locationTrimmed) {
          await actGeocode.geocode(savedId, locationTrimmed, actCoordsRef.current);
          onGeocodeDone?.();
          await new Promise<void>(resolve => { setTimeout(resolve, 800); });
        }
        onClose();
      } catch (err) {
        setApiError(err instanceof Error ? err.message : 'Failed to save activity');
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
      return;
    }

    // Reservation
    const detailsObj = { type: resType, ...resForm.details };
    const input = {
      trip_id:          tripId,
      day_id:           resolveDayId(resType, resForm.details, days, dayId),
      type:             resType,
      status:           resForm.status,
      confirmation_ref: resForm.confirmation_ref.trim() || null,
      notes:            resForm.notes.trim() || null,
      cost_amount:      resForm.cost_amount !== '' ? parseFloat(resForm.cost_amount) : null,
      cost_currency:    resForm.cost_currency || 'EUR',
      details:          detailsObj,
      location:         resForm.location.trim() || null,
      // Reason: clear stale coordinates when location is cleared.
      ...(resForm.location.trim() ? {} : { lat: null, lng: null }),
    };
    const parsed = CreateReservationSchema.safeParse(input);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      const detailIssues = parsed.error.issues.filter(i => i.path[0] === 'details');
      for (const issue of detailIssues) {
        const key = String(issue.path[issue.path.length - 1]);
        if (!errs[key]) errs[key] = issue.message;
      }
      setResErrors(errs);
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await doSaveReservation(parsed.data);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function doSaveReservation(input: Parameters<typeof onCreateReservation>[0]): Promise<void> {
    try {
      let saved: Reservation;
      if (editingReservation && onUpdateReservation) {
        saved = await onUpdateReservation(editingReservation.id, input);
      } else {
        saved = await onCreateReservation(input);
      }
      const locationTrimmed = resForm.location.trim();
      if (locationTrimmed) {
        await resGeocode.geocode(saved.id, locationTrimmed, resCoordsRef.current);
        onGeocodeDone?.();
        await new Promise<void>(resolve => { setTimeout(resolve, 800); });
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const body = err.body as { error: string; conflictingTitle?: string };
        if (body.error === 'overlap') {
          setApiError(`Dates overlap with "${body.conflictingTitle ?? 'an existing lodging'}". Adjust your check-in or check-out date.`);
          return;
        }
      }
      setApiError(err instanceof Error ? err.message : 'Failed to save reservation');
    }
  }

  // ── Modal title ───────────────────────────────────────────────────────────

  function modalTitle(): string {
    if (editingActivity)    return 'Edit activity';
    if (editingReservation) return `Edit ${TYPE_LABELS[editingReservation.type]}`;
    if (category === 'activity') return 'New activity';
    return `New ${TYPE_LABELS[resType].toLowerCase()}`;
  }

  // ── Footer ────────────────────────────────────────────────────────────────

  const isEditing = !!(editingActivity || editingReservation);

  function renderFooter(): JSX.Element {
    const saveLabel = category === 'activity'
      ? (isEditing ? 'Save changes' : 'Save activity')
      : (isEditing ? 'Save changes' : `Save ${TYPE_LABELS[resType].toLowerCase()}`);
    return (
      <>
        <Button variant="outline" onClick={onClose} type="button">Cancel</Button>
        <Button variant="default" disabled={isSubmitting} onClick={() => { void handleSubmit(); }} type="button">
          {isSubmitting
            ? <><Spinner className="mr-1.5 size-3.5" />Saving…</>
            : saveLabel}
        </Button>
      </>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{modalTitle()}</DialogTitle>
        </DialogHeader>

        {/* Scrollable content area — prevents tall forms from going off-screen.
            -mx-4 px-4: extend the scroll div edge-to-edge so focus rings near
            the left/right edge of inputs aren't clipped by overflow-x:auto. */}
        <div className="rfm__scroll-area -mx-4 px-4">
          {category === 'activity' ? (
            <ActivitySubForm
              form={actForm}
              onChange={(f, v) => { if (f === 'location') actCoordsRef.current = undefined; dispatchAct({ type: 'SET', field: f, value: v }); }}
              onLocationCoordinates={(lat, lng) => { actCoordsRef.current = { lat, lng }; }}
              errors={actErrors}
              locationStatus={actGeocode.status}
            />
          ) : (
            <div className="rfm__form">
              {/* Type selector: only for new reservations without a pre-set type; editing keeps type fixed */}
              {!isEditing && !initialType && (
                <div className="rfm__type-chips">
                  {STEP2B_CHIPS.map(chip => (
                    <button
                      key={chip.value}
                      type="button"
                      className={`rfm__type-chip${step2bChip === chip.value ? ' rfm__type-chip--active' : ''}`}
                      onClick={() => handleChipChange(chip.value)}
                    >
                      <span className="rfm__tc-icon"><chip.icon size={18} /></span>
                      <div>
                        <div className="rfm__tc-label">{chip.label}</div>
                        <div className="rfm__tc-sub">{chip.sub}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <ReservationSubForm
                resType={resType}
                form={resForm}
                onField={handleResFieldChange}
                onShared={handleResSharedChange}
                onTransitTypeChange={t => setResType(t)}
                errors={resErrors}
                apiError={apiError}
                locationStatus={resGeocode.status}
              onLocationCoordinates={(lat, lng) => { resCoordsRef.current = { lat, lng }; }}
            />
            </div>
          )}
        </div>

        <DialogFooter>{renderFooter()}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
