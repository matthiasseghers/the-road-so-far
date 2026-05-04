// ThemeContext — owns theme state and DOM class application.
// Moved here from App.tsx so consumers (GeneralPanel, AppSidebar) can read/write
// theme without prop drilling through SettingsPage.

import { createContext, useContext, useState, useEffect } from 'react';
import type { Theme } from '@/types/domain';

const THEME_STORAGE_KEY = 'rsf-theme';

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored;
  return 'auto';
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'auto') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme): void {
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  // Reason: suppress all CSS transitions for one paint frame so the class swap
  // is instantaneous — prevents color-interpolation flashes between dark and
  // light token values (e.g. amber midpoints in transition curves).
  root.classList.add('no-transitions');
  root.classList.toggle('dk', resolved === 'dark');
  root.classList.toggle('lt', resolved === 'light');
  requestAnimationFrame(() => root.classList.remove('no-transitions'));
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  // Reason: sidebar toggle cycles explicit light/dark rather than exposing a
  // raw setTheme call — resolves auto to the effective colour before flipping.
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  function setTheme(t: Theme): void {
    setThemeState(t);
  }

  function toggleTheme(): void {
    const resolved = resolveTheme(theme);
    setThemeState(resolved === 'dark' ? 'light' : 'dark');
  }

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  // Reason: when auto, re-apply whenever the OS preference changes.
  useEffect(() => {
    if (theme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (): void => applyTheme('auto');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeContext must be used inside ThemeProvider');
  return ctx;
}
