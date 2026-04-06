import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '@/db/api-client';
import { Trip } from '@/domain/Trip';
import { Activity } from '@/domain/Activity';
import type { TripData } from '@/domain/Trip';
import type { TripWithDays, DayWithActivities } from '@/types/domain';
import type { ActivityRow, DayRow } from '@/types/db';
import type { UpdateTripInput } from '@/db/repositories/trips.repo';

// Raw shape returned by GET /trips/:id/full before domain class wrapping.
interface RawTripFull {
  days: Array<DayRow & { activities: ActivityRow[] }>;
  [key: string]: unknown;
}

interface UseTripReturn {
  trip: TripWithDays | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  updateTrip: (input: UpdateTripInput) => Promise<TripWithDays>;
  deleteTrip: () => Promise<void>;
}

function buildTripWithDays(raw: RawTripFull): TripWithDays {
  const days: DayWithActivities[] = raw.days.map(day => ({
    ...day,
    activities: day.activities.map(a => new Activity(a)),
  }));
  // Reason: Object.assign adds days onto the Trip class instance so all
  // domain methods (isOngoing, computeProgress, etc.) remain callable.
  return Object.assign(new Trip(raw as unknown as TripData), { days }) as TripWithDays;
}

export function useTrip(id: number): UseTripReturn {
  const [trip, setTrip] = useState<TripWithDays | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback((): void => {
    setLoading(true);
    api.get<RawTripFull>(`/trips/${id}/full`)
      .then(raw => { setTrip(buildTripWithDays(raw)); setError(null); setLoading(false); })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Unknown error');
        setLoading(false);
      });
  }, [id]);

  useEffect(() => { refetch(); }, [refetch]);

  const updateTrip = useCallback(async (input: UpdateTripInput): Promise<TripWithDays> => {
    await api.patch(`/trips/${id}`, input);
    const raw = await api.get<RawTripFull>(`/trips/${id}/full`);
    const updated = buildTripWithDays(raw);
    setTrip(updated);
    toast.success('Trip updated');
    return updated;
  }, [id]);

  const deleteTrip = useCallback(async (): Promise<void> => {
    await api.delete(`/trips/${id}`);
    setTrip(null);
    toast.success('Trip deleted');
  }, [id]);

  return { trip, loading, error, refetch, updateTrip, deleteTrip };
}
