import { getDb } from '../client.js';
import type { ActivityTypeRow } from '@/types/db';

// ─── Queries ──────────────────────────────────────────────────────────────────

export function findAllActivityTypes(): ActivityTypeRow[] {
  return getDb()
    .prepare('SELECT * FROM activity_types ORDER BY sort_order ASC, id ASC')
    .all() as ActivityTypeRow[];
}

export function findActivityTypeById(id: number): ActivityTypeRow | null {
  const row = getDb()
    .prepare('SELECT * FROM activity_types WHERE id = ?')
    .get(id) as ActivityTypeRow | undefined;
  return row ?? null;
}

export function findActivityTypeByName(name: string): ActivityTypeRow | null {
  const row = getDb()
    .prepare('SELECT * FROM activity_types WHERE name = ?')
    .get(name) as ActivityTypeRow | undefined;
  return row ?? null;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export interface CreateActivityTypeInput {
  name: string;
  icon_name?: string | null;
}

export interface PatchActivityTypeInput {
  name?: string;
  icon_name?: string | null;
}

export function createActivityType(input: CreateActivityTypeInput): ActivityTypeRow {
  const db = getDb();
  const maxOrder = (db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM activity_types')
    .get() as { m: number }).m;

  const result = db
    .prepare(
      `INSERT INTO activity_types (name, icon_name, sort_order) VALUES (@name, @icon_name, @sort_order)`,
    )
    .run({
      name: input.name,
      icon_name: input.icon_name ?? null,
      sort_order: maxOrder + 1,
    });

  return findActivityTypeById(result.lastInsertRowid as number)!;
}

export function updateActivityType(id: number, input: PatchActivityTypeInput): ActivityTypeRow | null {
  const db = getDb();
  const cur = db
    .prepare('SELECT * FROM activity_types WHERE id = ?')
    .get(id) as ActivityTypeRow | undefined;
  if (!cur) return null;

  db.prepare(
    `UPDATE activity_types SET name = @name, icon_name = @icon_name WHERE id = @id`,
  ).run({
    id,
    name: input.name ?? cur.name,
    icon_name: input.icon_name !== undefined ? input.icon_name : cur.icon_name,
  });

  return findActivityTypeById(id);
}

export function deleteActivityType(id: number): void {
  const db = getDb();
  // Prevent deletion if activities still reference this type
  const usage = db
    .prepare('SELECT COUNT(*) AS cnt FROM activities WHERE activity_type_id = ?')
    .get(id) as { cnt: number };
  if (usage.cnt > 0) {
    throw new Error(`Cannot delete activity type: ${usage.cnt} activities still reference it`);
  }
  // At least one activity type must always exist
  const total = db
    .prepare('SELECT COUNT(*) AS cnt FROM activity_types')
    .get() as { cnt: number };
  if (total.cnt <= 1) {
    throw new Error('Cannot delete the last activity type');
  }
  db.prepare('DELETE FROM activity_types WHERE id = ?').run(id);
}

export function reorderActivityTypes(orderedIds: number[]): ActivityTypeRow[] {
  const db = getDb();
  const update = db.prepare('UPDATE activity_types SET sort_order = ? WHERE id = ?');
  db.transaction(() => {
    orderedIds.forEach((id, index) => update.run(index, id));
  })();
  return findAllActivityTypes();
}
