'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader, LoadingSkeleton , AccessDenied } from '@/components/shared';
import { TwoFactorSetupCard } from '@/components/shared/two-factor-setup-card';
import { twoFactorApi } from '@/features/auth/two-factor-api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRequirePermission } from "@/hooks/use-require-permission";

export default function SecuritySettingsPage() {
  const { allowed, checked } = useRequirePermission("settings", "view", "deny");
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ['2fa-status'],
    queryFn: () => twoFactorApi.getStatus(),
  });

  const handleStatusChange = () => {
    queryClient.invalidateQueries({ queryKey: ['2fa-status'] });
  };


  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="settings" />
      </AppLayout>
    );
  }

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
