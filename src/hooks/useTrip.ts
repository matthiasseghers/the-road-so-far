import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/db/api-client';
import { Trip } from '@/domain/Trip';
import { Activity } from '@/domain/Activity';
import type { TripWithDays, DayWithActivities } from '@/types/domain';
import type { UpdateTripInput, RawTripWithDays } from '@/db/repositories/trips.repo';

interface UseTripReturn {
  trip: TripWithDays | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  updateTrip: (input: UpdateTripInput) => Promise<TripWithDays>;
  deleteTrip: () => Promise<void>;
}

// Reason: exported so useMapData can reference the same type when registering
// a query under the shared ['trip', id] key — prevents type divergence.
export type { RawTripWithDays };

export function buildTripWithDays(raw: RawTripWithDays): TripWithDays {
  // Reason: destructure days out so tripFields has the exact TripData shape —
  // ParsedTripRow (tags: string[]) is assignable to TripData (tags: string | string[])
  // once the extra `days` field is separated, removing the need for `as unknown`.
  const { days: rawDays, ...tripFields } = raw;
  const days: DayWithActivities[] = rawDays.map(day => ({
    ...day,
    activities: day.activities.map(a => new Activity(a)),
  }));
  // Reason: Object.assign adds days onto the Trip class instance so all
  // domain methods (isOngoing, computeProgress, etc.) remain callable.
  return Object.assign(new Trip(tripFields), { days }) as TripWithDays;
}

export function useTrip(id: number): UseTripReturn {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch: rqRefetch } = useQuery({
    queryKey: ['trip', id],
    queryFn: () => api.get<RawTripWithDays>(`/trips/${id}/full`),
    staleTime: 30_000,
    select: buildTripWithDays,
  });

  const trip = data ?? null;
  const refetch = (): void => { void rqRefetch(); };

  const updateMutation = useMutation({
    // Reason: PATCH then re-fetch full trip so the cache is populated with the
    // server-authoritative shape (day list, activity counts, etc.) in one step.
    mutationFn: async (input: UpdateTripInput): Promise<RawTripWithDays> => {
      await api.patch<void>(`/trips/${id}`, input);
      return api.get<RawTripWithDays>(`/trips/${id}/full`);
    },
    onSuccess: (raw) => {
      // Reason: setQueryData rather than invalidate avoids a redundant GET —
      // we already have the fresh payload from mutationFn.
      queryClient.setQueryData<RawTripWithDays>(['trip', id], raw);
      // Reason: the trips list shows stale title/dates/status until ['trips'] is invalidated.
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
      toast.success('Trip updated');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update trip');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete<void>(`/trips/${id}`),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['trip', id] });
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
      toast.success('Trip deleted');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete trip');
    },
  });

  const updateTrip = async (input: UpdateTripInput): Promise<TripWithDays> => {
    const raw = await updateMutation.mutateAsync(input);
    return buildTripWithDays(raw);
  };

  const deleteTrip = async (): Promise<void> => {
    try {
      await deleteMutation.mutateAsync();
    } catch {
      // onError already shows the toast; swallow to match original behaviour.
    }
  };

  return { trip, isLoading, error: error ? error.message : null, refetch, updateTrip, deleteTrip };
}
