import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Avatar, Card, Icon, Screen, Txt, useThemeColors, type IconName } from '../../src/design-system';
import { useAuth } from '../../src/auth/auth-store';
import { useCapabilities } from '../../src/auth/use-capabilities';

/**
 * Menu tab — the IA hub. With the bottom bar pared back to Home · Progress ·
 * Rewards · Menu (+ the centre check-in FAB), this grid keeps every feature one
 * tap away. Gym-only tiles are hidden for gym-less PUBLIC users (the routes are
 * 403-guarded server-side regardless).
 */
interface Tile {
  label: string;
  icon: IconName;
  route: string;
  gymOnly?: boolean;
}

const TILES: Tile[] = [
  { label: 'Workout', icon: 'dumbbell', route: '/workout', gymOnly: true },
  { label: 'Classes', icon: 'calendar', route: '/classes', gymOnly: true },
  { label: 'Exercises', icon: 'activity', route: '/exercises' },
  { label: 'Nutrition', icon: 'flame', route: '/nutrition' },
  { label: 'Statistics', icon: 'chart', route: '/statistic' },
  { label: 'Activity', icon: 'footsteps', route: '/activity' },
  { label: 'Community', icon: 'users', route: '/community', gymOnly: true },
  { label: 'Trainer Chat', icon: 'users', route: '/messages', gymOnly: true },
  { label: 'Membership', icon: 'qr', route: '/membership', gymOnly: true },
  { label: 'Locations', icon: 'pin', route: '/locations' },
  { label: 'Mindfulness', icon: 'heart', route: '/mindfulness' },
  { label: 'Tools', icon: 'grid', route: '/tools' },
];

export default function MenuScreen() {
  const router = useRouter();
  const theme = useThemeColors();
  const profileName = useAuth((s) => s.profile?.name);
  const { isMember } = useCapabilities();

  const tiles = TILES.filter((t) => isMember || !t.gymOnly);

  return (
    <Screen scroll padded={false}>
      {/* Account header */}
      <Pressable
        onPress={() => router.push('/profile')}
        accessibilityLabel="Profile"
        className="mx-md mb-md mt-xs flex-row items-center gap-md"
      >
        <Avatar name={profileName} size={52} />
        <View className="flex-1">
          <Txt variant="body-lg" weight="600" className="text-ink">
            {profileName ?? 'Your account'}
          </Txt>
          <Txt variant="body-sm" className="text-mute">
            View & edit profile
          </Txt>
        </View>
        <Icon name="chevron-right" color={theme.mute} size={20} />
      </Pressable>

      <View className="px-md">
        <Txt variant="caption" className="mb-sm text-mute">
          ALL FEATURES
        </Txt>
        <View className="flex-row flex-wrap justify-between">
          {tiles.map((t) => (
            <Pressable
              key={t.route}
              onPress={() => router.push(t.route as never)}
              accessibilityLabel={t.label}
              className="mb-md w-[31%]"
            >
              <Card className="items-center py-lg">
                <View
                  className="h-[46px] w-[46px] items-center justify-center rounded-full"
                  style={{ backgroundColor: theme.primary + '1F' }}
                >
                  <Icon name={t.icon} color={theme.accent} size={22} />
                </View>
                <Txt variant="body-sm" weight="500" className="mt-sm text-center text-ink" numberOfLines={1}>
                  {t.label}
                </Txt>
              </Card>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => router.push('/notifications')}
          className="mt-xs"
          accessibilityLabel="Notifications"
        >
          <Card className="flex-row items-center">
            <Icon name="bell" color={theme.body} size={20} />
            <Txt variant="body-md" weight="500" className="ml-md flex-1 text-ink">
              Notifications
            </Txt>
            <Icon name="chevron-right" color={theme.mute} size={18} />
          </Card>
        </Pressable>

        <View className="h-2xl" />
      </View>
    </Screen>
  );
}
