import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '@/db/api-client';
import { RouteLeg } from '@/domain/RouteLeg';
import type { RouteLegRow, LegModeRow, RouteLegTravelMode } from '@/types/db';

interface UseRouteLegsResult {
  legs: RouteLeg[];
  legModes: LegModeRow[];
  isSyncing: boolean;
  sync: () => Promise<void>;
  setLegMode: (fromLat: number, fromLng: number, toLat: number, toLng: number, mode: RouteLegTravelMode) => Promise<void>;
}

export function useRouteLegs(tripId: number): UseRouteLegsResult {
  const [rows, setRows]           = useState<RouteLegRow[]>([]);
  const [legModes, setLegModes]   = useState<LegModeRow[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    api.get<RouteLegRow[]>(`/trips/${tripId}/route-legs`)
      .then(setRows)
      .catch(() => { /* silently — no legs yet */ });
    api.get<LegModeRow[]>(`/trips/${tripId}/leg-modes`)
      .then(setLegModes)
      .catch(() => { /* no modes stored yet */ });
  }, [tripId]);

  const sync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const result = await api.post<{ synced: number; legs: RouteLegRow[] }>(
        `/trips/${tripId}/route-legs/sync`,
        {},
      );
      setRows(result.legs);
      if (result.synced > 0) {
        toast.success(`Synced ${result.synced} route leg${result.synced !== 1 ? 's' : ''}`);
      } else {
        toast.info('No new legs to sync — add geocoded locations to activities first');
      }
    } catch (err) {
      // Reason: ApiError with status 422 means no API key is configured.
      if (err instanceof Error && err.message.includes('no_api_key')) {
        toast.error('Add your TomTom API key in Settings → General first');
      } else {
        toast.error('Route sync failed');
      }
    } finally {
      setIsSyncing(false);
    }
  }, [tripId]);

  const setLegMode = useCallback(async (
    fromLat: number, fromLng: number,
    toLat: number,   toLng: number,
    mode: RouteLegTravelMode,
  ) => {
    setIsSyncing(true);
    try {
      const result = await api.post<{ legs: RouteLegRow[]; modes: LegModeRow[] }>(
        `/trips/${tripId}/leg-modes`,
        { from_lat: fromLat, from_lng: fromLng, to_lat: toLat, to_lng: toLng, travel_mode: mode },
      );
      setRows(result.legs);
      setLegModes(result.modes);
    } catch (err) {
      if (err instanceof Error && err.message.includes('no_api_key')) {
        toast.error('Add your TomTom API key in Settings → General first');
      } else {
        toast.error('Failed to update route mode');
      }
    } finally {
      setIsSyncing(false);
    }
  }, [tripId]);

  const legs = rows.map(r => new RouteLeg(r));
  return { legs, legModes, isSyncing, sync, setLegMode };
}
