import { useState, useCallback } from 'react';
import { api } from '@/db/api-client';

type GeocodeStatus = 'idle' | 'loading' | 'ok' | 'not_found' | 'error';

interface UseGeocodeReturn {
  geocode: (id: number, location: string) => Promise<'ok' | 'not_found' | 'error'>;
  status: GeocodeStatus;
  reset: () => void;
}

export function useGeocode(entity: 'activities' | 'reservations'): UseGeocodeReturn {
  const [status, setStatus] = useState<GeocodeStatus>('idle');

  const geocode = useCallback(
    async (id: number, location: string): Promise<'ok' | 'not_found' | 'error'> => {
      // Reason: guard against empty location up-front; avoids a pointless round-trip.
      if (!location.trim()) return 'error';
      setStatus('loading');
      try {
        await api.patch(`/${entity}/${id}/geocode`, { location });
        setStatus('ok');
        return 'ok';
      } catch (e: unknown) {
        // Reason: 422 = location empty/invalid; 503 = geocoding returned no results.
        const isNotFound = e instanceof Error &&
          (e.message.includes('422') || e.message.includes('503'));
        const st: GeocodeStatus = isNotFound ? 'not_found' : 'error';
        setStatus(st);
        return st;
      }
    },
    [entity],
  );

  const reset = useCallback(() => setStatus('idle'), []);

  return { geocode, status, reset };
}
