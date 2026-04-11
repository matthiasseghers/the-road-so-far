// Reason: Nominatim is a free OSM geocoder — no API key required.
// Rate limit is 1 req/s; callers must enforce GEOCODE_DELAY_MS between calls.

export const GEOCODE_DELAY_MS = 1_100;

interface NominatimResult {
  lat: string;
  lon: string;
}

/**
 * Geocodes a free-text query via Nominatim (OpenStreetMap).
 * Returns { lat, lng } on success, null if nothing was found or the request failed.
 */
export async function geocodePlace(query: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;

  let results: NominatimResult[];
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TheRoadSoFar/1.0' },
    });
    if (!res.ok) return null;
    results = (await res.json()) as NominatimResult[];
  } catch {
    return null;
  }

  if (results.length === 0) return null;

  const first = results[0];
  return { lat: parseFloat(first.lat), lng: parseFloat(first.lon) };
}
