import { useState, useCallback, useEffect } from 'react';
import { api } from '@/db/api-client';
import type { ActivityRow, ReservationRow } from '@/types/db';
import type { RawTripWithDays } from '@/db/repositories/trips.repo';
import { buildMapData, countDaysMissingLocations } from '@/components/map/mapDataUtils';
import type { MapPin, MapDay } from '@/components/map/mapDataUtils';

export type { MapPin, MapDay };

interface UseMapDataReturn {
  pins: MapPin[];
  mapDays: MapDay[];
  lodgingRoute: { lat: number; lng: number }[];
  missingCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useMapData(tripId: number): UseMapDataReturn {
  const [pins,         setPins]         = useState<MapPin[]>([]);
  const [mapDays,      setMapDays]      = useState<MapDay[]>([]);
  const [lodgingRoute, setLodgingRoute] = useState<{ lat: number; lng: number }[]>([]);
  const [missingCount, setMissingCount] = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  const refetch = useCallback((): void => {
    setLoading(true);
    Promise.all([
      api.get<RawTripWithDays>(`/trips/${tripId}/full`),
      api.get<ReservationRow[]>(`/reservations?tripId=${tripId}`),
    ])
      .then(([tripData, reservations]) => {
        const days = (tripData.days as Array<{ activities: ActivityRow[] } & typeof tripData.days[0]>);
        const { pins: p, mapDays: md, lodgingRoute: lr } = buildMapData(days, reservations);
        const missing = countDaysMissingLocations(days, reservations);
        setPins(p);
        setMapDays(md);
        setLodgingRoute(lr);
        setMissingCount(missing);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Unknown error');
        setLoading(false);
      });
  }, [tripId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { pins, mapDays, lodgingRoute, missingCount, loading, error, refetch };
}
