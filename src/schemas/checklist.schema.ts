import { z } from 'zod';

export const ChecklistCategorySchema = z.enum([
  'documents', 'clothing', 'tech', 'health', 'toiletries', 'other',
]);

export const CreateChecklistItemSchema = z.object({
  trip_id:    z.number().int().positive(),
  label:      z.string().trim().min(1, 'Label is required'),
  category:   ChecklistCategorySchema.default('other'),
  is_checked: z.boolean().default(false),
  sort_order: z.number().int().default(0),
  source:     z.enum(['template', 'trip']).default('trip'),
});

export const PatchChecklistItemSchema = CreateChecklistItemSchema
  .omit({ trip_id: true })
  .partial();

export type CreateChecklistItemInput = z.infer<typeof CreateChecklistItemSchema>;
export type PatchChecklistItemInput  = z.infer<typeof PatchChecklistItemSchema>;
