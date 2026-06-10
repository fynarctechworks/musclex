import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Icon, Logo, Txt, useThemeColors } from '../../design-system';
import { useAuth } from '../../auth/auth-store';
import { usePrefs } from '../../auth/prefs-store';
import { authenticateBiometric } from './biometric';

/**
 * Optional biometric app-lock. When the member has enabled it (Account &
 * Security) and is signed in, the app is gated behind a Face ID / fingerprint
 * prompt on cold start and whenever it returns to the foreground. This is a UX
 * lock over the EXISTING authenticated session — it does not touch identity,
 * tokens, or tenant scoping.
 *
 * Lock state is derived, not effect-driven: we remember which member id we last
 * unlocked for in this foreground session. Going to the background clears it
 * (relock on return), and signing out changes the id (relock on next sign-in) —
 * so no effect ever sets state synchronously.
 */
export function AppLock() {
  const enabled = usePrefs((s) => s.biometricEnabled);
  const status = useAuth((s) => s.status);
  const memberId = useAuth((s) => s.profile?.id ?? null);

  const active = enabled && status === 'authenticated';
  const [unlockedFor, setUnlockedFor] = useState<string | null>(null);
  const locked = active && unlockedFor !== memberId;

  // Relock whenever the app leaves the foreground. setState lives in the listener
  // callback (an external event), never synchronously in the effect body.
  useEffect(() => {
    let prev: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (prev === 'active' && /inactive|background/.test(next)) {
        setUnlockedFor(null);
      }
      prev = next;
    });
    return () => sub.remove();
  }, []);

  if (!locked) return null;
  return <LockOverlay onUnlock={() => setUnlockedFor(memberId)} />;
}

function LockOverlay({ onUnlock }: { onUnlock: () => void }) {
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();
  const signOut = useAuth((s) => s.signOut);
  const prompting = useRef(false);

  const tryUnlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    const ok = await authenticateBiometric('Unlock MuscleX');
    prompting.current = false;
    if (ok) onUnlock();
  }, [onUnlock]);

  // Auto-fire the OS prompt once when the lock appears. The effect body only
  // kicks off an async function (no synchronous setState).
  useEffect(() => {
    void tryUnlock();
  }, [tryUnlock]);

  return (
    <View
      className="items-center justify-center bg-canvas px-2xl"
      style={[
        StyleSheet.absoluteFill,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Logo variant="mark" height={40} />
      <View className="mt-2xl mb-lg h-[72px] w-[72px] items-center justify-center rounded-full border border-hairline bg-surface">
        <Icon name="alert" color={theme.body} size={30} />
      </View>
      <Txt variant="display-sm" weight="600" className="text-center text-ink">
        MuscleX is locked
      </Txt>
      <Txt variant="body-sm" className="mt-xs mb-2xl text-center text-body">
        {"Verify it's you to continue."}
      </Txt>
      <View className="w-full gap-sm">
        <Button title="Unlock" fullWidth onPress={() => void tryUnlock()} />
        <Button title="Sign out" variant="ghost" fullWidth onPress={() => void signOut()} />
      </View>
    </View>
  );
}
