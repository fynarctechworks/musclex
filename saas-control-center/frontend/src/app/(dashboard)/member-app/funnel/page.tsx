'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { useMemberAppFunnel } from '@/hooks/use-member-app';

export default function FunnelPage() {
  const { data: steps, isLoading, isError, refetch } = useMemberAppFunnel();

  return (
    <div>
      <PageHeader
        title="Conversion Funnel"
        description="Registered → onboarded → explored gyms → joined"
      />

      {isLoading ? (
        <Skeleton className="h-[400px] rounded-lg" />
      ) : isError || !steps ? (
        <ErrorState title="Could not load funnel" onRetry={() => refetch()} />
      ) : (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="space-y-3">
            {steps.map((s, i) => (
              <div key={s.key}>
                <div className="mb-1 flex items-center justify-between text-[13px]">
                  <span className="font-medium text-foreground">{s.label}</span>
                  <span className="text-muted-foreground">
                    {s.count.toLocaleString()}
                    {i > 0 && (
                      <span className="ml-2 text-[12px] text-muted-foreground/70">
                        {s.pctOfPrev}% of previous
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-8 w-full overflow-hidden rounded-md bg-muted">
                  <div
                    className="flex h-full items-center justify-end rounded-md bg-primary/80 px-2 text-[11px] font-medium text-primary-foreground transition-all"
                    style={{ width: `${Math.max(s.pctOfTop, 3)}%` }}
                  >
                    {s.pctOfTop}%
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[12px] text-muted-foreground">
            Bars show share of the top of the funnel (registrations). Onboarding
            steps derive from onboarding state; gym-exploration steps derive from
            app events; “Joined a Gym” = a linked membership.
          </p>
        </div>
      )}
    </div>
  );
}
