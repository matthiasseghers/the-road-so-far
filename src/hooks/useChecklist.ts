import { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { api } from '@/db/api-client';
import { ChecklistItem } from '@/domain/ChecklistItem';
import type { ChecklistItemRow } from '@/types/db';

interface UseChecklistReturn {
  items: ChecklistItem[];
  grouped: Record<string, ChecklistItem[]>;
  add(label: string, category: string | null): Promise<void>;
  toggle(id: number, checked: boolean): Promise<void>;
  remove(id: number): Promise<void>;
  renameCategory(oldCat: string, newCat: string): Promise<void>;
  removeCategory(cat: string): Promise<void>;
  applyTemplates(templateIds: number[]): Promise<void>;
  reorder(ids: number[]): void;
  isLoading: boolean;
  error: string | null;
}

export function useChecklist(tripId: number): UseChecklistReturn {
  const [rows, setRows] = useState<ChecklistItemRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback((): void => {
    setIsLoading(true);
    api.get<ChecklistItemRow[]>(`/trips/${tripId}/checklist`)
      .then(data => { setRows(data); setError(null); setIsLoading(false); })
      .catch((e: unknown) => { setError(e instanceof Error ? e.message : 'Unknown error'); setIsLoading(false); });
  }, [tripId]);

  useEffect(() => { refetch(); }, [refetch]);

  const items = useMemo(() => rows.map(r => new ChecklistItem(r)), [rows]);

  const grouped = useMemo<Record<string, ChecklistItem[]>>(() => {
    const map: Record<string, ChecklistItem[]> = {};
    for (const item of items) {
      // Reason: items with null category are intentionally uncategorised — exclude from grouped sidebar nav
      if (!item.category) continue;
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    }
    // Sort keys alphabetically
    return Object.fromEntries(
      Object.entries(map).sort(([a], [b]) => a.localeCompare(b)),
    );
  }, [items]);

  const add = useCallback(async (label: string, category: string | null): Promise<void> => {
    try {
      await api.post<ChecklistItemRow>(`/trips/${tripId}/checklist`, { label, category });
      refetch();
      toast.success('Item added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add item');
    }
  }, [tripId, refetch]);

  const toggle = useCallback(async (id: number, checked: boolean): Promise<void> => {
    // Optimistic update: flip the item locally before the API round-trip
    setRows(prev =>
      prev.map(r => r.id === id ? { ...r, is_checked: checked ? 1 : 0 } : r),
    );
    try {
      await api.patch<ChecklistItemRow>(`/trips/${tripId}/checklist/${id}`, { is_checked: checked });
    } catch {
      // Revert on failure
      setRows(prev =>
        prev.map(r => r.id === id ? { ...r, is_checked: checked ? 0 : 1 } : r),
      );
      toast.error('Failed to update checklist item');
    }
  }, [tripId]);

  const remove = useCallback(async (id: number): Promise<void> => {
    try {
      await api.delete(`/trips/${tripId}/checklist/${id}`);
      setRows(prev => prev.filter(r => r.id !== id));
      toast.success('Item deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete item');
    }
  }, [tripId]);

  const renameCategory = useCallback(async (oldCat: string, newCat: string): Promise<void> => {
    try {
      await api.patch(`/trips/${tripId}/checklist/category/${encodeURIComponent(oldCat)}`, { name: newCat });
      setRows(prev => prev.map(r => r.category === oldCat ? { ...r, category: newCat } : r));
      toast.success('Category renamed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to rename category');
    }
  }, [tripId]);

  const removeCategory = useCallback(async (cat: string): Promise<void> => {
    try {
      await api.delete(`/trips/${tripId}/checklist/category/${encodeURIComponent(cat)}`);
      setRows(prev => prev.filter(r => r.category !== cat));
      toast.success('Category deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete category');
    }
  }, [tripId]);

  const applyTemplates = useCallback(async (templateIds: number[]): Promise<void> => {
    if (templateIds.length === 0) return;
    try {
      const { inserted, skipped } = await api.post<{ items: unknown[]; inserted: number; skipped: number }>(
        '/checklist-items/copy-templates',
        { tripId, templateIds },
      );
      refetch();
      if (inserted > 0 && skipped === 0) {
        toast.success(`${inserted} item${inserted === 1 ? '' : 's'} added`);
      } else if (inserted > 0 && skipped > 0) {
        toast.success(`${inserted} item${inserted === 1 ? '' : 's'} added, ${skipped} already present and skipped`);
      } else {
        toast.info('All items already in checklist — nothing added');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply template');
    }
  }, [tripId, refetch]);

  // Reason: optimistic — reorder rows locally immediately, then persist in background.
  // No refetch needed; sort_order is only used for initial ordering on next mount.
  const reorder = useCallback((ids: number[]): void => {
    setRows(prev => {
      const byId = new Map(prev.map(r => [r.id, r]));
      const reordered = ids.map((id, idx) => ({ ...byId.get(id)!, sort_order: idx }));
      const rest = prev.filter(r => !ids.includes(r.id));
      return [...reordered, ...rest];
    });
    void api.put(`/trips/${tripId}/checklist/reorder`, { ids }).catch(() => {
      // On failure just refetch to restore server order
      refetch();
    });
  }, [tripId, refetch]);

  return { items, grouped, add, toggle, remove, renameCategory, removeCategory, applyTemplates, reorder, isLoading, error };
}

