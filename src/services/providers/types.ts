// Provider-agnostic interfaces for all external location services.
// Add a new file (e.g. providers/google.ts) implementing these interfaces,
// then update the one import in the corresponding service file to swap providers.

// ── Routing ───────────────────────────────────────────────────────────────────

export type TravelMode = 'car' | 'pedestrian' | 'bicycle';

export interface RouteLegResult {
  distance_m: number;
  duration_s: number;
  /** JSON-serialised {lat, lng}[] polyline. */
  polyline: string;
}

export interface RoutingProvider {
  fetchRouteLeg(
    from:   { lat: number; lng: number },
    to:     { lat: number; lng: number },
    apiKey: string,
    mode?:  TravelMode,
  ): Promise<RouteLegResult | null>;
}

// ── Static map image ──────────────────────────────────────────────────────────

export interface StaticImageOptions {
  /** Longitude, latitude of the map centre. */
  centerLng: number;
  centerLat: number;
  /** Zoom level (provider-specific scale, but semantically equivalent to slippy-map zoom). */
  zoom: number;
  /** Image pixel dimensions. */
  imgW: number;
  imgH: number;
}

export interface StaticImageResult {
  /** PNG image as a base64 data URL. */
  dataUrl: string;
}

export interface MapsProvider {
  fetchStaticMapImage(
    opts:   StaticImageOptions,
    apiKey: string,
  ): Promise<StaticImageResult | null>;

  /**
   * Derives the appropriate zoom level from a padded bounding box so all
   * geo points fit within the requested image dimensions.
   * Providers using Web Mercator (EPSG:3857) can share the same math.
   */
  deriveZoom(
    latSpanPadded: number,
    lngSpanPadded: number,
    imgW: number,
    imgH: number,
  ): number;
}

// ── Geocoding ─────────────────────────────────────────────────────────────────

/** A single autocomplete suggestion returned by LocationField. */
export interface AutocompleteSuggestion {
  /** Short display name — typically 1–2 address parts. */
  name:    string;
  /** Contextual suffix — typically city / country. */
  context: string;
  lat: number;
  lng: number;
}

export type GeocodingProviderName = 'nominatim' | 'tomtom';

export interface GeocodingProvider {
  /**
   * Resolves a free-text place query to its best lat/lng match.
   * Used for server-side batch geocoding (activity / reservation save).
   * @param apiKey Ignored by providers that don't require a key (e.g. Nominatim).
   */
  geocodePlace(
    query:  string,
    apiKey: string,
  ): Promise<{ lat: number; lng: number } | null>;

  /**
   * Returns up to five autocomplete suggestions for a partial query.
   * Used by the LocationField autocomplete dropdown.
   * @param apiKey Ignored by providers that don't require a key (e.g. Nominatim).
   */
  autocomplete(
    query:  string,
    apiKey: string,
  ): Promise<AutocompleteSuggestion[]>;

  /**
   * Minimum milliseconds to wait between consecutive geocodePlace calls.
   * Set to 0 for providers with no enforced rate limit.
   */
  readonly rateLimitMs: number;
}
