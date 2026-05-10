import { z } from 'zod';

export const PatchDaySchema = z.object({
  title:    z.string().max(200).nullable().optional(),
  subtitle: z.string().max(300).nullable().optional(),
  notes:    z.string().nullable().optional(),
});

export type PatchDayInput = z.infer<typeof PatchDaySchema>;
