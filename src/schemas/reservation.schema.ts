import { z } from 'zod';
import { locatableMixin } from './mixins/locatable.js';

const ISO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
  .refine(s => !isNaN(Date.parse(s)), 'Invalid date');
const HH_MM    = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM (00:00–23:59)');

// ── Details schemas (one per type) ───────────────────────────────────────────

export const LodgingDetailsSchema = z.object({
  type:           z.literal('lodging'),
  property_name:  z.string().trim().min(1, 'Property name is required'),
  location:       z.string().trim().optional(),
  check_in_date:  ISO_DATE,
  check_out_date: ISO_DATE,
  check_in_time:  HH_MM.optional(),
  check_out_time: HH_MM.optional(),
}).refine(
  d => d.check_out_date >= d.check_in_date,
  { message: 'Check-out must be on or after check-in', path: ['check_out_date'] },
).refine(
  d => {
    if (d.check_in_date !== d.check_out_date) return true;
    if (!d.check_in_time || !d.check_out_time) return true;
    return d.check_out_time > d.check_in_time;
  },
  { message: 'End time must be after start time on the same day', path: ['check_out_time'] },
);

export const FlightDetailsSchema = z.object({
  type:           z.literal('flight'),
  airline:        z.string().trim().min(1, 'Airline is required').max(200),
  flight_number:  z.string().trim().min(1, 'Flight number is required').max(50),
  depart_date:    ISO_DATE,
  arrive_date:    ISO_DATE,
  depart_time:    HH_MM.optional(),
  depart_airport: z.string().trim().max(200).optional(),
  arrive_time:    HH_MM.optional(),
  arrive_airport: z.string().trim().max(200).optional(),
}).refine(
  d => d.arrive_date >= d.depart_date,
  { message: 'Arrival date must be on or after departure date', path: ['arrive_date'] },
);

export const TrainDetailsSchema = z.object({
  type:      z.literal('train'),
  from_stop: z.string().trim().min(1, 'Departure stop is required').max(500),
  from_date: ISO_DATE,
  to_stop:   z.string().trim().min(1, 'Arrival stop is required').max(500),
  to_date:   ISO_DATE,
  from_time: HH_MM.optional(),
  to_time:   HH_MM.optional(),
  carrier:   z.string().trim().max(200).optional(),
}).refine(
  d => d.to_date >= d.from_date,
  { message: 'Arrival date must be on or after departure date', path: ['to_date'] },
).refine(
  d => {
    if (d.from_date !== d.to_date) return true;
    if (!d.from_time || !d.to_time) return true;
    return d.to_time > d.from_time;
  },
  { message: 'End time must be after start time on the same day', path: ['to_time'] },
);

// Reason: bus and ferry have identical fields and rules to train — only the type
// literal differs. A factory keeps them in sync without copy-pasting.
function makeTransitSchema<T extends 'bus' | 'ferry'>(type: T) {
  return z.object({
    type:      z.literal(type),
    from_stop: z.string().trim().min(1, 'Departure stop is required').max(500),
    from_date: ISO_DATE,
    to_stop:   z.string().trim().min(1, 'Arrival stop is required').max(500),
    to_date:   ISO_DATE,
    from_time: HH_MM.optional(),
    to_time:   HH_MM.optional(),
    carrier:   z.string().trim().max(200).optional(),
  }).refine(
    d => d.to_date >= d.from_date,
    { message: 'Arrival date must be on or after departure date', path: ['to_date'] },
  ).refine(
    d => {
      if (d.from_date !== d.to_date) return true;
      if (!d.from_time || !d.to_time) return true;
      return d.to_time > d.from_time;
    },
    { message: 'End time must be after start time on the same day', path: ['to_time'] },
  );
}

export const BusDetailsSchema   = makeTransitSchema('bus');
export const FerryDetailsSchema = makeTransitSchema('ferry');

export const RentalCarDetailsSchema = z.object({
  type:             z.literal('rental_car'),
  company:          z.string().trim().min(1, 'Company is required').max(200),
  pickup_location:  z.string().trim().min(1, 'Pick-up location is required').max(500),
  pickup_date:      ISO_DATE,
  dropoff_location: z.string().trim().min(1, 'Drop-off location is required').max(500),
  dropoff_date:     ISO_DATE,
  pickup_time:      HH_MM.optional(),
  dropoff_time:     HH_MM.optional(),
  vehicle_type:     z.string().trim().max(200).optional(),
}).refine(
  d => d.dropoff_date >= d.pickup_date,
  { message: 'Drop-off date must be on or after pick-up date', path: ['dropoff_date'] },
).refine(
  d => {
    if (d.pickup_date !== d.dropoff_date) return true;
    if (!d.pickup_time || !d.dropoff_time) return true;
    return d.dropoff_time > d.pickup_time;
  },
  { message: 'End time must be after start time on the same day', path: ['dropoff_time'] },
);

export const RestaurantDetailsSchema = z.object({
  type:            z.literal('restaurant'),
  restaurant_name: z.string().trim().min(1, 'Restaurant name is required').max(200),
  location:        z.string().trim().max(500).optional(),
  date:            ISO_DATE,
  time:            HH_MM,
  party_size:      z.coerce.number().int().positive().optional(),
});

export const OtherDetailsSchema = z.object({
  type:        z.literal('other'),
  description: z.string().trim().optional(),
});

// ── Discriminated union ───────────────────────────────────────────────────────

export const ReservationDetailsSchema = z.discriminatedUnion('type', [
  LodgingDetailsSchema,
  FlightDetailsSchema,
  TrainDetailsSchema,
  BusDetailsSchema,
  FerryDetailsSchema,
  RentalCarDetailsSchema,
  RestaurantDetailsSchema,
  OtherDetailsSchema,
]);

// ── Shared outer fields ───────────────────────────────────────────────────────

const ReservationBaseSchema = z.object({
  trip_id:          z.number().int().positive(),
  day_id:           z.number().int().positive().nullable().optional(),
  type:             z.enum(['lodging','flight','train','bus','ferry','rental_car','restaurant','other']),
  // Reason: title is auto-generated from details in the repository; callers may omit it.
  title:            z.string().trim().optional(),
  status:           z.enum(['pending','confirmed','cancelled']).default('pending'),
  confirmation_ref: z.string().trim().nullable().optional(),
  notes:            z.string().trim().nullable().optional(),
  cost_amount:      z.number().nonnegative().nullable().optional(),
  cost_currency:    z.string().regex(/^[A-Z]{3}$/, 'Must be a 3-letter uppercase currency code').default('EUR'),
  details:          ReservationDetailsSchema,
  // Reason: details is the validated object; serialisation to JSON string is handled
  // by the repository layer so the schema stays type-safe end-to-end.
}).merge(locatableMixin);

export const CreateReservationSchema = ReservationBaseSchema;

// Reason: .partial() on fields with .default() returns the default (not undefined)
// when the field is omitted, causing the repo's `?? cur.field` guard to use the
// default value instead of the current DB value. Extend after .partial() to
// strip the defaults for status and cost_currency so omission means "no change".
export const UpdateReservationSchema = ReservationBaseSchema
  .omit({ trip_id: true })
  .partial()
  .extend({
    id:            z.number().int().positive(),
    status:        z.enum(['pending', 'confirmed', 'cancelled']).optional(),
    cost_currency: z.string().length(3).optional(),
  });

// ── Inferred types ────────────────────────────────────────────────────────────

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;
export type UpdateReservationInput = z.infer<typeof UpdateReservationSchema>;
export type ReservationDetails     = z.infer<typeof ReservationDetailsSchema>;
export type LodgingDetails         = z.infer<typeof LodgingDetailsSchema>;
export type FlightDetails          = z.infer<typeof FlightDetailsSchema>;
export type TrainDetails           = z.infer<typeof TrainDetailsSchema>;
export type BusDetails             = z.infer<typeof BusDetailsSchema>;
export type FerryDetails           = z.infer<typeof FerryDetailsSchema>;
export type RentalCarDetails       = z.infer<typeof RentalCarDetailsSchema>;
export type RestaurantDetails      = z.infer<typeof RestaurantDetailsSchema>;
export type OtherDetails           = z.infer<typeof OtherDetailsSchema>;
