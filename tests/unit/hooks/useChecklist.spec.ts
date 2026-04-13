import { describe, it, expect } from 'vitest';
import { ChecklistItem } from '@/domain/ChecklistItem';
import type { ChecklistItemRow } from '@/types/db';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<ChecklistItemRow> = {}): ChecklistItemRow {
  return {
    id: 1, trip_id: 1, label: 'Item', category: 'other',
    is_checked: 0, sort_order: 0, source: 'template',
    created_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Pure implementation of the `grouped` derive logic from useChecklist.
 * Extracted here so it can be tested without React.
 */
function buildGrouped(rows: ChecklistItemRow[]): Record<string, ChecklistItem[]> {
  const items = rows.map(r => new ChecklistItem(r));
  const map: Record<string, ChecklistItem[]> = {};
  for (const item of items) {
    if (!map[item.category]) map[item.category] = [];
    map[item.category].push(item);
  }
  return Object.fromEntries(
    Object.entries(map).sort(([a], [b]) => a.localeCompare(b)),
  );
}

/**
 * Pure implementation of the optimistic toggle flip.
 * Mirrors the setRows updater inside useChecklist.toggle.
 */
function applyToggle(
  rows: ChecklistItemRow[],
  id: number,
  checked: boolean,
): ChecklistItemRow[] {
  return rows.map(r => r.id === id ? { ...r, is_checked: checked ? 1 : 0 } : r);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useChecklist — grouped derive logic', () => {
  it('groups items by category', () => {
    const rows = [
      makeRow({ id: 1, category: 'tech' }),
      makeRow({ id: 2, category: 'documents' }),
      makeRow({ id: 3, category: 'tech' }),
    ];
    const grouped = buildGrouped(rows);
    expect(Object.keys(grouped)).toEqual(['documents', 'tech']);
    expect(grouped['tech']).toHaveLength(2);
    expect(grouped['documents']).toHaveLength(1);
  });

  it('sorts category keys alphabetically', () => {
    const rows = [
      makeRow({ id: 1, category: 'toiletries' }),
      makeRow({ id: 2, category: 'clothing' }),
      makeRow({ id: 3, category: 'health' }),
    ];
    const keys = Object.keys(buildGrouped(rows));
    expect(keys).toEqual(['clothing', 'health', 'toiletries']);
  });

  it('returns empty object for no items', () => {
    expect(buildGrouped([])).toEqual({});
  });
});

describe('useChecklist — optimistic toggle', () => {
  it('flips is_checked from 0 to 1 for the target id', () => {
    const rows = [makeRow({ id: 1, is_checked: 0 }), makeRow({ id: 2, is_checked: 0 })];
    const updated = applyToggle(rows, 1, true);
    expect(updated[0]?.is_checked).toBe(1);
    expect(updated[1]?.is_checked).toBe(0); // unchanged
  });

  it('flips is_checked from 1 to 0 for the target id', () => {
    const rows = [makeRow({ id: 1, is_checked: 1 })];
    const updated = applyToggle(rows, 1, false);
    expect(updated[0]?.is_checked).toBe(0);
  });

  it('reverts on error — applying the opposite flip restores original state', () => {
    const rows = [makeRow({ id: 1, is_checked: 0 })];
    // Optimistic flip
    const optimistic = applyToggle(rows, 1, true);
    expect(optimistic[0]?.is_checked).toBe(1);
    // Simulate revert (API returned 500)
    const reverted = applyToggle(optimistic, 1, false);
    expect(reverted[0]?.is_checked).toBe(0);
  });
});
