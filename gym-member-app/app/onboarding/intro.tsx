import { useRef, useState, type ReactElement } from 'react';
import { FlatList, useWindowDimensions, View } from 'react-native';
import type { ListRenderItemInfo, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Button, MeshGradient, Screen, Txt, health } from '../../src/design-system';
import { usePrefs } from '../../src/auth/prefs-store';
import { useHaptics } from '../../src/lib/use-haptics';
import { track } from '../../src/analytics';

/**
 * First-run intro — three swipeable value-prop pages with inline SVG art (no
 * asset imports, no pager-view dep; a snap `FlatList` does the paging). Gated by
 * the `introSeen` pref via {@link AuthGate}: it shows once, before the goal step.
 *
 * The wearable-connect deep-link is intentionally deferred — connecting needs the
 * native build (gate G3) and, mid-onboarding, the auth gate routes to the goal
 * step next. So the single CTA advances onboarding; connecting happens later from
 * the Health screen, and goals from the Home rings hero.
 */
type Page = { key: string; title: string; body: string; art: () => ReactElement };

const TrainingArt = () => (
  <Svg width={160} height={160} viewBox="0 0 160 160" fill="none">
    <Rect x={20} y={92} width={20} height={48} rx={4} fill={health.activity} opacity={0.9} />
    <Rect x={52} y={68} width={20} height={72} rx={4} fill={health.activity} opacity={0.6} />
    <Rect x={84} y={80} width={20} height={60} rx={4} fill={health.activity} opacity={0.75} />
    <Rect x={116} y={48} width={20} height={92} rx={4} fill={health.activity} />
    <Path d="M22 70 L62 50 L94 60 L134 30" stroke={health.mind} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const WearableArt = () => (
  <Svg width={160} height={160} viewBox="0 0 160 160" fill="none">
    <Rect x={56} y={20} width={48} height={26} rx={8} fill={health.heart} opacity={0.5} />
    <Rect x={56} y={114} width={48} height={26} rx={8} fill={health.heart} opacity={0.5} />
    <Rect x={46} y={42} width={68} height={76} rx={18} fill="#1F1F1F" stroke={health.heart} strokeWidth={3} />
    <Path d="M62 82 l10 0 l6 -14 l8 26 l6 -12 l8 0" stroke={health.heart} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const GoalsArt = () => (
  <Svg width={160} height={160} viewBox="0 0 160 160" fill="none">
    <Circle cx={80} cy={80} r={58} stroke="#1F1F1F" strokeWidth={12} />
    <Circle cx={80} cy={80} r={42} stroke="#1F1F1F" strokeWidth={12} />
    <Circle cx={80} cy={80} r={26} stroke="#1F1F1F" strokeWidth={12} />
    <Path d="M80 22 a58 58 0 0 1 50 29" stroke={health.activity} strokeWidth={12} strokeLinecap="round" />
    <Path d="M80 38 a42 42 0 0 1 36 21" stroke={health.body} strokeWidth={12} strokeLinecap="round" />
    <Path d="M80 54 a26 26 0 0 1 22 13" stroke={health.mind} strokeWidth={12} strokeLinecap="round" />
  </Svg>
);

const PAGES: Page[] = [
  {
    key: 'data',
    title: 'Your training, your data',
    body: 'Every check-in, workout and meal in one place — real numbers, never guesses.',
    art: TrainingArt,
  },
  {
    key: 'wearable',
    title: 'Connect a wearable',
    body: 'Bring in steps, heart rate and sleep from Apple Health or Health Connect for the full picture.',
    art: WearableArt,
  },
  {
    key: 'goals',
    title: 'Set your goals',
    body: 'Pick daily targets and watch your activity rings close. You can tune them anytime.',
    art: GoalsArt,
  },
];

export default function OnboardingIntro() {
  const router = useRouter();
  const haptic = useHaptics();
  const { width } = useWindowDimensions();
  const setIntroSeen = usePrefs((s) => s.setIntroSeen);
  const listRef = useRef<FlatList<Page>>(null);
  const [index, setIndex] = useState(0);

  const isLast = index === PAGES.length - 1;

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) {
      haptic.select();
      setIndex(next);
    }
  };

  const onPrimary = async () => {
    if (!isLast) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
      return;
    }
    haptic.success();
    track({ name: 'onboarding_intro_completed' });
    await setIntroSeen(true);
    // The auth gate routes !onboarded members to the goal step next.
    router.replace('/goal');
  };

  const onSkip = async () => {
    await setIntroSeen(true);
    router.replace('/goal');
  };

  const renderItem = ({ item }: ListRenderItemInfo<Page>) => (
    <View style={{ width }} className="items-center justify-center px-xl">
      <View className="mb-2xl items-center justify-center" style={{ height: 200 }}>
        <item.art />
      </View>
      <Txt variant="display-lg" weight="600" className="text-center text-ink" accessibilityRole="header">
        {item.title}
      </Txt>
      <Txt variant="body-md" className="mt-md text-center text-body">
        {item.body}
      </Txt>
    </View>
  );

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <View className="absolute inset-x-0 top-0 h-1/2">
        <MeshGradient opacity={0.35} />
      </View>

      {/* Skip — always reachable, top-right. */}
      <View className="flex-row justify-end px-md pt-xs">
        <Button title="Skip" variant="ghost" size="sm" onPress={onSkip} />
      </View>

      <View className="flex-1 justify-center">
        <FlatList
          ref={listRef}
          data={PAGES}
          keyExtractor={(p) => p.key}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        />
      </View>

      {/* Progress dots */}
      <View className="mb-lg flex-row items-center justify-center gap-xs">
        {PAGES.map((p, i) => (
          <View
            key={p.key}
            className="h-[8px] rounded-full"
            style={{
              width: i === index ? 22 : 8,
              backgroundColor: i === index ? health.activity : '#2A2A2A',
            }}
          />
        ))}
      </View>

      <View className="px-md pb-md">
        <Button
          title={isLast ? 'Get started' : 'Next'}
          fullWidth
          onPress={onPrimary}
        />
      </View>
    </Screen>
  );
}
