import { getDb } from '../client.js';
import type {
  ChecklistItemRow,
  ChecklistTemplateRow,
  TemplateItemRow,
  ChecklistCategory,
} from '@/types/db';

// ─── Checklist items ──────────────────────────────────────────────────────────

export function findChecklistItemsByTripId(tripId: number): ChecklistItemRow[] {
  return getDb()
    .prepare(
      'SELECT * FROM checklist_items WHERE trip_id = ? ORDER BY category ASC, sort_order ASC',
    )
    .all(tripId) as ChecklistItemRow[];
}

export function findChecklistItemById(id: number): ChecklistItemRow | null {
  const row = getDb()
    .prepare('SELECT * FROM checklist_items WHERE id = ?')
    .get(id) as ChecklistItemRow | undefined;
  return row ?? null;
}

export interface CreateChecklistItemInput {
  trip_id: number;
  label: string;
  category?: ChecklistCategory;
  sort_order?: number;
  source?: 'template' | 'trip';
}

export function createChecklistItem(input: CreateChecklistItemInput): ChecklistItemRow {
  const db = getDb();

  let sortOrder = input.sort_order;
  if (sortOrder === undefined) {
    const max = db
      .prepare(
        'SELECT MAX(sort_order) AS m FROM checklist_items WHERE trip_id = ? AND category IS ?',
      )
      .get(input.trip_id, input.category ?? null) as { m: number | null };
    sortOrder = (max.m ?? -1) + 1;
  }

  const result = db
    .prepare(
      `INSERT INTO checklist_items (trip_id, label, category, is_checked, sort_order, source)
       VALUES (@trip_id, @label, @category, 0, @sort_order, @source)`,
    )
    .run({
      trip_id: input.trip_id,
      label: input.label,
      category: input.category ?? null,
      sort_order: sortOrder,
      source: input.source ?? 'trip',
    });

  return db
    .prepare('SELECT * FROM checklist_items WHERE id = ?')
    .get(result.lastInsertRowid as number) as ChecklistItemRow;
}

export interface UpdateChecklistItemInput {
  label?: string;
  category?: ChecklistCategory;
  is_checked?: boolean;
  sort_order?: number;
}

export function updateChecklistItem(
  id: number,
  input: UpdateChecklistItemInput,
): ChecklistItemRow | null {
  const db = getDb();
  const cur = db
    .prepare('SELECT * FROM checklist_items WHERE id = ?')
    .get(id) as ChecklistItemRow | undefined;
  if (!cur) return null;

  db.prepare(
    `UPDATE checklist_items SET
       label = @label, category = @category, is_checked = @is_checked, sort_order = @sort_order
     WHERE id = @id`,
  ).run({
    id,
    label: input.label ?? cur.label,
    category: input.category ?? cur.category,
    // Reason: DB stores booleans as 0|1; convert from JS boolean when provided
    is_checked:
      input.is_checked !== undefined ? (input.is_checked ? 1 : 0) : cur.is_checked,
    sort_order: input.sort_order ?? cur.sort_order,
  });

  return db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(id) as ChecklistItemRow;
}

export function deleteChecklistItem(id: number): void {
  getDb().prepare('DELETE FROM checklist_items WHERE id = ?').run(id);
}

export function deleteChecklistItemsByCategory(tripId: number, category: string): void {
  getDb()
    .prepare('DELETE FROM checklist_items WHERE trip_id = ? AND category = ?')
    .run(tripId, category);
}

export function renameChecklistCategory(
  tripId: number,
  oldCategory: string,
  newCategory: string,
): void {
  getDb()
    .prepare('UPDATE checklist_items SET category = ? WHERE trip_id = ? AND category = ?')
    .run(newCategory, tripId, oldCategory);
}

/** Returns distinct categories used across all template_items, sorted alphabetically. */
export function getDistinctCategories(): string[] {
  const rows = getDb()
    .prepare('SELECT DISTINCT category FROM template_items ORDER BY category ASC')
    .all() as Array<{ category: string }>;
  return rows.map(r => r.category);
}

// ─── Templates ────────────────────────────────────────────────────────────────

export function findAllTemplates(): ChecklistTemplateRow[] {
  return getDb()
    .prepare('SELECT * FROM checklist_templates ORDER BY sort_order ASC')
    .all() as ChecklistTemplateRow[];
}

export function findTemplateById(id: number): ChecklistTemplateRow | null {
  const row = getDb()
    .prepare('SELECT * FROM checklist_templates WHERE id = ?')
    .get(id) as ChecklistTemplateRow | undefined;
  return row ?? null;
}

export function findTemplateItems(templateId: number): TemplateItemRow[] {
  return getDb()
    .prepare('SELECT * FROM template_items WHERE template_id = ? ORDER BY sort_order ASC')
    .all(templateId) as TemplateItemRow[];
}

export interface CreateTemplateInput {
  name: string;
  icon_name?: string | null;
  sort_order?: number;
}

export function createTemplate(input: CreateTemplateInput): ChecklistTemplateRow {
  const db = getDb();

  let sortOrder = input.sort_order;
  if (sortOrder === undefined) {
    const max = db
      .prepare('SELECT MAX(sort_order) AS m FROM checklist_templates')
      .get() as { m: number | null };
    sortOrder = (max.m ?? -1) + 1;
  }

  const result = db
    .prepare(
      `INSERT INTO checklist_templates (name, icon_name, is_base, sort_order)
       VALUES (@name, @icon_name, 0, @sort_order)`,
    )
    .run({ name: input.name, icon_name: input.icon_name ?? null, sort_order: sortOrder });

  return db
    .prepare('SELECT * FROM checklist_templates WHERE id = ?')
    .get(result.lastInsertRowid as number) as ChecklistTemplateRow;
}

export interface UpdateTemplateInput {
  name?: string;
  icon_name?: string | null;
  sort_order?: number;
}

export function updateTemplate(
  id: number,
  input: UpdateTemplateInput,
): ChecklistTemplateRow | null {
  const db = getDb();
  const cur = db
    .prepare('SELECT * FROM checklist_templates WHERE id = ?')
    .get(id) as ChecklistTemplateRow | undefined;
  if (!cur) return null;

  db.prepare(
    `UPDATE checklist_templates SET name = @name, icon_name = @icon_name, sort_order = @sort_order
     WHERE id = @id`,
  ).run({
    id,
    name: input.name ?? cur.name,
    icon_name: input.icon_name !== undefined ? input.icon_name : cur.icon_name,
    sort_order: input.sort_order ?? cur.sort_order,
  });

  return db.prepare('SELECT * FROM checklist_templates WHERE id = ?').get(id) as ChecklistTemplateRow;
}

/** Deletes a template. Throws if it is a base template (is_base = 1). */
export function deleteTemplate(id: number): void {
  const db = getDb();
  const cur = db
    .prepare('SELECT * FROM checklist_templates WHERE id = ?')
    .get(id) as ChecklistTemplateRow | undefined;
  if (!cur) return;
  if (cur.is_base === 1) throw new Error('Cannot delete a base template');
  db.prepare('DELETE FROM checklist_templates WHERE id = ?').run(id);
}

// ─── Copy templates to trip ────────────────────────────────────────────────────

/**
 * Copies all items from the given template IDs into checklist_items for a trip.
 * Runs in a transaction. Safe to call on trip create.
 */
export function copyTemplatesToTrip(
  tripId: number,
  templateIds: number[],
): { items: ChecklistItemRow[]; inserted: number; skipped: number } {
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO checklist_items (trip_id, label, category, is_checked, sort_order, source)
     SELECT @trip_id, @label, @category, 0, @sort_order, 'template'
     WHERE NOT EXISTS (
       SELECT 1 FROM checklist_items
       WHERE trip_id = @trip_id
         AND label    = @label
         AND category = @category
     )`,
  );

  let inserted = 0;
  let skipped  = 0;

  const txn = db.transaction((ids: number[]) => {
    for (const templateId of ids) {
      const items = db
        .prepare('SELECT * FROM template_items WHERE template_id = ? ORDER BY sort_order ASC')
        .all(templateId) as TemplateItemRow[];

      // sort_order per category within this trip
      const categoryMax = new Map<string, number>();

      for (const item of items) {
        const cur = categoryMax.get(item.category) ?? -1;
        const sortOrder = cur + 1;
        categoryMax.set(item.category, sortOrder);
        const result = insert.run({
          trip_id: tripId,
          label: item.label,
          category: item.category,
          sort_order: sortOrder,
        });
        if (result.changes > 0) inserted++; else skipped++;
      }
    }
  });

  txn(templateIds);
  return { items: findChecklistItemsByTripId(tripId), inserted, skipped };
}

// ─── Template items CRUD ──────────────────────────────────────────────────────

export function createTemplateItem(
  templateId: number,
  label: string,
  category: string,
): TemplateItemRow {
  const db = getDb();
  const max = db
    .prepare('SELECT MAX(sort_order) AS m FROM template_items WHERE template_id = ?')
    .get(templateId) as { m: number | null };
  const sortOrder = (max.m ?? -1) + 1;

  const result = db
    .prepare(
      `INSERT INTO template_items (template_id, label, category, sort_order)
       VALUES (@template_id, @label, @category, @sort_order)`,
    )
    .run({ template_id: templateId, label, category, sort_order: sortOrder });

  return db
    .prepare('SELECT * FROM template_items WHERE id = ?')
    .get(result.lastInsertRowid as number) as TemplateItemRow;
}

export function updateTemplateItem(
  id: number,
  input: { label?: string; category?: string },
): TemplateItemRow | null {
  const db = getDb();
  const cur = db
    .prepare('SELECT * FROM template_items WHERE id = ?')
    .get(id) as TemplateItemRow | undefined;
  if (!cur) return null;

  db.prepare(
    'UPDATE template_items SET label = @label, category = @category WHERE id = @id',
  ).run({
    id,
    label: input.label ?? cur.label,
    category: input.category ?? cur.category,
  });

  return db.prepare('SELECT * FROM template_items WHERE id = ?').get(id) as TemplateItemRow;
}

export function deleteTemplateItem(id: number): void {
  getDb().prepare('DELETE FROM template_items WHERE id = ?').run(id);
}

// ─── Reorder ──────────────────────────────────────────────────────────────────

/**
 * Bulk-update sort_order for checklist_items within a single trip + category.
 * `ids` must be the full ordered list of IDs for that category.
 * Returns the number of rows that matched (to detect out-of-scope IDs).
 */
export function reorderChecklistItems(tripId: number, ids: number[]): number {
  const db = getDb();
  const stmt = db.prepare(
    'UPDATE checklist_items SET sort_order = @sort_order WHERE id = @id AND trip_id = @trip_id',
  );
  return db.transaction((orderedIds: number[]) => {
    let matched = 0;
    orderedIds.forEach((id, idx) => { matched += stmt.run({ id, trip_id: tripId, sort_order: idx }).changes; });
    return matched;
  })(ids) as number;
}

/**
 * Bulk-update sort_order for template_items within a single template.
 * `ids` must be the full ordered list of IDs for that template.
 * Returns the number of rows that matched (to detect out-of-scope IDs).
 */
export function reorderTemplateItems(templateId: number, ids: number[]): number {
  const db = getDb();
  const stmt = db.prepare(
    'UPDATE template_items SET sort_order = @sort_order WHERE id = @id AND template_id = @template_id',
  );
  return db.transaction((orderedIds: number[]) => {
    let matched = 0;
    orderedIds.forEach((id, idx) => { matched += stmt.run({ id, template_id: templateId, sort_order: idx }).changes; });
    return matched;
  })(ids) as number;
}
