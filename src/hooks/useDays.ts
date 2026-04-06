import { useState, useCallback, useEffect } from 'react';
import { api } from '@/db/api-client';
import type { DayRow } from '@/types/db';
import type { UpdateDayInput } from '@/db/repositories/days.repo';

interface UseDaysReturn {
  days: DayRow[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  updateDay: (id: number, input: UpdateDayInput) => Promise<DayRow>;
}

export function useDays(tripId: number): UseDaysReturn {
  const [days, setDays] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback((): void => {
    setLoading(true);
    api.get<DayRow[]>(`/days?tripId=${tripId}`)
      .then(data => { setDays(data); setError(null); setLoading(false); })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Unknown error');
        setLoading(false);
      });
  }, [tripId]);

  useEffect(() => { refetch(); }, [refetch]);

  const updateDay = useCallback(async (id: number, input: UpdateDayInput): Promise<DayRow> => {
    const day = await api.patch<DayRow>(`/days/${id}`, input);
    refetch();
    return day;
  }, [refetch]);

  return { days, loading, error, refetch, updateDay };
}
