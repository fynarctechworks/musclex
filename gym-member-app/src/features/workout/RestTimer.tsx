import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Card, Txt, useThemeColors } from '../../design-system';

const PRESETS = [60, 90, 120];

/** Between-sets rest timer with a haptic buzz on completion (PRD §6.4). */
export function RestTimer() {
  const theme = useThemeColors();
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Depend only on `running` so the interval is created once per run, not
  // re-created every tick. The updater stops the run when it reaches zero.
  useEffect(() => {
    if (!running) return;
    interval.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (interval.current) clearInterval(interval.current);
    };
  }, [running]);

  const start = (s: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRemaining(s);
    setRunning(true);
  };

  const mm = String(Math.floor(remaining / 60)).padStart(1, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <Card soft>
      <View className="flex-row items-center justify-between">
        <View>
          <Txt variant="caption" className="text-mute">
            REST TIMER
          </Txt>
          <Txt variant="display-md" weight="600" className="text-ink">
            {running || remaining > 0 ? `${mm}:${ss}` : '—'}
          </Txt>
        </View>
        <View className="flex-row gap-xs">
          {PRESETS.map((s) => (
            <Pressable
              key={s}
              onPress={() => start(s)}
              accessibilityRole="button"
              accessibilityLabel={`Start ${s} second rest timer`}
              className="rounded-full px-md py-xs"
              style={{ backgroundColor: theme.surface2 }}
            >
              <Txt variant="body-sm" weight="500" className="text-ink">
                {s}s
              </Txt>
            </Pressable>
          ))}
          {running ? (
            <Pressable
              onPress={() => {
                setRunning(false);
                setRemaining(0);
              }}
              accessibilityRole="button"
              accessibilityLabel="Stop rest timer"
              className="rounded-full px-md py-xs"
              style={{ backgroundColor: theme.errorSoft }}
            >
              <Txt variant="body-sm" weight="500" className="text-error">
                Stop
              </Txt>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Card>
  );
}
