import React from 'react';
import { ScrollView, View } from 'react-native';
import { Stack, router } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { useSession } from '@/auth/SessionProvider';
import { useBranches } from '@/api/queries';
import { PIN_LENGTH, isValidPin, setExitPin, setKioskBranch } from '@/kiosk/pin';
import { tokens } from '@/ui/tokens';

/**
 * Turn this device into a kiosk.
 *
 * Two things are decided here and then deliberately cannot be changed from
 * inside kiosk mode: which branch the device records against, and the PIN that
 * gets you back out. Both are written to the Keychain rather than held in the
 * session, so neither survives being changed on some other screen and neither
 * is lost on a reload.
 */
export default function KioskSetup() {
  const { session } = useSession();
  const branches = useBranches();

  const assigned = session?.user?.branch_ids ?? [];
  const options = (branches.data ?? []).filter(
    (b) => assigned.length === 0 || assigned.includes(b.id),
  );

  const [branchId, setBranchId] = React.useState<string | null>(null);
  const [pin, setPin] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!branchId && options.length > 0) setBranchId(options[0].id);
  }, [options, branchId]);

  const ready = Boolean(branchId) && isValidPin(pin) && pin === confirm;

  async function start() {
    setError(null);
    if (!branchId) { setError('Pick the branch this device sits in.'); return; }
    if (!isValidPin(pin)) { setError(`The PIN must be ${PIN_LENGTH} digits.`); return; }
    if (pin !== confirm) { setError('The two PINs do not match.'); return; }

    try {
      await setKioskBranch(branchId);
      await setExitPin(pin);
      // replace, not push: kiosk must not sit on top of a back stack that
      // would let somebody swipe out of it.
      router.replace('/kiosk');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start kiosk mode');
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Kiosk mode' }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: tokens.background }}
        contentContainerStyle={{ padding: 16, gap: 20 }}>
        <Text className="text-muted-foreground">
          Turns this device into an unattended check-in station. Members scan their
          own code; nothing else in the app is reachable until the PIN is entered.
        </Text>

        <View className="gap-2">
          <Label><Text>Branch this device sits in</Text></Label>
          {options.length === 0 ? (
            <Text className="text-sm text-muted-foreground">
              {branches.isLoading ? 'Loading branches…' : 'No branches available on this account.'}
            </Text>
          ) : (
            <SegmentedControl
              value={branchId ?? options[0].id}
              onChange={(v) => setBranchId(v)}
              segments={options.map((b) => ({ value: b.id, label: b.name }))}
            />
          )}
          <Text className="text-xs text-muted-foreground">
            Pinned to the device. Check-ins are recorded here even if someone changes
            branch elsewhere.
          </Text>
        </View>

        <View className="gap-2">
          <Label><Text>Exit PIN</Text></Label>
          <Input
            value={pin}
            onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, PIN_LENGTH))}
            keyboardType="number-pad" secureTextEntry placeholder="••••"
            testID="kiosk-setup-pin"
          />
          <Input
            value={confirm}
            onChangeText={(t) => setConfirm(t.replace(/\D/g, '').slice(0, PIN_LENGTH))}
            keyboardType="number-pad" secureTextEntry placeholder="Confirm PIN"
            testID="kiosk-setup-confirm"
          />
          <Text className="text-xs text-muted-foreground">
            Staff need this to leave kiosk mode. Anyone who leaves it has the whole
            app, so do not use the gym's door code.
          </Text>
        </View>

        <View className="gap-2 rounded-xl border border-border bg-card p-4">
          <Text className="font-semibold text-foreground">How to get back out</Text>
          <Text className="text-sm text-muted-foreground">
            Press and hold the <Text className="font-semibold">top-left corner</Text> of
            the screen for two seconds, then enter the PIN. There is deliberately no
            visible button — on a tablet in the lobby, one would just be an invitation.
          </Text>
          <Text className="text-xs text-muted-foreground">
            Worth doing once now, before you walk away, so you know the spot.
          </Text>
        </View>

        <View className="gap-2 rounded-xl border border-border bg-card p-4">
          <Text className="font-semibold text-foreground">Before you walk away</Text>
          <Text className="text-sm text-muted-foreground">
            iOS is what actually locks the device to this app — the app cannot do it
            itself. On this device set:
          </Text>
          <Text className="text-sm text-muted-foreground">
            • Settings → Accessibility → Guided Access → on, then triple-click the
            side button here to start it.{'\n'}
            • Settings → Display &amp; Brightness → Auto-Lock → Never.
          </Text>
        </View>

        {error ? (
          <Text className="text-sm" style={{ color: tokens.destructive }}>{error}</Text>
        ) : null}

        <Button onPress={start} disabled={!ready} testID="kiosk-start">
          <Text>Start kiosk mode</Text>
        </Button>
      </ScrollView>
    </>
  );
}
