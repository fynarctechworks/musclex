import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
  onClick?: () => void;
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
  onClick,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-5 transition-all hover:border-border/80',
        onClick && 'cursor-pointer hover:bg-muted/30 hover:shadow-sm active:scale-[0.98]',
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex items-center gap-1.5">
          {trend && trend !== 'neutral' && (
            <span
              className={cn(
                'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium',
                trend === 'up' && 'bg-emerald-500/10 text-emerald-500',
                trend === 'down' && 'bg-destructive/10 text-destructive',
              )}
            >
              {trend === 'up' ? '↑' : '↓'}
            </span>
          )}
          {onClick && (
            <span className="text-[10px] text-primary/50 font-medium">→</span>
          )}
        </div>
      </div>
      <p className="mt-3 text-[13px] text-muted-foreground">{title}</p>
      <p className="mt-0.5 text-2xl font-semibold text-foreground tracking-tight">{value}</p>
      {subtitle && (
        <p
          className={cn(
            'mt-1 text-[11px]',
            trend === 'up' && 'text-emerald-500',
            trend === 'down' && 'text-destructive',
            (!trend || trend === 'neutral') && 'text-muted-foreground',
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
