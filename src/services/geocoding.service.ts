// Geocoding service — provider-agnostic adapter.
// Runs in Express — never imported by the React frontend.
// Reason: to swap geocoding providers (e.g. Nominatim → TomTom, Google Places),
// the active provider is resolved at call-time from the geocoding_provider setting.

import { getAllSettings } from '../db/repositories/settings.repo.js';
import { nominatimGeocoding } from './providers/nominatim.js';
import { tomtomGeocoding }    from './providers/tomtom.js';
import type { GeocodingProvider, AutocompleteSuggestion } from './providers/types.js';

export type { AutocompleteSuggestion };

function resolveProvider(name: string): GeocodingProvider {
  // Reason: explicit switch keeps the mapping easy to find; default always falls
  // back to Nominatim so the app works out-of-the-box without any configuration.
  switch (name) {
    case 'tomtom': return tomtomGeocoding;
    default:       return nominatimGeocoding;
  }
}

// ── Rate-limit queue ──────────────────────────────────────────────────────────
// Reason: Nominatim requires ≤1 req/s. A shared promise chain serialises all
// geocodePlace calls and enforces each provider's rateLimitMs between them.
// The queue lives here (not in router.ts) so it follows the active provider.

const QUEUE_MAX_DEPTH = 20;
let _queue: Promise<void> = Promise.resolve();
let _queueDepth = 0;

export function geocodePlace(
  query: string,
): Promise<{ lat: number; lng: number } | null> {
  // Reason: cap the queue depth so runaway callers cannot grow the promise chain
  // indefinitely and exhaust memory.
  if (_queueDepth >= QUEUE_MAX_DEPTH) {
    return Promise.reject(new Error('Geocode queue full — try again later'));
  }

  _queueDepth++;

  // Read provider + key at enqueue-time so the call uses the setting that was
  // active when the user triggered the geocode, not when it runs in the queue.
  const settings = getAllSettings();
  const provider = resolveProvider(settings.geocoding_provider);
  const apiKey   = settings.tomtom_api_key;

  const result = _queue
    .then(() => provider.geocodePlace(query, apiKey))
    .then(
      coords =>
        new Promise<{ lat: number; lng: number } | null>(resolve =>
          // Reason: enforce the delay AFTER the request completes so consecutive
          // calls always wait the full interval regardless of request latency.
          setTimeout(() => resolve(coords), provider.rateLimitMs),
        ),
    )
    .finally(() => { _queueDepth--; });

  // Advance the queue pointer on the delay promise (not on result) so errors in
  // one call don't stall subsequent queued calls.
  _queue = result.then(() => undefined).catch(() => undefined);

  return result;
}

export function autocomplete(
  query: string,
): Promise<AutocompleteSuggestion[]> {
  // Reason: autocomplete is debounced on the client side (400 ms); a per-call
  // queue is unnecessary. We read provider fresh each call so a settings change
  // takes effect immediately without a restart.
  const settings = getAllSettings();
  const provider = resolveProvider(settings.geocoding_provider);
  return provider.autocomplete(query, settings.tomtom_api_key);
}

