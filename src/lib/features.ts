// Build-time feature flags. Flip a flag here when the backing feature ships.
// No env vars, no runtime toggles — one-line change, TypeScript-typed.

export const FEATURES = {
  // Reason: route leg data (drive duration, distance between stops) is now
  // computed via the TomTom routing feature. Enabled.
  PDF_ROUTE_LEGS: true,
} as const;
