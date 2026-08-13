// ── Biometric attendance devices (eSSL / ZKTeco) ────────────────

export type DeviceVendor = 'essl' | 'zkteco';

export interface BiometricDevice {
  id: string;
  device_name: string;
  /** The device serial number. */
  hardware_id: string;
  status: 'active' | 'disabled';
  last_seen_at: string | null;
  branch_id: string;
  registered_at: string;
  /** True when the device has pushed data to the server (ADMS routing works). */
  routed: boolean;
}

export interface RegisterDeviceInput {
  /** 4-64 chars, [A-Za-z0-9_-]. */
  serial: string;
  branch_id: string;
  device_name: string;
  vendor?: DeviceVendor;
}

export interface RegisterDeviceResult {
  id: string;
  serial: string;
  device_name: string;
  branch_id: string;
  /** Human-readable setup steps to point the device at this server. */
  instructions: string;
}

export interface MapPinInput {
  /** 1-12 digits — the user PIN configured on the device. */
  pin: string;
  member_id: string;
}

export interface MapPinResult {
  enrollment_id: string;
  pin: string;
  member_id: string;
}

export const SERIAL_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;
export const PIN_PATTERN = /^\d{1,12}$/;

export const vendorLabels: Record<DeviceVendor, string> = {
  essl: 'eSSL',
  zkteco: 'ZKTeco',
};
