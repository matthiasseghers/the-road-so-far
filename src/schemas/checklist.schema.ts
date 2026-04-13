import { z } from 'zod';

// Reason: free-form since migration 003 dropped the CHECK constraint; nullable — items with no category show under "All items" only
export const ChecklistCategorySchema = z.string().trim().min(1).nullable();

export const CreateChecklistItemSchema = z.object({
  trip_id:    z.number().int().positive(),
  label:      z.string().trim().min(1, 'Label is required'),
  category:   ChecklistCategorySchema.default(null),
  is_checked: z.boolean().default(false),
  sort_order: z.number().int().default(0),
  source:     z.enum(['template', 'trip']).default('trip'),
});

export const PatchChecklistItemSchema = CreateChecklistItemSchema
  .omit({ trip_id: true })
  .partial();

export type CreateChecklistItemInput = z.infer<typeof CreateChecklistItemSchema>;
export type PatchChecklistItemInput  = z.infer<typeof PatchChecklistItemSchema>;
