import { describe, it, expect } from 'vitest';
import { ChecklistItem } from '@/domain/ChecklistItem';
import type { ChecklistItemRow } from '@/types/db';

function makeRow(overrides: Partial<ChecklistItemRow> = {}): ChecklistItemRow {
  return {
    id: 1,
    trip_id: 10,
    label: 'Passport',
    category: 'documents',
    is_checked: 0,
    sort_order: 0,
    source: 'template',
    created_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ChecklistItem domain class', () => {
  describe('isChecked', () => {
    it('returns false when is_checked is 0', () => {
      const item = new ChecklistItem(makeRow({ is_checked: 0 }));
      expect(item.isChecked).toBe(false);
    });

    it('returns true when is_checked is 1', () => {
      const item = new ChecklistItem(makeRow({ is_checked: 1 }));
      expect(item.isChecked).toBe(true);
    });
  });

  describe('plain getters', () => {
    it('exposes id', () => {
      expect(new ChecklistItem(makeRow({ id: 42 })).id).toBe(42);
    });

    it('exposes trip_id', () => {
      expect(new ChecklistItem(makeRow({ trip_id: 99 })).trip_id).toBe(99);
    });

    it('exposes label', () => {
      expect(new ChecklistItem(makeRow({ label: 'Sunscreen' })).label).toBe('Sunscreen');
    });

    it('exposes category', () => {
      expect(new ChecklistItem(makeRow({ category: 'health' })).category).toBe('health');
    });

    it('exposes sort_order', () => {
      expect(new ChecklistItem(makeRow({ sort_order: 5 })).sort_order).toBe(5);
    });

    it('exposes source', () => {
      expect(new ChecklistItem(makeRow({ source: 'trip' })).source).toBe('trip');
    });

    it('exposes created_at', () => {
      const ts = '2025-06-15T08:00:00.000Z';
      expect(new ChecklistItem(makeRow({ created_at: ts })).created_at).toBe(ts);
    });
  });
});
