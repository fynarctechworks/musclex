import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, ListRow, Screen, Txt, useThemeColors } from '../../src/design-system';
import { ScreenHeader } from '../../src/navigation/ScreenHeader';
import { useAuth } from '../../src/auth/auth-store';
import { usePrefs } from '../../src/auth/prefs-store';
import {
  authenticateBiometric,
  biometricLabel,
  isBiometricAvailable,
} from '../../src/features/security/biometric';
import { notify } from '../../src/lib/confirm';

/**
 * Account & Security (reference: 90_Light_settings). Only the items MuscleX can
 * honestly back are shown:
 *   • Biometric / Face ID app-lock — real (expo-local-authentication + AppLock).
 * Password change is N/A (members sign in with a phone OTP, no password), and
 * authenticator-app 2FA, device management and account deletion need server
 * support — so they're intentionally omitted rather than shown as dead toggles.
 */
export default function AccountSecurityScreen() {
  const router = useRouter();
  const theme = useThemeColors();
  const signOut = useAuth((s) => s.signOut);
  const biometricEnabled = usePrefs((s) => s.biometricEnabled);
  const setBiometric = usePrefs((s) => s.setBiometric);

  const [available, setAvailable] = useState<boolean | null>(null);
  const [label, setLabel] = useState('Biometric unlock');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [ok, name] = await Promise.all([isBiometricAvailable(), biometricLabel()]);
      if (!alive) return;
      setAvailable(ok);
      setLabel(name);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function onToggleBiometric(value: boolean) {
    if (busy) return;
    if (!value) {
      await setBiometric(false);
      return;
    }
    // Confirm the member can actually pass the check BEFORE arming it, so they
    // never lock themselves out.
    setBusy(true);
    try {
      const ok = await authenticateBiometric(`Enable ${label}`);
      if (ok) {
        await setBiometric(true);
      } else {
        notify('Not enabled', `We couldn't verify ${label}. Please try again.`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <View className="pt-md">
        <ScreenHeader title="Account & Security" />

        <Txt variant="caption" className="mb-sm mt-md text-mute">
          APP LOCK
        </Txt>
        <Card>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-md">
              <Txt variant="body-lg" weight="600" className="text-ink">
                {label}
              </Txt>
              <Txt variant="body-sm" className="mt-xxs text-body">
                {available === false
                  ? 'Not set up on this device. Add Face ID or a fingerprint in your device settings first.'
                  : `Require ${label} when the app opens or returns to the foreground.`}
              </Txt>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={onToggleBiometric}
              disabled={busy || available === false || available === null}
              trackColor={{ true: theme.primary, false: theme.surface2 }}
            />
          </View>
        </Card>

        <Txt variant="caption" className="mb-sm mt-lg text-mute">
          ACCOUNT
        </Txt>
        <Card noPadding>
          <ListRow
            label="Notification preferences"
            onPress={() => router.push('/notifications/settings')}
          />
          <ListRow label="Sign out" destructive last onPress={() => void signOut()} />
        </Card>

        <Txt variant="body-sm" className="mt-2xl text-center text-mute">
          {"You sign in with your phone number and a one-time code — there's no password to manage."}
        </Txt>
      </View>
    </Screen>
  );
}
