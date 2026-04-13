import { useState, useCallback, useEffect, useMemo } from 'react';
import { api } from '@/db/api-client';
import type { CalendarDayRow } from '@/types/db';

interface UseCalendarDaysReturn {
  days: CalendarDayRow[];
  byDate: Record<string, CalendarDayRow>;
  isLoading: boolean;
}

export function useCalendarDays(tripId: number): UseCalendarDaysReturn {
  const [days, setDays] = useState<CalendarDayRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback((): void => {
    setIsLoading(true);
    api.get<CalendarDayRow[]>(`/trips/${tripId}/calendar-days`)
      .then(data => { setDays(data); setIsLoading(false); })
      .catch(() => { setIsLoading(false); });
  }, [tripId]);

  useEffect(() => { refetch(); }, [refetch]);

  // Reason: keyed lookup avoids O(n) scans when rendering the grid cells.
  const byDate = useMemo<Record<string, CalendarDayRow>>(() => {
    const map: Record<string, CalendarDayRow> = {};
    for (const day of days) map[day.date] = day;
    return map;
  }, [days]);

  return { days, byDate, isLoading };
}
