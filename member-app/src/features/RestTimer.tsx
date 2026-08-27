import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Button, Txt } from '../ui';
import { color, radius, space } from '../ui/theme';

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
    <View style={[st.wrap, bottomOffset ? { bottom: space.lg + bottomOffset } : null]}>
      <View>
        <Txt variant="caption" tone="t3" style={{ letterSpacing: 1, textTransform: 'uppercase' }}>
          Rest
        </Txt>
        <Txt variant="title" style={{ marginTop: 2 }}>
          {mm}:{ss}
        </Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button title="+30s" variant="secondary" size="sm" onPress={() => setExtra((e) => e + 30)} />
        <Button title="Skip" variant="secondary" size="sm" onPress={() => setExtra(-99999)} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    bottom: space.lg,
    backgroundColor: color.surface2,
    borderColor: color.line,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.md,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
