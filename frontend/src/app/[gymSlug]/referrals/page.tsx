'use client';

import React, { useState } from 'react';
import { UserPlus, Plus } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useReferralPrograms,
} from '@/features/marketing';
import {
  ReferralStatsCards,
} from '@/features/referrals';
import { ReferralProgramCard } from './components/ReferralProgramCard';
import { CreateProgramDialog } from './components/CreateProgramDialog';

export default function ReferralsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const filters = {
    status: statusFilter !== 'all' ? statusFilter : undefined,
  };
  const { data: programs, isLoading } = useReferralPrograms(filters);

  const programList: Record<string, unknown>[] = Array.isArray(programs) ? programs : (programs as { data?: Record<string, unknown>[] })?.data ?? [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Referral Program"
          description="Manage referral programs and track member referrals"
          actions={
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Program
            </Button>
          }
        />

        {/* Global Stats */}
        <ReferralStatsCards />

        {/* Filters */}
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[150px] bg-muted border-border text-foreground text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all" className="text-foreground focus:bg-muted">All Statuses</SelectItem>
              <SelectItem value="active" className="text-foreground focus:bg-muted">Active</SelectItem>
              <SelectItem value="paused" className="text-foreground focus:bg-muted">Paused</SelectItem>
              <SelectItem value="ended" className="text-foreground focus:bg-muted">Ended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Programs list */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : programList.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="No referral programs"
            description="Create your first referral program to start growing through member referrals."
            action={
              <Button
                onClick={() => setCreateOpen(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Program
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {programList.map((program: Record<string, unknown>) => (
              <ReferralProgramCard key={program.id as string} program={program} />
            ))}
          </div>
        )}
      </div>

      <CreateProgramDialog open={createOpen} onOpenChange={setCreateOpen} />
    </AppLayout>
  );
}
