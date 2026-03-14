import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/query-client';
import { settingsApi } from './api';
import { toast } from 'sonner';

export function useStudioSettings() {
  return useQuery({
    queryKey: queryKeys.settings.studio(),
    queryFn: () => settingsApi.getStudio(),
  });
}

export function useUpdateStudioSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: settingsApi.updateStudio,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.settings.all });
      toast.success('Studio settings updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAccountSettings() {
  return useQuery({
    queryKey: queryKeys.settings.account(),
    queryFn: () => settingsApi.getAccount(),
  });
}

export function useBillingInvoices() {
  return useQuery({
    queryKey: queryKeys.settings.invoices(),
    queryFn: () => settingsApi.getInvoices(),
  });
}

export function useBranchesSummary() {
  return useQuery({
    queryKey: queryKeys.settings.branchesSummary(),
    queryFn: () => settingsApi.getBranchesSummary(),
  });
}

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: queryKeys.settings.plans(),
    queryFn: () => settingsApi.getPlans(),
  });
}
