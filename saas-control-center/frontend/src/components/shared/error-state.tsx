import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

/**
 * Distinct failure UI — so a fetch error is never mistaken for "no data".
 * Use this for the `isError` branch; reserve EmptyState for genuine zero-row results.
 */
export function ErrorState({
  title = 'Could not load data',
  description = 'Something went wrong while fetching this data. It may be a connection issue or the service may be temporarily unavailable.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-destructive/30 bg-destructive/5">
      <AlertTriangle className="h-10 w-10 text-destructive/60 mb-3" />
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="text-[13px] text-muted-foreground mt-1 max-w-md text-center">{description}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
