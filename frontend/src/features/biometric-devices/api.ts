import { apiClient } from '@/services/api-client';
import type {
  BiometricDevice,
  MapPinInput,
  MapPinResult,
  RegisterDeviceInput,
  RegisterDeviceResult,
} from './types';

export const biometricDevicesApi = {
  list: () => apiClient.get<BiometricDevice[]>('/biometric-devices'),

  register: (data: RegisterDeviceInput) =>
    apiClient.post<RegisterDeviceResult>('/biometric-devices', data),

  mapPin: (serial: string, data: MapPinInput) =>
    apiClient.post<MapPinResult>(
      `/biometric-devices/${encodeURIComponent(serial)}/map`,
      data,
    ),

  remove: (serial: string) =>
    apiClient.delete<{ success: boolean }>(
      `/biometric-devices/${encodeURIComponent(serial)}`,
    ),
};
