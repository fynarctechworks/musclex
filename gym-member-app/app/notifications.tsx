import { useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { Card, ListRow, Screen, Txt, colors } from '../src/design-system';
import { BackButton } from '../src/navigation/BackButton';
import { usePrefs } from '../src/auth/prefs-store';
import {
  enablePush,
  disablePush,
  syncPushPrefs,
  NOTIFICATION_CATEGORIES,
  defaultNotificationPrefs,
} from '../src/features/notifications/push';

export default function NotificationsScreen() {
  const pushEnabled = usePrefs((s) => s.pushEnabled);
  const notificationPrefs = usePrefs((s) => s.notificationPrefs);
  const setPush = usePrefs((s) => s.setPush);
  const [busy, setBusy] = useState(false);

  // Effective prefs: stored, or all-on the first time.
  const prefs =
    Object.keys(notificationPrefs).length > 0 ? notificationPrefs : defaultNotificationPrefs();

  async function onToggleMaster(value: boolean) {
    setBusy(true);
    try {
      if (value) {
        const res = await enablePush(prefs);
        if (res === 'granted') {
          await setPush(true, prefs);
        } else if (res === 'denied') {
          Alert.alert('Permission needed', 'Enable notifications in your device settings.');
        } else {
          Alert.alert('Could not enable', 'Please try again.');
        }
      } else {
        await disablePush();
        await setPush(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onToggleCategory(key: string, value: boolean) {
    const next = { ...prefs, [key]: value };
    await setPush(true, next);
    await syncPushPrefs(next);
  }

  return (
    <Screen scroll>
      <View className="pt-md">
        <BackButton />
        <Txt variant="display-lg" weight="600" className="text-ink">
          Notifications
        </Txt>

        <Card elevated className="mt-md">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-md">
              <Txt variant="body-lg" weight="600" className="text-ink">
                Push notifications
              </Txt>
              <Txt variant="body-sm" className="mt-xxs text-body">
                Reminders for classes, meals, streaks, trainer messages and more.
              </Txt>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={onToggleMaster}
              disabled={busy}
              trackColor={{ true: colors.primary, false: colors.surface2 }}
            />
          </View>
        </Card>

        {pushEnabled ? (
          <>
            <Txt variant="caption" className="mb-sm mt-lg text-mute">
              WHAT TO NOTIFY ME ABOUT
            </Txt>
            <Card noPadding>
              {NOTIFICATION_CATEGORIES.map((c, i) => (
                <ListRow
                  key={c.key}
                  label={c.label}
                  last={i === NOTIFICATION_CATEGORIES.length - 1}
                  right={
                    <Switch
                      value={prefs[c.key] !== false}
                      onValueChange={(v) => onToggleCategory(c.key, v)}
                      trackColor={{ true: colors.primary, false: colors.surface2 }}
                    />
                  }
                />
              ))}
            </Card>
          </>
        ) : null}

        <Txt variant="body-sm" className="mt-2xl text-center text-mute">
          {pushEnabled
            ? "You're all set — we'll only send what you've turned on."
            : 'Turn on push to get timely nudges that keep your streak alive.'}
        </Txt>
      </View>
    </Screen>
  );
}
