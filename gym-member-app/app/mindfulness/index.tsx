import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  Button,
  Card,
  Screen,
  SegmentedControl,
  Txt,
  health,
} from '../../src/design-system';
import { BackButton } from '../../src/navigation/BackButton';
import { useHaptics } from '../../src/lib/use-haptics';

/**
 * Guided 4-7-8 breathing — inhale 4s, hold 7s, exhale 8s (a 19s cycle). The
 * circle expands on the inhale, holds, and contracts on the exhale; the phase
 * label is the accessible cue (the animation is decorative).
 *
 * Ephemeral by design: there is no `mindfulness_session` ingest path in the BFF,
 * so nothing is persisted (per the build brief — do NOT add an endpoint). The
 * session just ends in a "well done" state. Built on installed reanimated — no
 * new deps, no audio.
 */
const PHASES = [
  { name: 'inhale' as const, label: 'Breathe in', seconds: 4, scale: 1 },
  { name: 'hold' as const, label: 'Hold', seconds: 7, scale: 1 },
  { name: 'exhale' as const, label: 'Breathe out', seconds: 8, scale: 0.55 },
];

type Status = 'idle' | 'running' | 'done';
const PRESETS = [1, 3, 5] as const;

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MindfulnessScreen() {
  const haptic = useHaptics();
  const [minutes, setMinutes] = useState<(typeof PRESETS)[number]>(3);
  const [status, setStatus] = useState<Status>('idle');
  const [remaining, setRemaining] = useState(0);
  const [phaseLabel, setPhaseLabel] = useState('Get ready');

  const scale = useSharedValue(0.55);
  const phaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseIdx = useRef(0);

  const clearTimers = () => {
    if (phaseTimer.current) clearTimeout(phaseTimer.current);
    if (tick.current) clearInterval(tick.current);
    phaseTimer.current = null;
    tick.current = null;
  };

  // Advance to the next breathing phase and animate the circle accordingly.
  const runPhase = (idx: number) => {
    const phase = PHASES[idx % PHASES.length];
    setPhaseLabel(phase.label);
    haptic.tap();
    scale.value = withTiming(phase.scale, {
      duration: phase.seconds * 1000,
      easing: Easing.inOut(Easing.ease),
    });
    phaseTimer.current = setTimeout(() => runPhase(idx + 1), phase.seconds * 1000);
  };

  const finish = (completed: boolean) => {
    clearTimers();
    cancelAnimation(scale);
    scale.value = withTiming(0.55, { duration: 600 });
    if (completed) {
      setStatus('done');
      setPhaseLabel('Well done');
      haptic.success();
    } else {
      setStatus('idle');
      setPhaseLabel('Get ready');
    }
  };

  const start = () => {
    clearTimers();
    phaseIdx.current = 0;
    setRemaining(minutes * 60);
    setStatus('running');
    runPhase(0);
    tick.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          finish(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  };

  // Stop everything on unmount so timers/animation never outlive the screen.
  useEffect(() => () => {
    clearTimers();
    cancelAnimation(scale);
  }, [scale]);

  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Screen padded edges={['top', 'bottom']}>
      <BackButton />
      <View className="flex-1 items-center justify-between py-md">
        <View className="items-center">
          <Txt variant="display-md" weight="600" className="text-ink">
            Breathe
          </Txt>
          <Txt variant="body-sm" className="mt-xs text-mute">
            4-7-8 — in for 4, hold for 7, out for 8
          </Txt>
        </View>

        {/* Breathing circle (decorative) + the spoken phase cue. */}
        <View className="items-center justify-center" style={{ height: 280 }}>
          <View
            className="absolute items-center justify-center"
            style={{ width: 240, height: 240 }}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Animated.View
              style={[
                {
                  width: 240,
                  height: 240,
                  borderRadius: 120,
                  backgroundColor: health.mind + '22',
                  borderWidth: 2,
                  borderColor: health.mind,
                },
                circleStyle,
              ]}
            />
          </View>
          <Txt
            variant="display-sm"
            weight="600"
            className="text-ink"
            accessibilityLiveRegion="polite"
          >
            {phaseLabel}
          </Txt>
          {status === 'running' ? (
            <Txt variant="mono" className="mt-sm text-mute">
              {mmss(remaining)}
            </Txt>
          ) : null}
        </View>

        <View className="w-full">
          {status === 'done' ? (
            <Card elevated className="mb-md">
              <Txt variant="body-md" weight="600" className="text-center text-ink">
                Session complete 🌿
              </Txt>
              <Txt variant="body-sm" className="mt-xs text-center text-mute">
                Take that calm with you.
              </Txt>
            </Card>
          ) : (
            <View className="mb-md">
              <Txt variant="caption" className="mb-sm text-mute">
                SESSION LENGTH
              </Txt>
              <SegmentedControl<string>
                options={PRESETS.map((m) => ({ label: `${m} min`, value: String(m) }))}
                value={String(minutes)}
                onChange={(v) => setMinutes(Number(v) as (typeof PRESETS)[number])}
              />
            </View>
          )}

          {status === 'running' ? (
            <Button title="Stop" variant="ghost" fullWidth onPress={() => finish(false)} />
          ) : (
            <Button
              title={status === 'done' ? 'Go again' : 'Start'}
              fullWidth
              onPress={start}
            />
          )}
        </View>
      </View>
    </Screen>
  );
}
