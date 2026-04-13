import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../helpers/db';
import type Database from 'better-sqlite3';

let db: Database.Database;

vi.mock('@/db/client', () => ({
  getDb: () => db,
}));

const {
  findChecklistItemsByTripId,
  findChecklistItemById,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  getDistinctCategories,
  copyTemplatesToTrip,
  findAllTemplates,
} = await import('@/db/repositories/checklist.repo');

/** Insert a bare trip row so FK constraints pass. Returns the new trip id. */
function insertTrip(id: number): number {
  db.prepare(
    `INSERT OR IGNORE INTO trips (id, title, status, cover_gradient, emoji, tags)
     VALUES (?, 'Test Trip', 'planning', 'warm-brown', '🗺️', '[]')`,
  ).run(id);
  return id;
}

/** Insert a minimal template and one item into the in-memory DB. */
function seedTemplate(name: string, isBase: 0 | 1 = 0) {
  const r = db.prepare(
    `INSERT INTO checklist_templates (name, icon_name, is_base, sort_order) VALUES (?,?,?,0)`,
  ).run(name, null, isBase);
  return Number(r.lastInsertRowid);
}

function seedTemplateItem(templateId: number, label: string, category: string) {
  db.prepare(
    `INSERT INTO template_items (template_id, label, category, sort_order) VALUES (?,?,?,0)`,
  ).run(templateId, label, category);
}

describe('checklist repository', () => {
  beforeEach(() => {
    db = createTestDb();
    // Pre-create trip rows so FK constraints pass
    insertTrip(1);
    insertTrip(2);
  });

  // ── CRUD ──────────────────────────────────────────────────────────────────

  describe('createChecklistItem()', () => {
    it('inserts a row and returns it', () => {
      const item = createChecklistItem({ trip_id: 1, label: 'Passport', category: 'documents' });
      expect(item.id).toBeGreaterThan(0);
      expect(item.label).toBe('Passport');
      expect(item.category).toBe('documents');
      expect(item.is_checked).toBe(0);
      expect(item.source).toBe('trip');
    });

    it('defaults source to trip', () => {
      const item = createChecklistItem({ trip_id: 1, label: 'Sunscreen' });
      expect(item.source).toBe('trip');
    });
  });

  describe('findChecklistItemsByTripId()', () => {
    it('returns empty array when no items', () => {
      expect(findChecklistItemsByTripId(1)).toEqual([]);
    });

    it('returns only items for the specified trip', () => {
      createChecklistItem({ trip_id: 1, label: 'A' });
      createChecklistItem({ trip_id: 2, label: 'B' });
      expect(findChecklistItemsByTripId(1)).toHaveLength(1);
    });

    it('orders by category then sort_order', () => {
      createChecklistItem({ trip_id: 1, label: 'Z Tech', category: 'tech', sort_order: 0 });
      createChecklistItem({ trip_id: 1, label: 'A Docs', category: 'documents', sort_order: 0 });
      const items = findChecklistItemsByTripId(1);
      expect(items[0]?.category).toBe('documents');
      expect(items[1]?.category).toBe('tech');
    });
  });

  describe('findChecklistItemById()', () => {
    it('returns the item by id', () => {
      const created = createChecklistItem({ trip_id: 1, label: 'Phone' });
      const found = findChecklistItemById(created.id);
      expect(found).not.toBeNull();
      expect(found?.label).toBe('Phone');
    });

    it('returns null for unknown id', () => {
      expect(findChecklistItemById(9999)).toBeNull();
    });
  });

  describe('updateChecklistItem()', () => {
    it('updates label', () => {
      const item = createChecklistItem({ trip_id: 1, label: 'Old Label' });
      const updated = updateChecklistItem(item.id, { label: 'New Label' });
      expect(updated?.label).toBe('New Label');
    });

    it('marks item as checked', () => {
      const item = createChecklistItem({ trip_id: 1, label: 'Task' });
      expect(item.is_checked).toBe(0);
      const updated = updateChecklistItem(item.id, { is_checked: true });
      expect(updated?.is_checked).toBe(1);
    });

    it('marks item as unchecked', () => {
      const item = createChecklistItem({ trip_id: 1, label: 'Task', sort_order: 0 });
      updateChecklistItem(item.id, { is_checked: true });
      const updated = updateChecklistItem(item.id, { is_checked: false });
      expect(updated?.is_checked).toBe(0);
    });

    it('returns null for unknown id', () => {
      expect(updateChecklistItem(9999, { label: 'X' })).toBeNull();
    });
  });

  describe('deleteChecklistItem()', () => {
    it('removes the item', () => {
      const item = createChecklistItem({ trip_id: 1, label: 'Gone' });
      deleteChecklistItem(item.id);
      expect(findChecklistItemById(item.id)).toBeNull();
    });
  });

  // ── Templates ─────────────────────────────────────────────────────────────

  describe('getDistinctCategories()', () => {
    it('returns empty array when no template items', () => {
      expect(getDistinctCategories()).toEqual([]);
    });

    it('returns distinct categories sorted alphabetically', () => {
      const tid = seedTemplate('Test');
      seedTemplateItem(tid, 'Laptop', 'tech');
      seedTemplateItem(tid, 'Passport', 'documents');
      seedTemplateItem(tid, 'Phone', 'tech'); // duplicate category
      const cats = getDistinctCategories();
      expect(cats).toEqual(['documents', 'tech']);
    });
  });

  describe('copyTemplatesToTrip()', () => {
    it('seeds items from the template into the trip', () => {
      const tid = seedTemplate('Base', 1);
      seedTemplateItem(tid, 'Passport', 'documents');
      seedTemplateItem(tid, 'Phone charger', 'tech');

      copyTemplatesToTrip(1, [tid]);

      const items = findChecklistItemsByTripId(1);
      expect(items).toHaveLength(2);
      expect(items.map(i => i.label).sort()).toEqual(['Passport', 'Phone charger'].sort());
      expect(items.every(i => i.source === 'template')).toBe(true);
      expect(items.every(i => i.is_checked === 0)).toBe(true);
    });

    it('seeds from multiple templates', () => {
      const t1 = seedTemplate('Pack 1');
      seedTemplateItem(t1, 'Item A', 'other');
      const t2 = seedTemplate('Pack 2');
      seedTemplateItem(t2, 'Item B', 'other');

      copyTemplatesToTrip(1, [t1, t2]);
      expect(findChecklistItemsByTripId(1)).toHaveLength(2);
    });

    it('seeds nothing when templateIds is empty', () => {
      copyTemplatesToTrip(1, []);
      expect(findChecklistItemsByTripId(1)).toHaveLength(0);
    });

    it('findAllTemplates lists seeded templates', () => {
      seedTemplate('My List', 0);
      const all = findAllTemplates();
      expect(all.length).toBeGreaterThan(0);
    });
  });
});
