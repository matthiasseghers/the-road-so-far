import { z } from 'zod';

// Reason: shared mixin so activities and reservations support geocoding with a
// single source of truth. LocationField is the only sanctioned UI for these fields.
export const locatableMixin = z.object({
  location: z.string().nullable().optional(),
  lat:      z.number().min(-90).max(90).nullable().optional(),
  lng:      z.number().min(-180).max(180).nullable().optional(),
});

export type Locatable = z.infer<typeof locatableMixin>;
