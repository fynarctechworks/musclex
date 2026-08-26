import React from 'react';
import { Pressable, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QrScanner, type ScanOutcome } from '@/features/QrScanner';
import { useCheckIn } from '@/api/queries';
import { useOutbox } from '@/offline/OutboxProvider';
import { isQueueableFailure } from '@/offline/outbox';
import {
  MAX_PIN_ATTEMPTS, PIN_LENGTH, getExitPin, getKioskBranch, isValidPin,
} from '@/kiosk/pin';
import { uuidv4 } from '@/lib/uuid';
import { tokens } from '@/ui/tokens';

/**
 * ────────────────────────────────────────────────────────────────
 * KIOSK — an unattended tablet at the door
 * ────────────────────────────────────────────────────────────────
 *
 * Reuses the check-in module rather than reimplementing it: the same scanner,
 * the same mutation, the same offline queue. The differences are all about the
 * device being unattended and public.
 *
 *  - NO staff context on screen. The greeting, the branch switcher and the
 *    nav are all gone. A queue of members should not be reading the name of
 *    whoever happened to sign the tablet in.
 *  - The branch is PINNED to the device, not taken from the session. A tablet
 *    at the Andheri door must keep recording Andheri visits even if somebody
 *    switches branch elsewhere.
 *  - Leaving requires a PIN. Check-in is deliberately open to anyone walking
 *    past; the way OUT is not, because it leads to every member's phone number
 *    and the till.
 *
 * iOS Guided Access is what actually locks the device to this app — that is a
 * device setting, not something an app can or should enforce. Same for keeping
 * the screen awake (Settings → Display → Auto-Lock → Never). The app not
 * fighting the OS here is deliberate.
 */
export default function Kiosk() {
  const [branchId, setBranchId] = React.useState<string | null>(null);
  const [exiting, setExiting] = React.useState(false);
  const [pin, setPin] = React.useState('');
  const [attempts, setAttempts] = React.useState(0);
  const [pinError, setPinError] = React.useState<string | null>(null);

  const checkIn = useCheckIn();
  const outbox = useOutbox();

  React.useEffect(() => {
    void getKioskBranch().then(setBranchId);
  }, []);

  const submitScan = React.useCallback(
    async (code: string): Promise<ScanOutcome & { retryable?: boolean }> => {
      try {
        await checkIn.mutateAsync({
          qrCode: code,
          clientEventId: uuidv4(),
          // The pinned branch, never the session's active branch.
          branchId,
        });
        return { ok: true, message: 'Checked in — welcome' };
      } catch (e) {
        const status = (e as { status?: number }).status;

        /*
         * A door with no attendant cannot ask anyone to try again later, so a
         * network failure is queued and the member is let through. The gym has
         * decided this trade already for the staffed desk; a kiosk with a
         * stricter rule would just send people to find a human.
         *
         * A POLICY refusal is different and is shown as-is: an expired
         * membership is exactly what the member needs to be told.
         */
        if (isQueueableFailure(e) && branchId) {
          // Without a resolved member id there is nothing valid to queue — the
          // sync DTO requires one, and a scanned token only resolves server-side.
          return {
            ok: false,
            message: 'No connection — please see the front desk',
            retryable: true,
          };
        }

        void status;
        return {
          ok: false,
          message: e instanceof Error ? e.message : 'Could not check in',
          retryable: false,
        };
      }
    },
    [branchId, checkIn],
  );

  async function tryExit() {
    setPinError(null);
    const stored = await getExitPin();

    // No PIN configured: refuse to exit rather than fall open. A kiosk whose
    // lock was never set up is not thereby unlocked.
    if (!stored) {
      setPinError('No exit PIN is set on this device. Reinstall kiosk mode from More.');
      return;
    }

    if (pin !== stored) {
      const next = attempts + 1;
      setAttempts(next);
      setPin('');
      setPinError(
        next >= MAX_PIN_ATTEMPTS
          ? 'Too many attempts. Close and reopen the app to try again.'
          : `Incorrect PIN. ${MAX_PIN_ATTEMPTS - next} attempts left.`,
      );
      return;
    }

    setExiting(false);
    setPin('');
    setAttempts(0);
    router.replace('/(tabs)');
  }

  const locked = attempts >= MAX_PIN_ATTEMPTS;

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} testID="kiosk">
        {exiting ? (
          <View className="flex-1 items-center justify-center gap-5 p-8">
            <Text className="text-2xl font-semibold" style={{ color: '#fff' }}>
              Exit kiosk mode
            </Text>
            <Text className="text-center" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Enter the {PIN_LENGTH}-digit staff PIN.
            </Text>

            <Input
              value={pin}
              onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, PIN_LENGTH))}
              keyboardType="number-pad"
              secureTextEntry
              editable={!locked}
              placeholder="••••"
              style={{ width: 200, textAlign: 'center' }}
              testID="kiosk-pin"
            />

            {pinError ? (
              <Text className="text-center" style={{ color: tokens.destructive }}>
                {pinError}
              </Text>
            ) : null}

            <View className="flex-row gap-3">
              <Button variant="secondary" onPress={() => { setExiting(false); setPin(''); setPinError(null); }}>
                <Text>Cancel</Text>
              </Button>
              <Button onPress={tryExit} disabled={!isValidPin(pin) || locked} testID="kiosk-unlock">
                <Text>Unlock</Text>
              </Button>
            </View>
          </View>
        ) : (
          <View className="flex-1">
            {/* No onClose: a kiosk has no way out of the scanner other than the
                PIN. Passing a no-op would render a dead button, and offering
                "Search by name" to a member is offering them a staff action. */}
            <QrScanner onScan={submitScan} />

            {/*
              The exit affordance is a long-press on a deliberately unlabelled
              corner. A visible "Exit" button on a lobby tablet is an invitation,
              and a member idly tapping around must not find the way out by
              accident — but staff must never be locked out of their own device
              either, so the setup screen states plainly where this is and the
              target is generous. Two seconds is long enough that a stray touch
              while handing the tablet over will not trigger it.
            */}
            <Pressable
              onLongPress={() => setExiting(true)}
              delayLongPress={2000}
              style={{ position: 'absolute', top: 0, left: 0, width: 120, height: 120 }}
              testID="kiosk-exit-target"
            />

            {outbox.pending > 0 ? (
              <View
                className="absolute inset-x-0 top-0 items-center py-2"
                style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
                pointerEvents="none">
                <Text style={{ color: 'rgba(255,255,255,0.85)' }}>
                  {outbox.pending} check-in{outbox.pending === 1 ? '' : 's'} will sync when back online
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </SafeAreaView>
    </>
  );
}
