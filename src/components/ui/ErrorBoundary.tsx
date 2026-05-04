import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { ErrorScreen } from '@/components/ui/ErrorScreen';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches unhandled render errors and shows a readable fallback instead of
 * a blank page. Must be a class component — React's error boundary API
 * requires getDerivedStateFromError / componentDidCatch lifecycle methods.
 *
 * This handles render crashes only. React Query network errors are handled
 * per-page via ErrorScreen rendered from the query's error state.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log to console so it's visible in DevTools / server logs.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex items-center justify-center h-screen">
        <ErrorScreen
          message={error.message}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }
}
