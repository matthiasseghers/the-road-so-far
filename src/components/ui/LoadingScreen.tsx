import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface LoadingScreenProps {
  /** Optional label shown below the spinner. */
  message?: string;
  className?: string;
}

/**
 * Full-page loading state. Uses the same Spinner component already used
 * throughout the app so the visual language stays consistent.
 */
export function LoadingScreen({ message, className }: LoadingScreenProps): JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center h-full min-h-[400px] gap-3 p-8',
        className,
      )}
    >
      <Spinner className="size-6" />
      {message && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {message}
        </p>
      )}
    </div>
  );
}
