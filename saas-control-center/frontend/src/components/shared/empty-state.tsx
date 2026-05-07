import { InboxIcon } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

export function EmptyState({
  title = 'No data found',
  description = 'There are no records to display.',
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-border bg-card">
      {icon || <InboxIcon className="h-10 w-10 text-muted-foreground/40 mb-3" />}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="text-[13px] text-muted-foreground mt-1">{description}</p>
    </div>
  );
}
