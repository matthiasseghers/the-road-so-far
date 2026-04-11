import { z } from 'zod';

// Reason: shared mixin so activities and reservations support geocoding with a
// single source of truth. LocationField is the only sanctioned UI for these fields.
export const locatableMixin = z.object({
  location: z.string().nullable().optional(),
  lat:      z.number().nullable().optional(),
  lng:      z.number().nullable().optional(),
});

export type Locatable = z.infer<typeof locatableMixin>;
