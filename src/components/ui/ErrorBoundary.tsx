import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

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
      <div className="flex flex-col items-center justify-center h-screen gap-6 p-8 text-center">
        <div className="flex flex-col gap-2 max-w-md">
          <h1 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
            Something went wrong
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {error.message}
          </p>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>
    );
  }
}
