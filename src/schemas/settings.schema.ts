import { z } from 'zod';

// Reason: settings values are JSON-encoded strings in the DB.
// The key is a well-known string; value is validated as non-empty JSON string.
export const UpsertSettingSchema = z.object({
  key:   z.string().min(1),
  value: z.string().min(1),
});

export type UpsertSettingInput = z.infer<typeof UpsertSettingSchema>;
