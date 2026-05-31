import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/db/api-client';
import type { ActivityTypeRow } from '@/types/db';

interface CreateInput { name: string; icon_name?: string | null }
interface PatchInput  { name?: string; icon_name?: string | null }

interface UseActivityTypesReturn {
  types: ActivityTypeRow[];
  isLoading: boolean;
  error: Error | null;
  createType: (input: CreateInput) => Promise<ActivityTypeRow>;
  updateType: (id: number, input: PatchInput) => Promise<ActivityTypeRow>;
  deleteType: (id: number) => Promise<void>;
  reorderTypes: (orderedIds: number[]) => Promise<ActivityTypeRow[]>;
}

export function useActivityTypes(): UseActivityTypesReturn {
  const qc = useQueryClient();

  const { data: types = [], isLoading, error } = useQuery({
    queryKey: ['activity-types'],
    queryFn: () => api.get<ActivityTypeRow[]>('/activity-types'),
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateInput) => api.post<ActivityTypeRow>('/activity-types', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['activity-types'] });
      toast.success('Activity type added');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create activity type');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: PatchInput }) =>
      api.patch<ActivityTypeRow>(`/activity-types/${id}`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['activity-types'] });
      toast.success('Activity type updated');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update activity type');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete<void>(`/activity-types/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['activity-types'] });
      toast.success('Activity type deleted');
    },
    onError: (err) => {
      const msg = err instanceof ApiError
        ? (err.body['error'] as string | undefined) ?? err.message
        : 'Failed to delete activity type';
      toast.error(msg);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: number[]) =>
      api.put<ActivityTypeRow[]>('/activity-types/reorder', { orderedIds }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['activity-types'] });
      toast.success('Order updated');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to reorder activity types');
    },
  });

  return {
    types,
    isLoading,
    error: error ?? null,
    createType: (input) => createMutation.mutateAsync(input),
    updateType: (id, input) => updateMutation.mutateAsync({ id, input }),
    deleteType: (id) => deleteMutation.mutateAsync(id),
    reorderTypes: (orderedIds) => reorderMutation.mutateAsync(orderedIds),
  };
}
