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
  const lat = parseFloat(r.lat);
  const lng = parseFloat(r.lon);
  return {
    name:    parts.slice(0, 2).join(', '),
    context: parts.slice(2, 4).join(', '),
    lat:     Number.isNaN(lat) ? 0 : lat,
    lng:     Number.isNaN(lng) ? 0 : lng,
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
    const lat = parseFloat(results[0].lat);
    const lng = parseFloat(results[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
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
