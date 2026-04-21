import { useState, useCallback } from 'react';
import type { DistanceUnit } from '@/types/domain';

// Reason: localStorage keys are constants to avoid typos elsewhere.
const DISTANCE_KEY = 'rsf-pref-distance';
const CURRENCY_KEY = 'rsf-pref-currency';

export interface Preferences {
  distanceUnit: DistanceUnit;
  currency: string;
}

export interface UsePreferencesReturn extends Preferences {
  setDistanceUnit: (unit: DistanceUnit) => void;
  setCurrency: (symbol: string) => void;
}

function readDistanceUnit(): DistanceUnit {
  const raw = localStorage.getItem(DISTANCE_KEY);
  return raw === 'km' || raw === 'mi' ? raw : 'km';
}

function readCurrency(): string {
  return localStorage.getItem(CURRENCY_KEY) ?? '€';
}

export function usePreferences(): UsePreferencesReturn {
  const [distanceUnit, setDistanceUnitState] = useState<DistanceUnit>(readDistanceUnit);
  const [currency, setCurrencyState] = useState<string>(readCurrency);

  const setDistanceUnit = useCallback((unit: DistanceUnit): void => {
    localStorage.setItem(DISTANCE_KEY, unit);
    setDistanceUnitState(unit);
  }, []);

  const setCurrency = useCallback((symbol: string): void => {
    localStorage.setItem(CURRENCY_KEY, symbol);
    setCurrencyState(symbol);
  }, []);

  return { distanceUnit, currency, setDistanceUnit, setCurrency };
}
