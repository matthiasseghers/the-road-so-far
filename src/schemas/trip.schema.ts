import { z } from 'zod';

const ISO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

export const TripStatusSchema = z.enum([
  'draft', 'planning', 'confirmed', 'ready', 'completed', 'archived',
]);

// Reason: Zod v4 does not allow .partial() or .omit() on schemas with .refine().
// Define the base object first, build patch/update schemas from it, then
// add the date-order refinement only to CreateTripSchema.
const TripBaseSchema = z.object({
  title:          z.string().trim().min(1, 'Title is required'),
  emoji:          z.string().default('🗺️'),
  status:         TripStatusSchema.default('draft'),
  start_date:     ISO_DATE,
  end_date:       ISO_DATE,
  tags:           z.array(z.string().trim()).default([]),
  notes:          z.string().nullable().optional(),
  cover_gradient: z.string().default('warm-brown'),
});

export const CreateTripSchema = TripBaseSchema.refine(
  d => d.end_date >= d.start_date,
  { message: 'End date must be after start date', path: ['end_date'] },
);

// Reason: PATCH routes only send changed fields; id comes from the URL param not the body.
export const PatchTripSchema = TripBaseSchema.partial().refine(
  d => {
    if (d.start_date && d.end_date) return d.end_date >= d.start_date;
    return true;
  },
  { message: 'End date must be after start date', path: ['end_date'] },
);

export type CreateTripInput = z.infer<typeof CreateTripSchema>;
export type PatchTripInput  = z.infer<typeof PatchTripSchema>;
