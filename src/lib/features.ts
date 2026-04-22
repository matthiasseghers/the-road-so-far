// Build-time feature flags. Flip a flag here when the backing feature ships.
// No env vars, no runtime toggles — one-line change, TypeScript-typed.

export const FEATURES = {
  // Reason: route leg data (drive duration, distance between stops) is computed
  // by the TomTom routing phase (Phase X). Until that ships, the PDF drive chip
  // has no reliable data to show — keep it hidden.
  PDF_ROUTE_LEGS: false,
} as const;
