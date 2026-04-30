// Maps service — provider-agnostic adapter.
// Runs in Express — never imported by the React frontend.
// Reason: to swap map providers (e.g. Google Maps, Mapbox), change the one
// import below and ensure the new provider implements MapsProvider.

import { tomtomMaps } from './providers/tomtom.js';
import type { StaticImageOptions, StaticImageResult } from './providers/types.js';

export type { StaticImageOptions, StaticImageResult };

// Reason: single assignment makes the active provider easy to find and swap.
const provider = tomtomMaps;

export function fetchStaticMapImage(
  opts:   StaticImageOptions,
  apiKey: string,
): Promise<StaticImageResult | null> {
  return provider.fetchStaticMapImage(opts, apiKey);
}

export function deriveZoom(
  latSpanPadded: number,
  lngSpanPadded: number,
  imgW: number,
  imgH: number,
): number {
  return provider.deriveZoom(latSpanPadded, lngSpanPadded, imgW, imgH);
}
