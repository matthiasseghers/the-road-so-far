import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/db/api-client';
import type { ChecklistTemplateRow, TemplateItemRow } from '@/types/db';

export interface TemplateWithItems extends ChecklistTemplateRow {
  items: TemplateItemRow[];
}

interface UseTemplateEditorReturn {
  templates: TemplateWithItems[];
  isLoading: boolean;
  addTemplate: (name: string) => Promise<void>;
  renameTemplate: (id: number, name: string) => Promise<void>;
  deleteTemplate: (id: number) => Promise<void>;
  addItem: (templateId: number, label: string, category: string) => Promise<void>;
  deleteItem: (templateId: number, itemId: number) => Promise<void>;
  reorderItems: (templateId: number, ids: number[]) => void;
}

async function fetchAllTemplates(): Promise<TemplateWithItems[]> {
  const tmpl = await api.get<ChecklistTemplateRow[]>('/checklist-templates');
  return Promise.all(
    tmpl.map(async t => {
      const items = await api.get<TemplateItemRow[]>(`/template-items?templateId=${t.id}`);
      return { ...t, items };
    }),
  );
}

export function useTemplateEditor(): UseTemplateEditorReturn {
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: fetchAllTemplates,
    // Reason: templates are user-defined static data; every mutation already invalidates
    // this query, so background refetching is wasted work.
    staleTime: Infinity,
  });

  const addTemplateMutation = useMutation({
    mutationFn: (name: string) => api.post<ChecklistTemplateRow>('/checklist-templates', { name }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });

  const renameTemplateMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.patch<ChecklistTemplateRow>(`/checklist-templates/${id}`, { name }),
    onSuccess: (_data, { id, name }) => {
      // Reason: update cache directly rather than invalidating to avoid a full
      // N+1 re-fetch (fetchAllTemplates fetches items for every template).
      queryClient.setQueryData<TemplateWithItems[]>(['templates'], prev =>
        prev?.map(t => t.id === id ? { ...t, name } : t) ?? [],
      );
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: number) => api.delete<void>(`/checklist-templates/${id}`),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<TemplateWithItems[]>(['templates'], prev =>
        prev?.filter(t => t.id !== id) ?? [],
      );
    },
  });

  const addItemMutation = useMutation({
    mutationFn: ({ templateId, label, category }: { templateId: number; label: string; category: string }) =>
      api.post<TemplateItemRow>('/template-items', { template_id: templateId, label, category }),
    onSuccess: (item, { templateId }) => {
      queryClient.setQueryData<TemplateWithItems[]>(['templates'], prev =>
        prev?.map(t => t.id === templateId ? { ...t, items: [...t.items, item] } : t) ?? [],
      );
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: ({ itemId }: { templateId: number; itemId: number }) =>
      api.delete<void>(`/template-items/${itemId}`),
    onSuccess: (_data, { templateId, itemId }) => {
      queryClient.setQueryData<TemplateWithItems[]>(['templates'], prev =>
        prev?.map(t =>
          t.id === templateId ? { ...t, items: t.items.filter(i => i.id !== itemId) } : t,
        ) ?? [],
      );
    },
  });

  // Reason: reorderItems is optimistic and void — sort_order is only used for
  // initial ordering on next mount, so a brief local/server divergence is acceptable.
  const reorderItemsMutation = useMutation({
    mutationFn: ({ templateId, ids }: { templateId: number; ids: number[] }) =>
      api.put<void>('/template-items/reorder', { templateId, ids }),
    onMutate: async ({ templateId, ids }) => {
      await queryClient.cancelQueries({ queryKey: ['templates'] });
      const previous = queryClient.getQueryData<TemplateWithItems[]>(['templates']);
      queryClient.setQueryData<TemplateWithItems[]>(['templates'], prev =>
        prev?.map(t => {
          if (t.id !== templateId) return t;
          const byId = new Map(t.items.map(i => [i.id, i]));
          const reordered = ids.map((id, idx) => ({ ...byId.get(id)!, sort_order: idx }));
          const rest = t.items.filter(i => !ids.includes(i.id));
          return { ...t, items: [...reordered, ...rest] };
        }) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['templates'], context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  const addTemplate = async (name: string): Promise<void> => {
    try { await addTemplateMutation.mutateAsync(name); } catch { /* ignored */ }
  };

  const renameTemplate = async (id: number, name: string): Promise<void> => {
    try { await renameTemplateMutation.mutateAsync({ id, name }); } catch { /* ignored */ }
  };

  const deleteTemplate = async (id: number): Promise<void> => {
    try { await deleteTemplateMutation.mutateAsync(id); } catch { /* ignored */ }
  };

  const addItem = async (templateId: number, label: string, category: string): Promise<void> => {
    try { await addItemMutation.mutateAsync({ templateId, label, category }); } catch { /* ignored */ }
  };

  const deleteItem = async (templateId: number, itemId: number): Promise<void> => {
    try { await deleteItemMutation.mutateAsync({ templateId, itemId }); } catch { /* ignored */ }
  };

  const reorderItems = (templateId: number, ids: number[]): void => {
    reorderItemsMutation.mutate({ templateId, ids });
  };

  return { templates, isLoading, addTemplate, renameTemplate, deleteTemplate, addItem, deleteItem, reorderItems };
}
