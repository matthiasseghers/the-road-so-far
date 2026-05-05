// Reason: thin shim so existing imports from @/hooks/usePreferences continue
// to work after moving the implementation to PreferencesContext.
export {
  usePreferences,
  type Preferences,
  type UsePreferencesReturn,
} from '@/context/PreferencesContext';
