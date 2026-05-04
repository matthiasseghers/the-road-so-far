import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/db/api-client';
import { Trip } from '@/domain/Trip';
import type { TripData } from '@/domain/Trip';
import type { CreateTripInput, UpdateTripInput } from '@/db/repositories/trips.repo';

interface UseTripsReturn {
  trips: Trip[];
  ongoing: Trip[];
  upcoming: Trip[];
  past: Trip[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  createTrip: (input: CreateTripInput) => Promise<Trip>;
  updateTrip: (id: number, input: UpdateTripInput) => Promise<Trip>;
  deleteTrip: (id: number) => Promise<void>;
}

export function useTrips(): UseTripsReturn {
  const queryClient = useQueryClient();

  const { data: trips = [], isLoading, error, refetch: rqRefetch } = useQuery({
    queryKey: ['trips'],
    queryFn: () => api.get<TripData[]>('/trips'),
    staleTime: 30_000,
    select: (rows) => rows.map(row => new Trip(row)),
  });

  const refetch = (): void => { void rqRefetch(); };

  const createMutation = useMutation({
    mutationFn: (input: CreateTripInput) => api.post<TripData>('/trips', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
      toast.success('Trip created');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create trip');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateTripInput }) =>
      api.patch<TripData>(`/trips/${id}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
      toast.success('Trip updated');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update trip');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete<void>(`/trips/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
      toast.success('Trip deleted');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete trip');
    },
  });

  const createTrip = async (input: CreateTripInput): Promise<Trip> => {
    // Reason: rethrows so form modals can catch and keep the dialog open on failure.
    const row = await createMutation.mutateAsync(input);
    return new Trip(row);
  };

  const updateTrip = async (id: number, input: UpdateTripInput): Promise<Trip> => {
    const row = await updateMutation.mutateAsync({ id, input });
    return new Trip(row);
  };

  const deleteTrip = async (id: number): Promise<void> => {
    try {
      await deleteMutation.mutateAsync(id);
    } catch {
      // onError already shows the toast; swallow so void callers don't get
      // an unhandled rejection (TripsPage calls `void deleteTrip(id)`).
    }
  };

  // Reason: memoize derived buckets so consumers don't re-filter on every render.
  const ongoing  = useMemo(() => trips.filter(t => t.isOngoing()),  [trips]);
  const upcoming = useMemo(() => trips.filter(t => t.isUpcoming()), [trips]);
  const past     = useMemo(() => trips.filter(t => t.isPast()),     [trips]);

  return {
    trips,
    ongoing,
    upcoming,
    past,
    isLoading,
    error: error ? error.message : null,
    refetch,
    createTrip,
    updateTrip,
    deleteTrip,
  };
}
