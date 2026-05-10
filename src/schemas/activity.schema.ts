import { z } from 'zod';
import { locatableMixin } from './mixins/locatable.js';

const HH_MM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM (00:00–23:59)');

export const ActivityTypeSchema = z.enum([
  'attraction', 'food', 'shopping', 'outdoors', 'cultural', 'note', 'other',
]);

// Reason: Zod v4 does not allow .omit()/.partial() on refined schemas.
// Build patch schema from the base object then apply the same refinements.
// Exported so form modals can .pick() user-editable fields without hitting
// the "cannot pick on refined schema" restriction.
export const ActivityBaseSchema = z.object({
  day_id:        z.number().int().positive().nullable().optional(),
  trip_id:       z.number().int().positive(),
  title:         z.string().trim().min(1, 'Title is required'),
  activity_type: ActivityTypeSchema.default('attraction'),
  start_time:    HH_MM.nullable().optional(),
  end_time:      HH_MM.nullable().optional(),
  sort_order:    z.number().int().default(0),
  notes:         z.string().nullable().optional(),
}).merge(locatableMixin);

export const CreateActivitySchema = ActivityBaseSchema
  .refine(
    d => !(d.end_time && !d.start_time),
    { message: 'end_time requires start_time', path: ['end_time'] },
  );

// Reason: .partial() on a field with .default() returns the default (not undefined)
// when the field is omitted, causing the repo's `?? cur.field` guard to always
// use the default instead of the current DB value. Extend after .partial() to
// strip the defaults for patch-only fields so omission correctly means "no change".
export const PatchActivitySchema = ActivityBaseSchema
  .omit({ trip_id: true })
  .partial()
  .extend({
    sort_order:    z.number().int().optional(),
    activity_type: ActivityTypeSchema.optional(),
  })
  .refine(
    // Reason: in a partial schema, omitted start_time is `undefined` ("no change").
    // Only reject when end_time is set AND start_time is explicitly nulled — meaning
    // the caller is clearing start_time while keeping end_time, which is invalid.
    d => !(d.end_time && d.start_time === null),
    { message: 'end_time requires start_time', path: ['end_time'] },
  );

export type CreateActivityInput = z.infer<typeof CreateActivitySchema>;
export type PatchActivityInput  = z.infer<typeof PatchActivitySchema>;

