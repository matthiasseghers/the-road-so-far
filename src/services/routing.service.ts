// Routing service — provider-agnostic adapter.
// Runs in Express — never imported by the React frontend.
// Reason: to swap routing providers (e.g. Google Maps, HERE), change the one
// import below and ensure the new provider implements RoutingProvider.

import { tomtomRouting } from './providers/tomtom.js';
import type { RouteLegResult, TravelMode } from './providers/types.js';

export type { RouteLegResult };

// Reason: single assignment makes the active provider easy to find and swap.
const provider = tomtomRouting;

export function fetchRouteLeg(
  from:   { lat: number; lng: number },
  to:     { lat: number; lng: number },
  apiKey: string,
  mode:   TravelMode = 'car',
): Promise<RouteLegResult | null> {
  return provider.fetchRouteLeg(from, to, apiKey, mode);
}
