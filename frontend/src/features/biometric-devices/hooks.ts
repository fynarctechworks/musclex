import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { biometricDevicesApi } from './api';
import type { MapPinInput, RegisterDeviceInput } from './types';

// Local query-key factory — same [module, entity, ...] convention as
// services/query-client.ts, scoped to this feature so we don't touch the
// shared file.
export const biometricDeviceKeys = {
  all: ['biometric-devices'] as const,
  list: () => [...biometricDeviceKeys.all, 'list'] as const,
};

export function useBiometricDevices() {
  return useQuery({
    queryKey: biometricDeviceKeys.list(),
    queryFn: () => biometricDevicesApi.list(),
  });
}

export function useRegisterDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RegisterDeviceInput) =>
      biometricDevicesApi.register(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: biometricDeviceKeys.all });
      // No toast — the register dialog switches to the setup-instructions
      // view on success, which is the confirmation.
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useMapDevicePin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ serial, data }: { serial: string; data: MapPinInput }) =>
      biometricDevicesApi.mapPin(serial, data),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: biometricDeviceKeys.all });
      toast.success(`PIN ${result.pin} mapped to member`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (serial: string) => biometricDevicesApi.remove(serial),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: biometricDeviceKeys.all });
      toast.success('Device removed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
