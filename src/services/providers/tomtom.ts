// TomTom implementation of RoutingProvider and MapsProvider.
// To switch providers, implement the same interfaces in a new file and update
// the one import in routing.service.ts / maps.service.ts.

import type { TomTomRouteResponse } from '@/types/api';
import type {
  RoutingProvider,
  RouteLegResult,
  TravelMode,
  MapsProvider,
  StaticImageOptions,
  StaticImageResult,
  GeocodingProvider,
  AutocompleteSuggestion,
} from './types.js';

// ── Routing ───────────────────────────────────────────────────────────────────

const tomtomRouting: RoutingProvider = {
  async fetchRouteLeg(
    from: { lat: number; lng: number },
    to:   { lat: number; lng: number },
    apiKey: string,
    mode: TravelMode = 'car',
  ): Promise<RouteLegResult | null> {
    if (!apiKey) return null;

    const url = [
      'https://api.tomtom.com/routing/1/calculateRoute/',
      `${from.lat},${from.lng}:${to.lat},${to.lng}`,
      `/json?key=${encodeURIComponent(apiKey)}&travelMode=${mode}`,
    ].join('');

    let data: TomTomRouteResponse;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'TheRoadSoFar/1.0' } });
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
  },
};

// ── Static map image ──────────────────────────────────────────────────────────

const tomtomMaps: MapsProvider = {
  async fetchStaticMapImage(
    opts:   StaticImageOptions,
    apiKey: string,
  ): Promise<StaticImageResult | null> {
    if (!apiKey) return null;

    const url = new URL('https://api.tomtom.com/map/1/staticimage');
    url.searchParams.set('key',    apiKey);
    url.searchParams.set('center', `${opts.centerLng.toFixed(6)},${opts.centerLat.toFixed(6)}`);
    url.searchParams.set('zoom',   String(opts.zoom));
    url.searchParams.set('width',  String(opts.imgW));
    url.searchParams.set('height', String(opts.imgH));
    url.searchParams.set('format', 'png');
    url.searchParams.set('layer',  'basic');
    url.searchParams.set('style',  'main');

    let imageRes: globalThis.Response;
    try {
      imageRes = await fetch(url.toString(), { headers: { 'User-Agent': 'TheRoadSoFar/1.0' } });
      if (!imageRes.ok) return null;
    } catch {
      return null;
    }

    const buffer = Buffer.from(await imageRes.arrayBuffer());
    return { dataUrl: `data:image/png;base64,${buffer.toString('base64')}` };
  },

  deriveZoom(
    latSpanPadded: number,
    lngSpanPadded: number,
    imgW: number,
    imgH: number,
  ): number {
    // Reason: TomTom uses Web Mercator (EPSG:3857) — zoom N tiles are 256×2^N px wide.
    // This math is identical for any slippy-map provider (Google, Mapbox, OSM, etc.).
    const zoomLng = Math.log2(imgW * 360 / (256 * lngSpanPadded));
    const zoomLat = Math.log2(imgH * 180 / (256 * latSpanPadded));
    return Math.max(2, Math.min(17, Math.floor(Math.min(zoomLng, zoomLat))));
  },
};

export { tomtomRouting, tomtomMaps };

// ── Geocoding (TomTom Fuzzy Search) ──────────────────────────────────────────

// TomTom Search API v2 response shape — only the fields we use.
interface TomTomSearchResult {
  type: string;
  poi?:     { name: string };
  address:  {
    freeformAddress: string;
    streetName?: string;
    streetNumber?: string;
    postalCode?: string;
    municipality?: string;
    country?: string;
  };
  position: { lat: number; lon: number };
}

interface TomTomSearchResponse {
  results: TomTomSearchResult[];
}

function parseTomTomResult(r: TomTomSearchResult): AutocompleteSuggestion {
  const parts = r.address.freeformAddress.split(', ');
  const a = r.address;
  return {
    // Reason: POI name gives a cleaner primary label than the raw address.
    name:    r.poi?.name ?? parts.slice(0, 2).join(', '),
    context: parts.slice(0, 2).join(', '),
    lat:     r.position.lat,
    lng:     r.position.lon,
    ...(a.streetName   ? { addressStreet: a.streetName }         : {}),
    ...(a.streetNumber ? { addressNumber: a.streetNumber }       : {}),
    ...(a.postalCode   ? { addressPostalCode: a.postalCode }     : {}),
    ...(a.municipality ? { addressCity: a.municipality }         : {}),
    ...(a.country      ? { addressCountry: a.country }           : {}),
  };
}

async function tomtomSearch(
  query:  string,
  apiKey: string,
  limit:  number,
): Promise<TomTomSearchResult[]> {
  if (!apiKey) return [];
  const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?key=${encodeURIComponent(apiKey)}&limit=${limit}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'TheRoadSoFar/1.0' } });
    if (!res.ok) return [];
    const data = (await res.json()) as TomTomSearchResponse;
    return data.results ?? [];
  } catch {
    return [];
  }
}

const tomtomGeocoding: GeocodingProvider = {
  // Reason: TomTom Search API has no enforced per-second rate limit at the
  // individual-user level; the rate-limit queue delay is skipped.
  rateLimitMs: 0,

  async geocodePlace(query: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
    const results = await tomtomSearch(query, apiKey, 1);
    if (results.length === 0) return null;
    return { lat: results[0].position.lat, lng: results[0].position.lon };
  },

  async autocomplete(query: string, apiKey: string): Promise<AutocompleteSuggestion[]> {
    const results = await tomtomSearch(query, apiKey, 5);
    return results.map(parseTomTomResult);
  },
};

export { tomtomGeocoding };
