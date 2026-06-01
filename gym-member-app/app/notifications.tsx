import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Icon, Screen, Txt, colors } from '../src/design-system';
import { enablePush } from '../src/features/notifications/push';

export default function NotificationsScreen() {
  const router = useRouter();
  const [enabling, setEnabling] = useState(false);
  const [enabled, setEnabled] = useState(false);

  async function onEnable() {
    setEnabling(true);
    const result = await enablePush();
    setEnabling(false);
    if (result === 'granted') {
      setEnabled(true);
    } else if (result === 'denied') {
      Alert.alert('Permission needed', 'Enable notifications in your device settings.');
    } else {
      Alert.alert('Could not enable', 'Please try again.');
    }
  }

  return (
    <Screen scroll>
      <View className="pt-md">
        <Pressable onPress={() => router.back()} hitSlop={12} className="mb-lg">
          <Txt variant="body-sm" className="text-body">{'←  Back'}</Txt>
        </Pressable>
        <Txt variant="display-lg" weight="600" className="text-ink">
          Notifications
        </Txt>

        {!enabled ? (
          <Card elevated className="mt-md">
            <Txt variant="body-lg" weight="600" className="text-ink">
              Stay in the loop
            </Txt>
            <Txt variant="body-sm" className="mt-xs text-body">
              Get reminders for class bookings, membership expiry, streak nudges
              and trainer messages.
            </Txt>
            <View className="mt-md">
              <Button title="Enable push notifications" loading={enabling} onPress={onEnable} />
            </View>
          </Card>
        ) : (
          <Card soft className="mt-md">
            <View className="flex-row items-center gap-sm">
              <Icon name="check" color={colors.successFg} size={20} />
              <Txt variant="body-md" weight="500" className="text-ink">
                Push notifications enabled
              </Txt>
            </View>
          </Card>
        )}

        {/* Empty feed — Phase 1 has no in-app notification history yet. */}
        <View className="mt-2xl items-center py-2xl">
          <View className="h-[64px] w-[64px] items-center justify-center rounded-full bg-surface">
            <Icon name="bell" color={colors.mute} size={28} />
          </View>
          <Txt variant="body-md" weight="500" className="mt-md text-ink">
            {'You’re all caught up'}
          </Txt>
          <Txt variant="body-sm" className="mt-xxs text-center text-mute">
            New alerts will show up here.
          </Txt>
        </View>
      </View>
    </Screen>
  );
}
