// PreferencesContext — Provider shell for main.tsx.
// The actual hook logic lives in @/hooks/usePreferences.ts.

import type { ReactNode } from 'react';

// Transparent pass-through. Exists so main.tsx has an explicit insertion point
// that a future React createContext migration can swap without touching consumers.
export function PreferencesProvider({ children }: { children: ReactNode }): JSX.Element {
  return <>{children}</>;
}
