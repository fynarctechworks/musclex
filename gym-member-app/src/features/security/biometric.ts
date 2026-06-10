import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Thin facade over expo-local-authentication for the optional app-lock. The
 * dependency already ships with the app; this wires it into a real lock (the
 * `biometricEnabled` pref was previously stored but never enforced).
 *
 * Web has no usable biometric prompt, so we report it unavailable there — the
 * app never locks on web (used for screen previews) and the toggle is disabled.
 */

/** Hardware present AND the user has enrolled a biometric. */
export async function isBiometricAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const [hasHardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hasHardware && enrolled;
  } catch {
    return false;
  }
}

/** Human label for the strongest available method (Face ID / Fingerprint / …). */
export async function biometricLabel(): Promise<string> {
  if (Platform.OS === 'web') return 'Biometric unlock';
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return Platform.OS === 'ios' ? 'Face ID' : 'Face unlock';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint unlock';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'Iris unlock';
    }
  } catch {
    /* fall through */
  }
  return 'Biometric unlock';
}

/** Prompt for a biometric. Returns true only on a real success. */
export async function authenticateBiometric(promptMessage: string): Promise<boolean> {
  if (Platform.OS === 'web') return true; // never gate web
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false, // allow device passcode as a fallback
    });
    return res.success;
  } catch {
    return false;
  }
}
