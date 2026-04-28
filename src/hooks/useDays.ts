import { useState, useCallback, useEffect } from 'react';
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
  const [days, setDays] = useState<DayRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback((): void => {
    setIsLoading(true);
    api.get<DayRow[]>(`/days?tripId=${tripId}`)
      .then(data => { setDays(data); setError(null); setIsLoading(false); })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Unknown error');
        setIsLoading(false);
      });
  }, [tripId]);

  useEffect(() => { refetch(); }, [refetch]);

  const updateDay = useCallback(async (id: number, input: UpdateDayInput): Promise<DayRow> => {
    try {
      const day = await api.patch<DayRow>(`/days/${id}`, input);
      refetch();
      toast.success('Day updated');
      return day;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update day');
      throw err;
    }
  }, [refetch]);

  return { days, isLoading, error, refetch, updateDay };
}
