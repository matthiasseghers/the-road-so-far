import { z } from 'zod';
import { locatableMixin } from './mixins/locatable.js';

const HH_MM = z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM');

export const ActivityTypeSchema = z.enum([
  'attraction', 'food', 'shopping', 'outdoors', 'cultural', 'note', 'other',
]);

// Reason: Zod v4 does not allow .omit()/.partial() on refined schemas.
// Build patch schema from the base object then apply the same refinements.
const ActivityBaseSchema = z.object({
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

export const PatchActivitySchema = ActivityBaseSchema
  .omit({ trip_id: true })
  .partial()
  .refine(
    d => !(d.end_time && !d.start_time),
    { message: 'end_time requires start_time', path: ['end_time'] },
  );

export type CreateActivityInput = z.infer<typeof CreateActivitySchema>;
export type PatchActivityInput  = z.infer<typeof PatchActivitySchema>;

