import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Button, Txt } from '../ui';

/**
 * Rest timer. Ambient by design: it pins above the tab bar, keeps counting
 * while the member scrolls or edits other sets, and buzzes once at zero. It is
 * never a modal — resting is not a state that should block logging.
 *
 * Time is derived from `startedAt` rather than decremented, so it stays correct
 * if the JS thread stalls or the app is backgrounded mid-rest.
 */
export function RestTimer({
  startedAt,
  seconds,
  bottomOffset = 0,
}: {
  startedAt: number | null;
  seconds: number;
  /** Lifts the timer clear of a fixed action bar. Without it the two overlap. */
  bottomOffset?: number;
}) {
  const [left, setLeft] = useState(0);
  const [extra, setExtra] = useState(0);
  const buzzed = useRef(false);

  useEffect(() => {
    if (!startedAt) return;
    setExtra(0);
    buzzed.current = false;
  }, [startedAt]);

  useEffect(() => {
    if (!startedAt) return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = seconds + extra - elapsed;
      setLeft(remaining);
      if (remaining <= 0 && !buzzed.current) {
        buzzed.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [startedAt, seconds, extra]);

  if (!startedAt || left <= 0) return null;

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');

  return (
    <View
      // Position stays inline: `bottom` is computed from the caller's action
      // bar, so it cannot be a static class.
      style={{ position: 'absolute', left: 12, right: 12, bottom: 16 + bottomOffset }}
      className="border-border bg-card flex-row items-center justify-between rounded-lg border px-4 py-3 shadow-sm shadow-black/5">
      <View>
        <Txt variant="label" tone="t3">
          Rest
        </Txt>
        {/* tabular-nums so the row does not jitter as the digits change. */}
        <Txt variant="title" className="mt-0.5 tabular-nums">
          {mm}:{ss}
        </Txt>
      </View>
      <View className="flex-row gap-2">
        <Button title="+30s" variant="secondary" size="sm" onPress={() => setExtra((e) => e + 30)} />
        <Button title="Skip" variant="secondary" size="sm" onPress={() => setExtra(-99999)} />
      </View>
    </View>
  );
}
