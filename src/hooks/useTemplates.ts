import { useState, useCallback, useEffect } from 'react';
import { api } from '@/db/api-client';
import type { ChecklistTemplateRow, TemplateItemRow } from '@/types/domain';
import type {
  CreateTemplateInput,
  UpdateTemplateInput,
} from '@/db/repositories/checklist.repo';

interface UseTemplatesReturn {
  templates: ChecklistTemplateRow[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  getTemplateItems: (templateId: number) => Promise<TemplateItemRow[]>;
  createTemplate: (input: CreateTemplateInput) => Promise<ChecklistTemplateRow>;
  updateTemplate: (id: number, input: UpdateTemplateInput) => Promise<ChecklistTemplateRow>;
  deleteTemplate: (id: number) => Promise<void>;
}

export function useTemplates(): UseTemplatesReturn {
  const [templates, setTemplates] = useState<ChecklistTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback((): void => {
    setLoading(true);
    api.get<ChecklistTemplateRow[]>('/checklist-templates')
      .then(data => { setTemplates(data); setError(null); setLoading(false); })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Unknown error');
        setLoading(false);
      });
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const getTemplateItems = useCallback(async (templateId: number): Promise<TemplateItemRow[]> => {
    return api.get<TemplateItemRow[]>(`/template-items?templateId=${templateId}`);
  }, []);

  const createTemplate = useCallback(async (input: CreateTemplateInput): Promise<ChecklistTemplateRow> => {
    const template = await api.post<ChecklistTemplateRow>('/checklist-templates', input);
    refetch();
    return template;
  }, [refetch]);

  const updateTemplate = useCallback(async (id: number, input: UpdateTemplateInput): Promise<ChecklistTemplateRow> => {
    const template = await api.patch<ChecklistTemplateRow>(`/checklist-templates/${id}`, input);
    refetch();
    return template;
  }, [refetch]);

  const deleteTemplate = useCallback(async (id: number): Promise<void> => {
    await api.delete(`/checklist-templates/${id}`);
    refetch();
  }, [refetch]);

  return { templates, loading, error, refetch, getTemplateItems, createTemplate, updateTemplate, deleteTemplate };
}
