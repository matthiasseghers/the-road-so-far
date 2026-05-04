import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/db/api-client';
import type { ReservationRow } from '@/types/db';
import type { RawTripWithDays } from '@/db/repositories/trips.repo';
import { buildMapData, countDaysMissingLocations } from '@/utils/mapData';
import type { MapPin, MapDay } from '@/utils/mapData';

export type { MapPin, MapDay };

interface UseMapDataReturn {
  pins: MapPin[];
  mapDays: MapDay[];
  lodgingRoute: { lat: number; lng: number }[];
  missingCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useMapData(tripId: number): UseMapDataReturn {
  const queryClient = useQueryClient();

  // Reason: uses the same ['trip', tripId] key as useTrip so when both hooks are
  // mounted together (TripDetailPage), React Query serves the second caller from
  // cache instead of firing a duplicate GET /trips/:id/full request.
  // The select function extracts only the days array; useTrip's select independently
  // builds TripWithDays from the same cached RawTripWithDays payload.
  const {
    data: days = [],
    isLoading: tripLoading,
    error: tripError,
  } = useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => api.get<RawTripWithDays>(`/trips/${tripId}/full`),
    staleTime: 30_000,
    select: (raw) => raw.days,
  });

  // Reason: uses the same ['reservations', tripId] key as useReservations —
  // same cache deduplication benefit applies.
  const {
    data: reservations = [],
    isLoading: resLoading,
    error: resError,
  } = useQuery({
    queryKey: ['reservations', tripId],
    queryFn: () => api.get<ReservationRow[]>(`/reservations?tripId=${tripId}`),
    staleTime: 30_000,
  });

  // Reason: buildMapData and countDaysMissingLocations are applied here via
  // useMemo (rather than select) because the transform requires data from two
  // separate queries — select can only operate on a single query's payload.
  const { pins, mapDays, lodgingRoute, missingCount } = useMemo(() => {
    if (days.length === 0 && !tripLoading) {
      return { pins: [], mapDays: [], lodgingRoute: [], missingCount: 0 };
    }
    const { pins: p, mapDays: md, lodgingRoute: lr } = buildMapData(days, reservations);
    const missing = countDaysMissingLocations(days, reservations);
    return { pins: p, mapDays: md, lodgingRoute: lr, missingCount: missing };
  }, [days, reservations, tripLoading]);

  // Reason: invalidating the two shared keys also refreshes useTrip and
  // useReservations in any other mounted consumer — no stale data anywhere.
  const refetch = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
    void queryClient.invalidateQueries({ queryKey: ['reservations', tripId] });
  };

  const isLoading = tripLoading || resLoading;
  const error = (tripError ?? resError)?.message ?? null;

  return { pins, mapDays, lodgingRoute, missingCount, isLoading, error, refetch };
}
