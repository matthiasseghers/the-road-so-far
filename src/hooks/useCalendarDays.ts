import { useState, useCallback, useEffect, useMemo } from 'react';
import { api } from '@/db/api-client';
import type { CalendarDayRow } from '@/types/db';

interface UseCalendarDaysReturn {
  days: CalendarDayRow[];
  byDate: Record<string, CalendarDayRow>;
  isLoading: boolean;
  error: string | null;
}

export function useCalendarDays(tripId: number): UseCalendarDaysReturn {
  const [days, setDays] = useState<CalendarDayRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback((): void => {
    setIsLoading(true);
    api.get<CalendarDayRow[]>(`/trips/${tripId}/calendar-days`)
      .then(data => { setDays(data); setError(null); setIsLoading(false); })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load calendar days');
        setIsLoading(false);
      });
  }, [tripId]);

  useEffect(() => { refetch(); }, [refetch]);

  // Reason: keyed lookup avoids O(n) scans when rendering the grid cells.
  const byDate = useMemo<Record<string, CalendarDayRow>>(() => {
    const map: Record<string, CalendarDayRow> = {};
    for (const day of days) map[day.date] = day;
    return map;
  }, [days]);

  return { days, byDate, isLoading, error };
}
