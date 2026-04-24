import { useState, useCallback, useEffect } from 'react';
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
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback((): void => {
    setIsLoading(true);
    api.get<TripData[]>('/trips')
      .then(rows => { setTrips(rows.map(row => new Trip(row))); setError(null); setIsLoading(false); })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Unknown error');
        setIsLoading(false);
      });
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const createTrip = useCallback(async (input: CreateTripInput): Promise<Trip> => {
    try {
      const row = await api.post<TripData>('/trips', input);
      refetch();
      toast.success('Trip created');
      return new Trip(row);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create trip');
      throw err;
    }
  }, [refetch]);

  const updateTrip = useCallback(async (id: number, input: UpdateTripInput): Promise<Trip> => {
    try {
      const row = await api.patch<TripData>(`/trips/${id}`, input);
      refetch();
      toast.success('Trip updated');
      return new Trip(row);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update trip');
      throw err;
    }
  }, [refetch]);

  const deleteTrip = useCallback(async (id: number): Promise<void> => {
    try {
      await api.delete(`/trips/${id}`);
      refetch();
      toast.success('Trip deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete trip');
    }
  }, [refetch]);

  return {
    trips,
    ongoing:  trips.filter(t => t.isOngoing()),
    upcoming: trips.filter(t => t.isUpcoming()),
    past:     trips.filter(t => t.isPast()),
    isLoading,
    error,
    refetch,
    createTrip,
    updateTrip,
    deleteTrip,
  };
}
