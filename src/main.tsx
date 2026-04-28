import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/global.css';
import App from './App';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

// Reason: the blocking script in index.html already applies .dk/.lt before first paint.
// No need to set a default here — doing so would override a saved light preference.

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
