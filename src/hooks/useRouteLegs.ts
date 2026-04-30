import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { api } from '@/db/api-client';
import { RouteLeg } from '@/domain/RouteLeg';
import type { RouteLegRow, LegModeRow, RouteLegTravelMode } from '@/types/db';
import type { ExpectedLeg } from '@/db/repositories/route-legs.repo';

interface RouteLegsResponse {
  legs:         RouteLegRow[];
  expectedLegs: ExpectedLeg[];
  isStale:      boolean;
}

interface UseRouteLegsResult {
  legs:         RouteLeg[];
  expectedLegs: ExpectedLeg[];
  isStale:      boolean;
  legModes:     LegModeRow[];
  isSyncing:    boolean;
  error:        string | null;
  sync:         () => Promise<void>;
  setLegMode:   (fromLat: number, fromLng: number, toLat: number, toLng: number, mode: RouteLegTravelMode) => Promise<void>;
}

export function useRouteLegs(tripId: number): UseRouteLegsResult {
  const [rows,         setRows]         = useState<RouteLegRow[]>([]);
  const [expectedLegs, setExpectedLegs] = useState<ExpectedLeg[]>([]);
  const [isStale,      setIsStale]      = useState(false);
  const [legModes,     setLegModes]     = useState<LegModeRow[]>([]);
  const [isSyncing,    setIsSyncing]    = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    Promise.all([
      api.get<RouteLegsResponse>(`/trips/${tripId}/route-legs`).then(r => {
        setRows(r.legs);
        setExpectedLegs(r.expectedLegs);
        setIsStale(r.isStale);
      }),
      api.get<LegModeRow[]>(`/trips/${tripId}/leg-modes`).then(setLegModes),
    ]).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : 'Failed to load route legs');
    });
  }, [tripId]);

  const sync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const result = await api.post<{ synced: number; deleted: number; legs: RouteLegRow[] }>(
        `/trips/${tripId}/route-legs/sync`,
        {},
      );
      // Reason: after sync re-fetch expectedLegs + isStale from the server so the
      // map immediately reflects the post-sync state without a full page reload.
      const fresh = await api.get<RouteLegsResponse>(`/trips/${tripId}/route-legs`);
      setRows(fresh.legs);
      setExpectedLegs(fresh.expectedLegs);
      setIsStale(fresh.isStale);

      if (result.synced > 0) {
        toast.success(`Synced ${result.synced} route leg${result.synced !== 1 ? 's' : ''}`);
      } else if (result.deleted > 0) {
        toast.success(`Removed ${result.deleted} outdated leg${result.deleted !== 1 ? 's' : ''}`);
      } else {
        toast.info('Routes are up to date');
      }
    } catch (err) {
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

  const legs = useMemo(() => rows.map(r => new RouteLeg(r)), [rows]);
  return { legs, expectedLegs, isStale, legModes, isSyncing, error, sync, setLegMode };
}
