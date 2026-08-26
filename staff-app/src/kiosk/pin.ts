import * as SecureStore from 'expo-secure-store';

/**
 * ────────────────────────────────────────────────────────────────
 * KIOSK EXIT PIN
 * ────────────────────────────────────────────────────────────────
 *
 * A kiosk is an unattended tablet in a public lobby, signed in as staff. That
 * makes leaving kiosk mode a privileged action: whoever exits gets the whole
 * staff app — every member's phone number, the payment history, the till. The
 * PIN is not there to protect the check-in flow, which is deliberately open to
 * anyone walking past. It is there because the way OUT must not be.
 *
 * Stored in SecureStore, which is the iOS Keychain — hardware-backed and
 * outside the app's own sandbox files. The PIN is kept as-is rather than
 * hashed: a 4-digit space is trivially brute-forced from a hash anyway, so a
 * hash would buy nothing while implying a protection that is not there. What
 * actually protects it is the Keychain and the attempt limit below.
 *
 * This is NOT a second authentication factor and does not gate anything the
 * server cares about. The server's boundary is still the staff JWT.
 */

const PIN_KEY = 'kiosk_exit_pin';
const KIOSK_BRANCH_KEY = 'kiosk_branch_id';

/** Short enough to type at a door, long enough not to be guessed in three goes. */
export const PIN_LENGTH = 4;

/** Wrong entries before the field locks for a while. */
export const MAX_PIN_ATTEMPTS = 5;

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

export async function setExitPin(pin: string): Promise<void> {
  if (!isValidPin(pin)) throw new Error(`PIN must be ${PIN_LENGTH} digits`);
  await SecureStore.setItemAsync(PIN_KEY, pin);
}

export async function getExitPin(): Promise<string | null> {
  return SecureStore.getItemAsync(PIN_KEY).catch(() => null);
}

export async function clearExitPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_KEY).catch(() => {});
}

/**
 * The branch this device is pinned to.
 *
 * Persisted separately from the session so it survives a reload and cannot be
 * changed by anything the kiosk screen itself does. A kiosk at the Andheri
 * door must never start recording check-ins against Bandra because somebody
 * switched branch on a different screen.
 */
export async function setKioskBranch(branchId: string): Promise<void> {
  await SecureStore.setItemAsync(KIOSK_BRANCH_KEY, branchId);
}

export async function getKioskBranch(): Promise<string | null> {
  return SecureStore.getItemAsync(KIOSK_BRANCH_KEY).catch(() => null);
}

export async function clearKioskBranch(): Promise<void> {
  await SecureStore.deleteItemAsync(KIOSK_BRANCH_KEY).catch(() => {});
}
