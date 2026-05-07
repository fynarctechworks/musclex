'use client';

import { useFeatureFlags, useSetPlanFlag } from '@/hooks/use-feature-flags';
import { usePlans } from '@/hooks/use-plans';
import { PageHeader } from '@/components/layout/page-header';
import { Switch } from '@/components/ui/switch';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function FeatureFlagsPage() {
  const { data: flags, isLoading } = useFeatureFlags();
  const { data: plans } = usePlans();
  const setPlanFlag = useSetPlanFlag();

  if (isLoading)
    return (
      <div>
        <PageHeader
          title="Feature Flags"
          description="Control feature access per plan and tenant"
        />
        <LoadingSkeleton rows={8} />
      </div>
    );

  return (
    <div>
      <PageHeader
        title="Feature Flags"
        description="Control feature access per plan and tenant"
      />

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-48 text-[13px]">Feature</TableHead>
              <TableHead className="w-24 text-[13px]">Global</TableHead>
              {plans?.map((plan) => (
                <TableHead key={plan.id} className="text-[13px]">{plan.name}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {flags?.map((flag) => (
              <TableRow key={flag.id}>
                <TableCell>
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">{flag.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {flag.key}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                      flag.is_global
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : 'bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {flag.is_global ? 'ON' : 'OFF'}
                  </span>
                </TableCell>
                {plans?.map((plan) => {
                  const planFlag = flag.plan_flags.find(
                    (pf) => pf.plan_id === plan.id,
                  );
                  return (
                    <TableCell key={plan.id}>
                      <Switch
                        checked={planFlag?.enabled ?? flag.is_global}
                        onCheckedChange={(enabled) =>
                          setPlanFlag.mutate({
                            plan_id: plan.id,
                            flag_id: flag.id,
                            enabled,
                          })
                        }
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
