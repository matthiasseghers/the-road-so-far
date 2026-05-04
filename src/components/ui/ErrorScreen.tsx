import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorScreenProps {
  /** Human-readable description of what failed. */
  message?: string;
  /** Called when the user clicks "Try again". */
  onRetry?: () => void;
  /** Called when the user clicks "Go back". Only rendered when provided. */
  onGoBack?: () => void;
  className?: string;
}

/**
 * Full-page error state for critical async/network failures from React Query.
 * Not a React Error Boundary — use AppErrorBoundary for render crashes.
 */
export function ErrorScreen({ message, onRetry, onGoBack, className }: ErrorScreenProps): JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center h-full min-h-[400px] gap-6 p-8 text-center',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-3">
        <AlertTriangle
          size={40}
          aria-hidden
          style={{ color: 'var(--destructive)' }}
        />
        <div className="flex flex-col gap-1.5 max-w-sm">
          <h2
            className="text-xl font-semibold"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
          >
            Something went wrong
          </h2>
          {message && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {message}
            </p>
          )}
        </div>
      </div>

      {(onGoBack ?? onRetry) && (
        <div className="flex items-center gap-3">
          {onGoBack && (
            <Button variant="outline" onClick={onGoBack}>
              Go back
            </Button>
          )}
          {onRetry && (
            <Button variant="default" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
