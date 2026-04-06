import { useState, useCallback, useEffect } from 'react';
import { api } from '@/db/api-client';
import type { ChecklistItemRow } from '@/types/domain';
import type {
  CreateChecklistItemInput,
  UpdateChecklistItemInput,
} from '@/db/repositories/checklist.repo';

interface UseChecklistReturn {
  items: ChecklistItemRow[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  createItem: (input: CreateChecklistItemInput) => Promise<ChecklistItemRow>;
  updateItem: (id: number, input: UpdateChecklistItemInput) => Promise<ChecklistItemRow>;
  deleteItem: (id: number) => Promise<void>;
  copyTemplates: (templateIds: number[]) => Promise<ChecklistItemRow[]>;
}

export function useChecklist(tripId: number): UseChecklistReturn {
  const [items, setItems] = useState<ChecklistItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback((): void => {
    setLoading(true);
    api.get<ChecklistItemRow[]>(`/checklist-items?tripId=${tripId}`)
      .then(data => { setItems(data); setError(null); setLoading(false); })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Unknown error');
        setLoading(false);
      });
  }, [tripId]);

  useEffect(() => { refetch(); }, [refetch]);

  const createItem = useCallback(async (input: CreateChecklistItemInput): Promise<ChecklistItemRow> => {
    const item = await api.post<ChecklistItemRow>('/checklist-items', input);
    refetch();
    return item;
  }, [refetch]);

  const updateItem = useCallback(async (id: number, input: UpdateChecklistItemInput): Promise<ChecklistItemRow> => {
    const item = await api.patch<ChecklistItemRow>(`/checklist-items/${id}`, input);
    refetch();
    return item;
  }, [refetch]);

  const deleteItem = useCallback(async (id: number): Promise<void> => {
    await api.delete(`/checklist-items/${id}`);
    refetch();
  }, [refetch]);

  const copyTemplates = useCallback(async (templateIds: number[]): Promise<ChecklistItemRow[]> => {
    const newItems = await api.post<ChecklistItemRow[]>('/checklist-items/copy-templates', {
      tripId,
      templateIds,
    });
    refetch();
    return newItems;
  }, [tripId, refetch]);

  return { items, loading, error, refetch, createItem, updateItem, deleteItem, copyTemplates };
}
