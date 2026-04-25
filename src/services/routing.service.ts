// Server-side TomTom Routing API v1 wrapper.
// Runs in Express — never imported by the React frontend.
// Reason: API key must never reach the browser; all TomTom calls go through the server.

import type { TomTomRouteResponse } from '@/types/api';

export interface RouteLegResult {
  distance_m: number;
  duration_s: number;
  /** JSON-serialised {lat, lng}[] polyline. */
  polyline: string;
}

/**
 * Fetches a driving route between two geocoded points via TomTom Routing API.
 * Returns null if the API key is missing, the request fails, or no route is found.
 */
export async function fetchRouteLeg(
  from: { lat: number; lng: number },
  to:   { lat: number; lng: number },
  apiKey: string,
  mode: 'car' | 'pedestrian' | 'bicycle' = 'car',
): Promise<RouteLegResult | null> {
  if (!apiKey) return null;

  const url = [
    'https://api.tomtom.com/routing/1/calculateRoute/',
    `${from.lat},${from.lng}:${to.lat},${to.lng}`,
    `/json?key=${encodeURIComponent(apiKey)}&travelMode=${mode}`,
  ].join('');

  let data: TomTomRouteResponse;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TheRoadSoFar/1.0' },
    });
    if (!res.ok) return null;
    data = (await res.json()) as TomTomRouteResponse;
  } catch {
    return null;
  }

  const route = data.routes?.[0];
  if (!route) return null;

  const points = route.legs.flatMap(leg =>
    leg.points.map(p => ({ lat: p.latitude, lng: p.longitude })),
  );

  return {
    distance_m: route.summary.lengthInMeters,
    duration_s: route.summary.travelTimeInSeconds,
    polyline:   JSON.stringify(points),
  };
}
