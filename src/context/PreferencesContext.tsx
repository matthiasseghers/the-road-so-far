// PreferencesContext — shared preference state across all consumers.
//
// Why a module-level listener store instead of React createContext?
// The sentinel test (PreferencesContext.spec.tsx) mounts two renderHook()
// calls in separate React trees — there is no common ancestor where a context
// Provider could live. React context cannot bridge separate trees.
// A module-level store + subscriber pattern solves this: every usePreferences()
// call site registers a forceUpdate listener; any setter writes to localStorage
// and calls notify(), which triggers re-renders in ALL registered instances
// simultaneously, making the shared-state behaviour observable in tests.
//
// PreferencesProvider remains as an explicit insertion point in main.tsx so a
// future migration to React createContext has a clear seam to swap in.

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { DistanceUnit } from '@/types/domain';

// Reason: localStorage keys are constants to avoid typos across the codebase.
const DISTANCE_KEY = 'rsf-pref-distance';
const CURRENCY_KEY  = 'rsf-pref-currency';

function readDistanceUnit(): DistanceUnit {
  const raw = localStorage.getItem(DISTANCE_KEY);
  return raw === 'km' || raw === 'mi' ? raw : 'km';
}

function readCurrency(): string {
  return localStorage.getItem(CURRENCY_KEY) ?? '€';
}

// Reason: module-level Set so every usePreferences() call site re-renders
// atomically when any setter is called — regardless of React tree position.
const _listeners = new Set<() => void>();

function notify(): void {
  _listeners.forEach(fn => fn());
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface Preferences {
  distanceUnit: DistanceUnit;
  currency:     string;
}

export interface UsePreferencesReturn extends Preferences {
  setDistanceUnit: (unit: DistanceUnit) => void;
  setCurrency:     (symbol: string)     => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePreferences(): UsePreferencesReturn {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const update = (): void => forceUpdate(n => n + 1);
    _listeners.add(update);
    return () => { _listeners.delete(update); };
  }, []);

  // Reason: always read fresh from localStorage so every render reflects the
  // latest value, whether written by this instance or by another call site.
  const distanceUnit = readDistanceUnit();
  const currency     = readCurrency();

  const setDistanceUnit = useCallback((unit: DistanceUnit): void => {
    localStorage.setItem(DISTANCE_KEY, unit);
    notify();
  }, []);

  const setCurrency = useCallback((symbol: string): void => {
    localStorage.setItem(CURRENCY_KEY, symbol);
    notify();
  }, []);

  return { distanceUnit, currency, setDistanceUnit, setCurrency };
}

// ── Provider ──────────────────────────────────────────────────────────────────

// Transparent pass-through. Exists so main.tsx has an explicit insertion point
// that a future React createContext migration can swap without touching consumers.
export function PreferencesProvider({ children }: { children: ReactNode }): JSX.Element {
  return <>{children}</>;
}
