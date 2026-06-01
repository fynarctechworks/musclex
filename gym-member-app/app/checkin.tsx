import { useCallback, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Icon,
  MeshGradient,
  Screen,
  Txt,
  colors,
} from '../src/design-system';
import { submitCheckIn } from '../src/features/checkin/submit';
import { MemberApiError } from '../src/api/client';
import { qk } from '../src/api/queries';

type Phase = 'scan' | 'submitting' | 'success' | 'queued' | 'error';

export default function CheckInScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('scan');
  const [streak, setStreak] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const locked = useRef(false);

  const close = () => router.back();

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
          err instanceof MemberApiError
            ? err.message
            : 'Could not check you in. Try again.',
        );
        setPhase('error');
        locked.current = false;
      }
    },
    [qc],
  );

  // ── Result states ──────────────────────────────────────────────
  if (phase === 'success' || phase === 'queued') {
    return (
      <Screen padded={false} edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center overflow-hidden px-lg">
          <MeshGradient opacity={0.6} />
          <View className="h-[88px] w-[88px] items-center justify-center rounded-full bg-primary">
            <Icon name="check" color={colors.onPrimary} size={44} />
          </View>
          <Txt variant="display-lg" weight="600" className="mt-lg text-center text-ink">
            {phase === 'success' ? "You're in." : 'Saved offline'}
          </Txt>
          <Txt variant="body-md" className="mt-xs text-center text-body">
            {phase === 'success'
              ? streak && streak > 0
                ? `${streak}-day streak. Keep it going.`
                : 'Have a great session.'
              : "We'll log this the moment you're back online."}
          </Txt>
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
            <Icon name="qr" color={colors.error} size={36} />
          </View>
          <Txt variant="display-sm" weight="600" className="mt-lg text-center text-ink">
            Check-in failed
          </Txt>
          <Txt variant="body-md" className="mt-xs px-lg text-center text-body">
            {errorMsg}
          </Txt>
          <View className="mt-xl w-full gap-sm px-lg">
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

  // ── Permission gate ─────────────────────────────────────────────
  if (!permission?.granted) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center px-lg">
          <Icon name="camera" color={colors.body} size={48} />
          <Txt variant="display-sm" weight="600" className="mt-lg text-center text-ink">
            Scan to check in
          </Txt>
          <Txt variant="body-md" className="mt-xs text-center text-body">
            {'FitSync needs the camera to read your gym’s QR code.'}
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
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={
          phase === 'scan' ? ({ data }) => handle(data) : undefined
        }
      />
      {/* Overlay */}
      <View className="absolute inset-0 items-center justify-center" pointerEvents="box-none">
        <View
          style={{
            width: 240,
            height: 240,
            borderRadius: 24,
            borderWidth: 2,
            borderColor: colors.ink,
          }}
        />
        <Txt variant="body-md" className="mt-lg text-center text-ink">
          {phase === 'submitting' ? 'Checking you in…' : 'Point at the gym QR code'}
        </Txt>
      </View>

      <Pressable
        onPress={close}
        hitSlop={12}
        style={{ position: 'absolute', top: 56, left: 20 }}
        className="h-[40px] w-[40px] items-center justify-center rounded-full bg-black/50"
      >
        <Txt variant="body-lg" className="text-ink">{'×'}</Txt>
      </Pressable>

      <View style={{ position: 'absolute', bottom: 48, left: 20, right: 20 }}>
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
