import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/db/api-client';
import type { CalendarDayRow } from '@/types/db';

interface UseCalendarDaysReturn {
  days: CalendarDayRow[];
  byDate: Record<string, CalendarDayRow>;
  isLoading: boolean;
  error: string | null;
}

export function useCalendarDays(tripId: number): UseCalendarDaysReturn {
  const { data: days = [], isLoading, error } = useQuery({
    queryKey: ['calendar-days', tripId],
    queryFn: () => api.get<CalendarDayRow[]>(`/trips/${tripId}/calendar-days`),
    staleTime: 30_000,
  });

  // Reason: keyed lookup avoids O(n) scans when rendering the grid cells.
  const byDate = useMemo<Record<string, CalendarDayRow>>(() => {
    const map: Record<string, CalendarDayRow> = {};
    for (const day of days) map[day.date] = day;
    return map;
  }, [days]);

  return { days, byDate, isLoading, error: error ? error.message : null };
}
