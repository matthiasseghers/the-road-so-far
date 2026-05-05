/**
 * @vitest-environment jsdom
 */
// Reason: this test is deliberately written to FAIL with the current
// useState-based usePreferences (each hook call has independent state).
// It will PASS once usePreferences is refactored into a PreferencesContext
// so all consumers share a single store.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePreferences } from '@/hooks/usePreferences';

// Reason: jsdom without a URL does not implement localStorage; stub it manually.
const localStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem:    (k: string) => localStore[k] ?? null,
  setItem:    (k: string, v: string) => { localStore[k] = v; },
  removeItem: (k: string) => { delete localStore[k]; },
};

const DISTANCE_KEY = 'rsf-pref-distance';

describe('usePreferences — shared state across consumers', () => {
  beforeEach(() => {
    delete localStore[DISTANCE_KEY];
    vi.stubGlobal('localStorage', mockLocalStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('both consumers see the updated value after one calls setDistanceUnit', () => {
    // Mount two independent hook instances that represent different components
    const consumer1 = renderHook(() => usePreferences());
    const consumer2 = renderHook(() => usePreferences());

    act(() => {
      consumer1.result.current.setDistanceUnit('mi');
    });

    // Consumer 2 should immediately see 'mi' without remounting.
    // This FAILS with useState (each hook is independent) and
    // PASSES after a PreferencesContext is introduced.
    expect(consumer2.result.current.distanceUnit).toBe('mi');
  });

  it('updates localStorage when setDistanceUnit is called', () => {
    const { result } = renderHook(() => usePreferences());
    act(() => { result.current.setDistanceUnit('mi'); });
    expect(localStore[DISTANCE_KEY]).toBe('mi');
  });

  it('reads the initial distance unit from localStorage', () => {
    localStore[DISTANCE_KEY] = 'mi';
    const { result } = renderHook(() => usePreferences());
    expect(result.current.distanceUnit).toBe('mi');
  });
});
