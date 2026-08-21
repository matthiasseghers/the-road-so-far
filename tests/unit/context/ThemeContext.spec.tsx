/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { useThemeContext } from '@/hooks/useThemeContext';

// ── Browser API stubs ─────────────────────────────────────────────────────────
// Reason: jsdom without a URL does not implement localStorage or matchMedia.
// We stub them so ThemeContext internals work without a full browser context.

const localStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem:    (k: string) => localStore[k] ?? null,
  setItem:    (k: string, v: string) => { localStore[k] = v; },
  removeItem: (k: string) => { delete localStore[k]; },
  clear:      () => { (Object.keys(localStore)).forEach(k => { delete localStore[k]; }); },
};

const mockMatchMedia = (query: string) => ({
  matches: false,
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: React.ReactNode }): JSX.Element {
  return React.createElement(ThemeProvider, null, children);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ThemeProvider', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    document.documentElement.className = '';
    vi.stubGlobal('localStorage', mockLocalStorage);
    vi.stubGlobal('matchMedia', mockMatchMedia);
    // Execute requestAnimationFrame synchronously so DOM updates are immediate in tests
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0; });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.className = '';
  });

  it('reads initial theme from localStorage', () => {
    localStore['rsf-theme'] = 'light';
    const { result } = renderHook(() => useThemeContext(), { wrapper });
    expect(result.current.theme).toBe('light');
  });

  it('defaults to "auto" when localStorage has no theme', () => {
    const { result } = renderHook(() => useThemeContext(), { wrapper });
    expect(result.current.theme).toBe('auto');
  });

  it('setTheme("dark") applies the .dk class and removes .lt', () => {
    const { result } = renderHook(() => useThemeContext(), { wrapper });
    act(() => { result.current.setTheme('dark'); });
    expect(document.documentElement.classList.contains('dk')).toBe(true);
    expect(document.documentElement.classList.contains('lt')).toBe(false);
  });

  it('setTheme("light") applies the .lt class and removes .dk', () => {
    const { result } = renderHook(() => useThemeContext(), { wrapper });
    act(() => { result.current.setTheme('light'); });
    expect(document.documentElement.classList.contains('lt')).toBe(true);
    expect(document.documentElement.classList.contains('dk')).toBe(false);
  });

  it('persists the selected theme to localStorage', () => {
    const { result } = renderHook(() => useThemeContext(), { wrapper });
    act(() => { result.current.setTheme('dark'); });
    expect(localStore['rsf-theme']).toBe('dark');
  });
});

describe('useThemeContext() outside ThemeProvider', () => {
  it('throws when called outside a ThemeProvider', () => {
    // Suppress the expected React error boundary console output
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useThemeContext())).toThrow(
      'useThemeContext must be used inside ThemeProvider',
    );
    spy.mockRestore();
  });
});
