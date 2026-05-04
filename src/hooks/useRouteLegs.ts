import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();

  const {
    data: routeLegsData,
    error: routeLegsError,
  } = useQuery({
    queryKey: ['route-legs', tripId],
    queryFn: () => api.get<RouteLegsResponse>(`/trips/${tripId}/route-legs`),
    // Reason: every sync/setLegMode mutation invalidates this query — background refetch is wasted TomTom API calls.
    staleTime: Infinity,
  });

  const {
    data: legModes = [],
    error: legModesError,
  } = useQuery({
    queryKey: ['leg-modes', tripId],
    queryFn: () => api.get<LegModeRow[]>(`/trips/${tripId}/leg-modes`),
    // Reason: every setLegMode mutation invalidates this query — background refetch is wasted work.
    staleTime: Infinity,
  });

  const syncMutation = useMutation({
    mutationFn: () =>
      api.post<{ synced: number; deleted: number; legs: RouteLegRow[] }>(
        `/trips/${tripId}/route-legs/sync`,
        {},
      ),
    onSuccess: (result) => {
      if (result.synced > 0) {
        toast.success(`Synced ${result.synced} route leg${result.synced !== 1 ? 's' : ''}`);
      } else if (result.deleted > 0) {
        toast.success(`Removed ${result.deleted} outdated leg${result.deleted !== 1 ? 's' : ''}`);
      } else {
        toast.info('Routes are up to date');
      }
      // Reason: after sync re-fetch route-legs so the map immediately reflects
      // the post-sync state without a full page reload.
      void queryClient.invalidateQueries({ queryKey: ['route-legs', tripId] });
    },
    onError: (err) => {
      if (err instanceof Error && err.message.includes('no_api_key')) {
        toast.error('Add your TomTom API key in Settings → General first');
      } else {
        toast.error('Route sync failed');
      }
    },
  });

  const setLegModeMutation = useMutation({
    mutationFn: ({
      fromLat, fromLng, toLat, toLng, mode,
    }: {
      fromLat: number; fromLng: number;
      toLat: number;   toLng: number;
      mode: RouteLegTravelMode;
    }) =>
      api.post<{ legs: RouteLegRow[]; modes: LegModeRow[] }>(
        `/trips/${tripId}/leg-modes`,
        { from_lat: fromLat, from_lng: fromLng, to_lat: toLat, to_lng: toLng, travel_mode: mode },
      ),
    onSuccess: (result) => {
      // Reason: setQueryData avoids a redundant GET — the server already returned
      // the updated legs and modes in the mutation response.
      queryClient.setQueryData<RouteLegsResponse>(['route-legs', tripId], prev =>
        prev ? { ...prev, legs: result.legs } : prev,
      );
      queryClient.setQueryData<LegModeRow[]>(['leg-modes', tripId], result.modes);
    },
    onError: (err) => {
      if (err instanceof Error && err.message.includes('no_api_key')) {
        toast.error('Add your TomTom API key in Settings → General first');
      } else {
        toast.error('Failed to update route mode');
      }
    },
  });

  const sync = async (): Promise<void> => {
    try {
      await syncMutation.mutateAsync();
    } catch { /* onError handles toast */ }
  };

  const setLegMode = async (
    fromLat: number, fromLng: number,
    toLat: number,   toLng: number,
    mode: RouteLegTravelMode,
  ): Promise<void> => {
    try {
      await setLegModeMutation.mutateAsync({ fromLat, fromLng, toLat, toLng, mode });
    } catch { /* onError handles toast */ }
  };

  const isSyncing = syncMutation.isPending || setLegModeMutation.isPending;
  const error = (routeLegsError ?? legModesError)?.message ?? null;

  const legs = useMemo(
    () => (routeLegsData?.legs ?? []).map(r => new RouteLeg(r)),
    [routeLegsData?.legs],
  );

  return {
    legs,
    expectedLegs: routeLegsData?.expectedLegs ?? [],
    isStale:      routeLegsData?.isStale ?? false,
    legModes,
    isSyncing,
    error,
    sync,
    setLegMode,
  };
}
