import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/db/api-client';
import type { DayRow } from '@/types/db';
import type { UpdateDayInput } from '@/db/repositories/days.repo';

interface UseDaysReturn {
  days: DayRow[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  updateDay: (id: number, input: UpdateDayInput) => Promise<DayRow>;
}

export function useDays(tripId: number): UseDaysReturn {
  const queryClient = useQueryClient();

  const { data: days = [], isLoading, error, refetch: rqRefetch } = useQuery({
    queryKey: ['days', tripId],
    queryFn: () => api.get<DayRow[]>(`/days?tripId=${tripId}`),
    staleTime: 30_000,
  });

  const refetch = (): void => { void rqRefetch(); };

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateDayInput }) =>
      api.patch<DayRow>(`/days/${id}`, input),
    onSuccess: () => {
      // Reason: invalidate both the flat days list and the full trip (which embeds
      // day title/subtitle inline) so all consumers see the updated data.
      void queryClient.invalidateQueries({ queryKey: ['days', tripId] });
      void queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      toast.success('Day updated');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update day');
    },
  });

  const updateDay = async (id: number, input: UpdateDayInput): Promise<DayRow> => {
    return updateMutation.mutateAsync({ id, input });
  };

  return { days, isLoading, error: error ? error.message : null, refetch, updateDay };
}
