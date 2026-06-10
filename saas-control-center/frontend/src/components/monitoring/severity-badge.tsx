import { STATUS_COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function SeverityBadge({ value }: { value: string }) {
  const colorClass =
    STATUS_COLORS[value] || 'bg-muted text-muted-foreground border-border';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium',
        colorClass,
      )}
    >
      {value}
    </span>
  );
}
