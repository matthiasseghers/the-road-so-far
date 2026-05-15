// usePreferences — shared preference state across all consumers.
//
// Why a module-level listener store instead of React createContext?
// The sentinel test (PreferencesContext.spec.tsx) mounts two renderHook()
// calls in separate React trees — there is no common ancestor where a context
// Provider could live. React context cannot bridge separate trees.
// A module-level store + subscriber pattern solves this: every usePreferences()
// call site registers a forceUpdate listener; any setter writes to localStorage
// and calls notify(), which triggers re-renders in ALL registered instances
// simultaneously, making the shared-state behaviour observable in tests.

import { useState, useEffect, useCallback } from 'react';
import type { DistanceUnit } from '@/types/domain';

const DISTANCE_KEY = 'rsf-pref-distance';
const CURRENCY_KEY  = 'rsf-pref-currency';

function readDistanceUnit(): DistanceUnit {
  const raw = localStorage.getItem(DISTANCE_KEY);
  return raw === 'km' || raw === 'mi' ? raw : 'km';
}

function readCurrency(): string {
  return localStorage.getItem(CURRENCY_KEY) ?? '€';
}

const _listeners = new Set<() => void>();

function notify(): void {
  _listeners.forEach(fn => fn());
}

export interface Preferences {
  distanceUnit: DistanceUnit;
  currency:     string;
}

export interface UsePreferencesReturn extends Preferences {
  setDistanceUnit: (unit: DistanceUnit) => void;
  setCurrency:     (symbol: string)     => void;
}

export function usePreferences(): UsePreferencesReturn {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const update = (): void => forceUpdate(n => n + 1);
    _listeners.add(update);
    return () => { _listeners.delete(update); };
  }, []);

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
