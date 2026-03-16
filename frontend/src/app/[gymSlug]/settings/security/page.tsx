'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader, LoadingSkeleton } from '@/components/shared';
import { TwoFactorSetupCard } from '@/components/shared/two-factor-setup-card';
import { twoFactorApi } from '@/features/auth/two-factor-api';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function SecuritySettingsPage() {
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ['2fa-status'],
    queryFn: () => twoFactorApi.getStatus(),
  });

  const handleStatusChange = () => {
    queryClient.invalidateQueries({ queryKey: ['2fa-status'] });
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl">
        <PageHeader
          title="Security Settings"
          description="Manage your account security and authentication preferences"
        />

        <div className="mt-6 space-y-6">
          {isLoading ? (
            <LoadingSkeleton className="h-48" />
          ) : (
            <TwoFactorSetupCard
              enabled={status?.enabled ?? false}
              onStatusChange={handleStatusChange}
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
