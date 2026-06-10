import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Icon, Input, Screen, Txt, useThemeColors, type IconName } from '../../src/design-system';
import { useCapabilities } from '../../src/auth/use-capabilities';

/**
 * Search / Discover tab. The query box routes into the Exercise library (the app's
 * primary searchable catalog); below it, category tiles open the screens where the
 * real per-domain search/filter lives. Gym-only tiles hide for gym-less PUBLIC
 * users (the routes are 403-guarded server-side regardless).
 */
interface Tile {
  label: string;
  sub: string;
  icon: IconName;
  route: string;
  gymOnly?: boolean;
}

const TILES: Tile[] = [
  { label: 'Exercises', sub: 'Form cues for every lift', icon: 'activity', route: '/exercises' },
  { label: 'Classes', sub: 'Book a spot', icon: 'calendar', route: '/classes', gymOnly: true },
  { label: 'Workouts', sub: 'Your training plan', icon: 'dumbbell', route: '/workout', gymOnly: true },
  { label: 'Nutrition', sub: 'Meals, macros & water', icon: 'flame', route: '/nutrition' },
  { label: 'Community', sub: 'Leaderboard & challenges', icon: 'users', route: '/community', gymOnly: true },
  { label: 'Find gyms', sub: 'Near you', icon: 'pin', route: '/gyms' },
];

export default function SearchScreen() {
  const router = useRouter();
  const theme = useThemeColors();
  const { isMember } = useCapabilities();
  const [q, setQ] = useState('');

  const tiles = TILES.filter((t) => isMember || !t.gymOnly);

  return (
    <Screen scroll>
      <Txt variant="display-md" weight="600" className="mb-md mt-xs text-ink">
        Search
      </Txt>

      <Input
        placeholder="Search exercises…"
        value={q}
        onChangeText={setQ}
        returnKeyType="search"
        onSubmitEditing={() => router.push('/exercises')}
      />

      <Txt variant="caption" className="mb-sm mt-lg text-mute">
        DISCOVER
      </Txt>
      <View className="flex-row flex-wrap justify-between">
        {tiles.map((t) => (
          <Pressable
            key={t.route}
            onPress={() => router.push(t.route as never)}
            accessibilityLabel={t.label}
            className="mb-md w-[48%]"
          >
            <Card className="h-[120px] justify-between">
              <View
                className="h-[40px] w-[40px] items-center justify-center rounded-full"
                style={{ backgroundColor: theme.primary + '1F' }}
              >
                <Icon name={t.icon} color={theme.accent} size={20} />
              </View>
              <View>
                <Txt variant="body-md" weight="600" className="text-ink" numberOfLines={1}>
                  {t.label}
                </Txt>
                <Txt variant="caption" className="text-mute" numberOfLines={1}>
                  {t.sub}
                </Txt>
              </View>
            </Card>
          </Pressable>
        ))}
      </View>

      <View className="h-2xl" />
    </Screen>
  );
}
