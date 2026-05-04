import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['checklist', tripId],
    queryFn: () => api.get<ChecklistItemRow[]>(`/trips/${tripId}/checklist`),
    // Reason: every mutation (add/toggle/remove/reorder) invalidates this query — background refetch is wasted work.
    staleTime: Infinity,
    // Reason: select transforms raw rows to domain instances here so every
    // consumer gets ChecklistItem[] directly without a separate useMemo.
    select: (rows) => rows.map(r => new ChecklistItem(r)),
  });

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

  const addMutation = useMutation({
    mutationFn: ({ label, category }: { label: string; category: string | null }) =>
      api.post<ChecklistItemRow>(`/trips/${tripId}/checklist`, { label, category }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['checklist', tripId] });
      toast.success('Item added');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to add item');
    },
  });

  // Reason: toggle uses the full onMutate/onError/onSettled optimistic pattern so
  // the checkbox flips instantly without waiting for the API round-trip.
  const toggleMutation = useMutation({
    mutationFn: ({ id, checked }: { id: number; checked: boolean }) =>
      api.patch<ChecklistItemRow>(`/trips/${tripId}/checklist/${id}`, { is_checked: checked }),
    onMutate: async ({ id, checked }) => {
      await queryClient.cancelQueries({ queryKey: ['checklist', tripId] });
      const previous = queryClient.getQueryData<ChecklistItemRow[]>(['checklist', tripId]);
      queryClient.setQueryData<ChecklistItemRow[]>(['checklist', tripId], prev =>
        prev?.map(r => r.id === id ? { ...r, is_checked: checked ? 1 : 0 } : r) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['checklist', tripId], context.previous);
      }
      toast.error('Failed to update checklist item');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['checklist', tripId] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => api.delete<void>(`/trips/${tripId}/checklist/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['checklist', tripId] });
      toast.success('Item deleted');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete item');
    },
  });

  const renameCategoryMutation = useMutation({
    mutationFn: ({ oldCat, newCat }: { oldCat: string; newCat: string }) =>
      api.patch<void>(`/trips/${tripId}/checklist/category/${encodeURIComponent(oldCat)}`, { name: newCat }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['checklist', tripId] });
      toast.success('Category renamed');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to rename category');
    },
  });

  const removeCategoryMutation = useMutation({
    mutationFn: (cat: string) =>
      api.delete<void>(`/trips/${tripId}/checklist/category/${encodeURIComponent(cat)}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['checklist', tripId] });
      toast.success('Category deleted');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete category');
    },
  });

  const applyTemplatesMutation = useMutation({
    mutationFn: (templateIds: number[]) =>
      api.post<{ items: unknown[]; inserted: number; skipped: number }>(
        '/checklist-items/copy-templates',
        { tripId, templateIds },
      ),
    onSuccess: ({ inserted, skipped }) => {
      void queryClient.invalidateQueries({ queryKey: ['checklist', tripId] });
      if (inserted > 0 && skipped === 0) {
        toast.success(`${inserted} item${inserted === 1 ? '' : 's'} added`);
      } else if (inserted > 0 && skipped > 0) {
        toast.success(`${inserted} item${inserted === 1 ? '' : 's'} added, ${skipped} already present and skipped`);
      } else {
        toast.info('All items already in checklist — nothing added');
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to apply template');
    },
  });

  // Reason: reorder is optimistic and void — the sort_order is only used for
  // initial ordering on next mount, so a brief local/server divergence is acceptable.
  const reorderMutation = useMutation({
    mutationFn: (ids: number[]) =>
      api.put<void>(`/trips/${tripId}/checklist/reorder`, { ids }),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ['checklist', tripId] });
      const previous = queryClient.getQueryData<ChecklistItemRow[]>(['checklist', tripId]);
      queryClient.setQueryData<ChecklistItemRow[]>(['checklist', tripId], prev => {
        if (!prev) return prev;
        const byId = new Map(prev.map(r => [r.id, r]));
        const reordered = ids.map((id, idx) => ({ ...byId.get(id)!, sort_order: idx }));
        const rest = prev.filter(r => !ids.includes(r.id));
        return [...reordered, ...rest];
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['checklist', tripId], context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['checklist', tripId] });
    },
  });

  const add = async (label: string, category: string | null): Promise<void> => {
    try {
      await addMutation.mutateAsync({ label, category });
    } catch { /* onError handles toast */ }
  };

  const toggle = async (id: number, checked: boolean): Promise<void> => {
    // Reason: use mutate (fire-and-forget) since onMutate already applied the
    // optimistic update synchronously — no need to await the API response.
    toggleMutation.mutate({ id, checked });
  };

  const remove = async (id: number): Promise<void> => {
    try {
      await removeMutation.mutateAsync(id);
    } catch { /* onError handles toast */ }
  };

  const renameCategory = async (oldCat: string, newCat: string): Promise<void> => {
    try {
      await renameCategoryMutation.mutateAsync({ oldCat, newCat });
    } catch { /* onError handles toast */ }
  };

  const removeCategory = async (cat: string): Promise<void> => {
    try {
      await removeCategoryMutation.mutateAsync(cat);
    } catch { /* onError handles toast */ }
  };

  const applyTemplates = async (templateIds: number[]): Promise<void> => {
    if (templateIds.length === 0) return;
    try {
      await applyTemplatesMutation.mutateAsync(templateIds);
    } catch { /* onError handles toast */ }
  };

  // Reason: void return — optimistic update fires synchronously via onMutate.
  const reorder = (ids: number[]): void => {
    reorderMutation.mutate(ids);
  };

  return {
    items,
    grouped,
    add,
    toggle,
    remove,
    renameCategory,
    removeCategory,
    applyTemplates,
    reorder,
    isLoading,
    error: error ? error.message : null,
  };
}

