// Nominatim (OpenStreetMap) implementation of GeocodingProvider.
// Free — no API key required. Rate limit: ≤1 req/s per the usage policy.
// https://nominatim.org/release-docs/develop/api/Search/

import type { GeocodingProvider, AutocompleteSuggestion } from './types.js';

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

function parseSuggestion(r: NominatimResult): AutocompleteSuggestion {
  const parts = r.display_name.split(', ');
  return {
    name:    parts.slice(0, 2).join(', '),
    context: parts.slice(2, 4).join(', '),
    lat:     parseFloat(r.lat),
    lng:     parseFloat(r.lon),
  };
}

const nominatimGeocoding: GeocodingProvider = {
  // Reason: Nominatim usage policy requires ≤1 req/s. The calling service
  // enforces this via a rate-limit queue; rateLimitMs drives the delay.
  rateLimitMs: 1_100,

  async geocodePlace(query: string): Promise<{ lat: number; lng: number } | null> {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    let results: NominatimResult[];
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'TheRoadSoFar/1.0' } });
      if (!res.ok) return null;
      results = (await res.json()) as NominatimResult[];
    } catch {
      return null;
    }
    if (results.length === 0) return null;
    return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
  },

  async autocomplete(query: string): Promise<AutocompleteSuggestion[]> {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=0`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'TheRoadSoFar/1.0' } });
      if (!res.ok) return [];
      return ((await res.json()) as NominatimResult[]).map(parseSuggestion);
    } catch {
      return [];
    }
  },
};

export { nominatimGeocoding };
