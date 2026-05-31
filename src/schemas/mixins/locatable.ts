import { z } from 'zod';

// Reason: shared mixin so activities and reservations support geocoding with a
// single source of truth. LocationField is the only sanctioned UI for these fields.
export const locatableMixin = z.object({
  location: z.string().nullable().optional(),
  lat:      z.number().min(-90).max(90).nullable().optional(),
  lng:      z.number().min(-180).max(180).nullable().optional(),
  address_street:      z.string().max(500).nullable().optional(),
  address_number:      z.string().max(50).nullable().optional(),
  address_postal_code: z.string().max(20).nullable().optional(),
  address_city:        z.string().max(200).nullable().optional(),
  address_country:     z.string().max(200).nullable().optional(),
});

export type Locatable = z.infer<typeof locatableMixin>;
