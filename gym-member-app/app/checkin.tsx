import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Icon,
  ProgressRing,
  Screen,
  Txt,
  useThemeColors,
} from '../src/design-system';
import { submitCheckIn } from '../src/features/checkin/submit';
import { MemberApiError } from '../src/api/client';
import { qk } from '../src/api/queries';

type Phase = 'scan' | 'submitting' | 'success' | 'queued' | 'error';

const SCAN = 240; // reticle size

export default function CheckInScreen() {
  const theme = useThemeColors();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('scan');
  const [streak, setStreak] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const locked = useRef(false);
  const scanY = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  const close = () => router.back();

  // Celebratory pop when the result lands — the check-in is the daily emotional
  // peak, so we give it a spring-in + (on a milestone streak) an extra haptic.
  const isMilestone = streak != null && [3, 7, 14, 30, 50, 100].includes(streak);
  useEffect(() => {
    if (phase !== 'success' && phase !== 'queued') return;
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }).start();
    if (phase === 'success' && isMilestone) {
      const t = setTimeout(
        () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
        220,
      );
      return () => clearTimeout(t);
    }
  }, [phase, isMilestone, pop]);

  // Animated scan line — runs only while actively scanning.
  useEffect(() => {
    if (phase !== 'scan') return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scanY, { toValue: SCAN - 16, duration: 1800, useNativeDriver: true }),
        Animated.timing(scanY, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [phase, scanY]);

  const handle = useCallback(
    async (token?: string) => {
      if (locked.current) return;
      locked.current = true;
      setPhase('submitting');
      try {
        const outcome = await submitCheckIn(token);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: qk.home });
        qc.invalidateQueries({ queryKey: qk.occupancy });
        if (outcome.queued) {
          setPhase('queued');
        } else {
          setStreak(outcome.result?.streakDays ?? null);
          setPhase('success');
        }
      } catch (err) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setErrorMsg(
          err instanceof MemberApiError ? err.message : 'Could not check you in. Try again.',
        );
        setPhase('error');
        locked.current = false;
      }
    },
    [qc],
  );

  // ── Result states ──────────────────────────────────────────────
  if (phase === 'success' || phase === 'queued') {
    const hasStreak = phase === 'success' && streak != null && streak > 0;
    return (
      <Screen padded={false} edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center overflow-hidden px-md">
          <Animated.View
            className="items-center"
            style={{ opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }}
          >
          {hasStreak ? (
            <ProgressRing
              progress={Math.min(streak as number, 7) / 7}
              size={132}
              strokeWidth={11}
              color={theme.cyan}
            >
              <View className="items-center">
                <Txt variant="display-lg" weight="600" className="text-ink">
                  {streak}
                </Txt>
                <Txt variant="caption" className="text-mute">
                  {streak === 1 ? 'DAY' : 'DAYS'}
                </Txt>
              </View>
            </ProgressRing>
          ) : (
            <View className="h-[88px] w-[88px] items-center justify-center rounded-full bg-primary">
              <Icon name="check" color={theme.onPrimary} size={44} />
            </View>
          )}
          {phase === 'success' && isMilestone ? (
            <View className="mt-md rounded-full bg-primary px-md py-xs">
              <Txt variant="caption" weight="600" className="text-onPrimary">
                {`${streak}-DAY MILESTONE 🔥`}
              </Txt>
            </View>
          ) : null}
          <Txt variant="display-lg" weight="600" className="mt-lg text-center text-ink">
            {phase === 'success' ? "You're in." : 'Saved offline'}
          </Txt>
          <Txt variant="body-md" className="mt-xs text-center text-body">
            {phase === 'success'
              ? hasStreak
                ? 'Streak extended. Keep it going.'
                : 'Have a great session.'
              : "We'll log this the moment you're back online."}
          </Txt>
          </Animated.View>
          <View className="absolute inset-x-lg bottom-2xl">
            <Button title="Done" fullWidth onPress={close} />
          </View>
        </View>
      </Screen>
    );
  }

  if (phase === 'error') {
    return (
      <Screen edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center">
          <View className="h-[72px] w-[72px] items-center justify-center rounded-full bg-error-soft">
            <Icon name="qr" color={theme.error} size={36} />
          </View>
          <Txt variant="display-sm" weight="600" className="mt-lg text-center text-ink">
            Check-in failed
          </Txt>
          <Txt variant="body-md" className="mt-xs px-md text-center text-body">
            {errorMsg}
          </Txt>
          <View className="mt-xl w-full gap-sm px-md">
            <Button
              title="Try again"
              fullWidth
              onPress={() => {
                setErrorMsg(null);
                setPhase('scan');
              }}
            />
            <Button title="Close" variant="ghost" fullWidth onPress={close} />
          </View>
        </View>
      </Screen>
    );
  }

  // Permission status still resolving — show a neutral canvas rather than
  // flashing the "Enable camera" gate before we know it's already granted.
  if (!permission) {
    return <Screen edges={['top', 'bottom']}><View className="flex-1" /></Screen>;
  }

  // ── Permission gate ─────────────────────────────────────────────
  if (!permission.granted) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center px-md">
          <Icon name="camera" color={theme.body} size={48} />
          <Txt variant="display-sm" weight="600" className="mt-lg text-center text-ink">
            Scan to check in
          </Txt>
          <Txt variant="body-md" className="mt-xs text-center text-body">
            {'MuscleX needs the camera to read your gym’s QR code.'}
          </Txt>
          <View className="mt-xl w-full gap-sm">
            <Button title="Enable camera" fullWidth onPress={requestPermission} />
            <Button
              title="Check in manually"
              variant="secondary"
              fullWidth
              onPress={() => handle(undefined)}
            />
            <Button title="Cancel" variant="ghost" fullWidth onPress={close} />
          </View>
        </View>
      </Screen>
    );
  }

  // ── Scanner ─────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={phase === 'scan' ? ({ data }) => handle(data) : undefined}
      />

      {/* Reticle overlay — corner brackets + animated scan line. */}
      <View className="absolute inset-0 items-center justify-center" pointerEvents="box-none">
        <View style={{ width: SCAN, height: SCAN }}>
          <Bracket style={{ top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 }} />
          <Bracket style={{ top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 }} />
          <Bracket style={{ bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 }} />
          <Bracket style={{ bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 }} />
          {phase === 'scan' ? (
            <Animated.View
              style={{
                position: 'absolute',
                left: 12,
                right: 12,
                top: 8,
                height: 2,
                borderRadius: 1,
                backgroundColor: theme.cyan,
                transform: [{ translateY: scanY }],
              }}
            />
          ) : null}
        </View>
        <Txt variant="body-md" className="mt-lg text-center text-ink">
          {phase === 'submitting' ? 'Checking you in…' : 'Point at the gym QR code'}
        </Txt>
      </View>

      {/* Close */}
      <Pressable
        onPress={close}
        hitSlop={12}
        accessibilityLabel="Close"
        style={{ position: 'absolute', top: insets.top + 8, left: 20 }}
        className="h-[40px] w-[40px] items-center justify-center rounded-full bg-black/50"
      >
        <Txt variant="body-lg" className="text-ink">
          {'×'}
        </Txt>
      </Pressable>

      {/* Torch */}
      <Pressable
        onPress={() => setTorch((t) => !t)}
        hitSlop={12}
        accessibilityLabel={torch ? 'Turn torch off' : 'Turn torch on'}
        style={{ position: 'absolute', top: insets.top + 8, right: 20 }}
        className="h-[40px] w-[40px] items-center justify-center rounded-full bg-black/50"
      >
        <Icon name="flash" color={torch ? theme.cyan : theme.ink} size={20} />
      </Pressable>

      <View style={{ position: 'absolute', bottom: insets.bottom + 24, left: 20, right: 20 }}>
        <Button
          title="Check in manually"
          variant="secondary"
          fullWidth
          onPress={() => handle(undefined)}
        />
      </View>
    </View>
  );
}

/** One corner bracket of the scan reticle. */
function Bracket({ style }: { style: object }) {
  const theme = useThemeColors();
  return (
    <View
      style={[
        { position: 'absolute', width: 28, height: 28, borderColor: theme.ink },
        style,
      ]}
    />
  );
}
