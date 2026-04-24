import { useState, useCallback, useEffect } from 'react';
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

export function useTemplateEditor(): UseTemplateEditorReturn {
  const [templates, setTemplates] = useState<TemplateWithItems[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async (): Promise<void> => {
    const tmpl = await api.get<ChecklistTemplateRow[]>('/checklist-templates');
    const withItems: TemplateWithItems[] = await Promise.all(
      tmpl.map(async t => {
        const items = await api.get<TemplateItemRow[]>(`/template-items?templateId=${t.id}`);
        return { ...t, items };
      }),
    );
    setTemplates(withItems);
    setIsLoading(false);
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const addTemplate = useCallback(async (name: string): Promise<void> => {
    await api.post<ChecklistTemplateRow>('/checklist-templates', { name });
    await fetchAll();
  }, [fetchAll]);

  const renameTemplate = useCallback(async (id: number, name: string): Promise<void> => {
    await api.patch<ChecklistTemplateRow>(`/checklist-templates/${id}`, { name });
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, name } : t));
  }, []);

  const deleteTemplate = useCallback(async (id: number): Promise<void> => {
    await api.delete(`/checklist-templates/${id}`);
    setTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

  const addItem = useCallback(async (
    templateId: number,
    label: string,
    category: string,
  ): Promise<void> => {
    const item = await api.post<TemplateItemRow>('/template-items', {
      template_id: templateId,
      label,
      category,
    });
    setTemplates(prev =>
      prev.map(t => t.id === templateId ? { ...t, items: [...t.items, item] } : t),
    );
  }, []);

  const deleteItem = useCallback(async (templateId: number, itemId: number): Promise<void> => {
    await api.delete(`/template-items/${itemId}`);
    setTemplates(prev =>
      prev.map(t =>
        t.id === templateId ? { ...t, items: t.items.filter(i => i.id !== itemId) } : t,
      ),
    );
  }, []);

  const reorderItems = useCallback((templateId: number, ids: number[]): void => {
    // Optimistic: update local order immediately.
    setTemplates(prev => prev.map(t => {
      if (t.id !== templateId) return t;
      const byId = new Map(t.items.map(i => [i.id, i]));
      const reordered = ids.map((id, idx) => ({ ...byId.get(id)!, sort_order: idx }));
      const rest = t.items.filter(i => !ids.includes(i.id));
      return { ...t, items: [...reordered, ...rest] };
    }));
    void api.put('/template-items/reorder', { templateId, ids }).catch(() => {
      void fetchAll();
    });
  }, [fetchAll]);

  return { templates, isLoading, addTemplate, renameTemplate, deleteTemplate, addItem, deleteItem, reorderItems };
}
