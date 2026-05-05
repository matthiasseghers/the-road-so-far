import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/styles/global.css';
import App from './App';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ThemeProvider } from '@/context/ThemeContext';
import { PreferencesProvider } from '@/context/PreferencesContext';

// Reason: the blocking script in index.html already applies .dk/.lt before first paint.
// No need to set a default here — doing so would override a saved light preference.

// Reason: single QueryClient at the app root so every hook shares one cache.
// staleTime: 30_000 — data stays fresh for 30 s; prevents duplicate requests when
// multiple components mount against the same endpoint within that window.
// retry: 1 — one automatic retry on transient failure (server is local, so more
// retries would just stall the UI).
// gcTime: 300_000 — unused cache entries are kept for 5 min before garbage collection.
// refetchOnWindowFocus: disabled inside Tauri because window focus events fire
// frequently when switching native windows, causing spurious server round-trips.
const isTauri = '__TAURI__' in window || '__TAURI_INTERNALS__' in window;
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      gcTime: 300_000,
      refetchOnWindowFocus: isTauri ? false : true,
    },
  },
});

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <PreferencesProvider>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </PreferencesProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
