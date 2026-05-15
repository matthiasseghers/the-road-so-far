import { useContext } from 'react';
import { ThemeContext } from '@/context/ThemeContext.def';
import type { ThemeContextValue } from '@/context/ThemeContext.def';

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeContext must be used inside ThemeProvider');
  return ctx;
}
