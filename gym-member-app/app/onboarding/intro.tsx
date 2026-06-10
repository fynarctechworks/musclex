import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  FlatList,
  Image,
  type ImageSourcePropType,
  PanResponder,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import type { ListRenderItemInfo, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors, Logo, ProgressRing, Screen, Stepper, Txt } from '../../src/design-system';
import { PHOTOS } from '../../src/assets/photos';
import { usePrefs } from '../../src/auth/prefs-store';
import { useHaptics } from '../../src/lib/use-haptics';
import { track } from '../../src/analytics';

/**
 * First-run intro — a 3-page swipeable onboarding modelled on the supplied
 * reference design (Nutrilens). Reference green accent + light surfaces; MuscleX
 * wordmark top-left. Hero photography is represented by clearly-marked IMAGE SLOTS
 * ({@link ImageSlot}) — drop real art in later (see assets/brand/README.md).
 *
 * Routing is unchanged from the previous intro: Skip / final "Get Started" mark
 * the intro seen and hand back to the auth gate, which routes to the goal step.
 */

// ── Brand greens now derive from the design-system primary (lime) so onboarding
//    tracks any future primary change instead of drifting on its own hexes. ──
const GREEN = colors.primary; // lime — arrow circle, progress, highlights
const GREEN_RING = colors.accent; // darker lime — ring stroke + small dots
const GREEN_CARD = colors.accentSoft; // soft lime stat-card surface
const DARK = '#181A17'; // CTA pill / selected day (neutral, intentional)
const TRACK = '#E6E8EC'; // empty progress / ring track
const MACRO = { protein: '#7FC241', carbs: '#F5A623', fat: '#F2603C' } as const;

// ── Tiny inline glyphs (no icon-name guessing) ──────────────────────────────
const Chevrons = ({ color = DARK, size = 16 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Path d="M3 3 L8 8 L3 13" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M8 3 L13 8 L8 13" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const Check = ({ color = DARK, size = 16 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Path d="M3 8.5 L6.5 12 L13 4" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** Hero image holder — renders a bundled photo, or a marked placeholder if none. */
const ImageSlot = ({
  source,
  children,
  className,
  style,
  label = 'Image slot',
}: {
  source?: ImageSourcePropType;
  children?: ReactNode;
  className?: string;
  style?: object;
  label?: string;
}) => (
  <View
    className={`overflow-hidden bg-canvas-soft ${className ?? ''}`}
    style={[{ borderRadius: 28 }, style]}
  >
    {source ? (
      <Image source={source} resizeMode="cover" style={{ position: 'absolute', width: '100%', height: '100%' }} />
    ) : (
      <View className="flex-1 items-center justify-center">
        <Txt variant="caption" className="text-mute">
          {label}
        </Txt>
      </View>
    )}
    {children}
  </View>
);

const KcalPill = ({ label, style }: { label: string; style?: object }) => (
  <View
    className="absolute flex-row items-center rounded-pill bg-canvas px-sm py-xs"
    style={[{ shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 }, style]}
  >
    <View className="mr-xs h-[8px] w-[8px] rounded-full" style={{ backgroundColor: GREEN_RING }} />
    <Txt variant="body-sm" weight="600" className="text-ink">
      {label}
    </Txt>
  </View>
);

// ── Pages ────────────────────────────────────────────────────────────────────
const Page1 = ({ width }: { width: number }) => (
  <View style={{ width }} className="flex-1 px-md">
    <Txt weight="600" className="text-ink" style={{ fontSize: 42, lineHeight: 46, letterSpacing: -1.4 }}>
      Personal{'\n'}Meals,{'\n'}Your Way,{'\n'}Anytime.
    </Txt>
    <ImageSlot className="mt-lg flex-1" source={PHOTOS.meals}>
      <KcalPill label="150 Kcal" style={{ top: 24, left: 20 }} />
      <KcalPill label="340 Kcal" style={{ top: 24, right: 20 }} />
    </ImageSlot>
  </View>
);

const MacroRow = ({ color, value, label }: { color: string; value: string; label: string }) => (
  <View className="flex-row items-center">
    <View className="mr-xs h-[10px] w-[10px] rounded-sm" style={{ backgroundColor: color }} />
    <Txt variant="body-sm" weight="600" className="text-ink">
      {value}
    </Txt>
    <Txt variant="body-sm" className="ml-xxs text-body">
      {label}
    </Txt>
  </View>
);

const WEEK = [
  { d: 'S', n: 11 },
  { d: 'M', n: 12 },
  { d: 'T', n: 13 },
  { d: 'W', n: 14, active: true },
  { d: 'T', n: 15 },
  { d: 'F', n: 16 },
  { d: 'S', n: 17 },
];

const Page2 = ({ width }: { width: number }) => (
  // Non-scrolling: the intro is meant to fit one screen per page. Content is
  // top-aligned and sized to fit common phone heights (see Page1).
  <View style={{ width }} className="flex-1 px-md pb-md">
    <Txt weight="600" className="mt-md text-ink" style={{ fontSize: 34, lineHeight: 40, letterSpacing: -1.1 }}>
      Daily Tracking To Stay On Track
    </Txt>

    {/* Calendar card */}
    <View className="mt-lg rounded-2xl bg-surface p-md" style={{ borderRadius: 24 }}>
      <View className="mb-md flex-row items-center justify-between">
        <Txt variant="body-md" weight="600" className="text-ink">
          Dec 2025
        </Txt>
        <View className="flex-row gap-xs">
          <View className="h-[28px] w-[28px] items-center justify-center rounded-full bg-canvas-soft">
            <Txt className="text-body">←</Txt>
          </View>
          <View className="h-[28px] w-[28px] items-center justify-center rounded-full bg-canvas-soft">
            <Txt className="text-body">→</Txt>
          </View>
        </View>
      </View>
      <View className="flex-row justify-between">
        {WEEK.map((day, i) => (
          <View key={i} className="items-center" style={{ width: 36 }}>
            <Txt variant="caption" className="mb-xs text-mute">
              {day.d}
            </Txt>
            <View
              className="h-[34px] w-[34px] items-center justify-center rounded-full"
              style={{ backgroundColor: day.active ? DARK : 'transparent' }}
            >
              <Txt variant="body-sm" weight={day.active ? '600' : '400'} style={{ color: day.active ? '#FFFFFF' : undefined }} className={day.active ? '' : 'text-ink'}>
                {day.n}
              </Txt>
            </View>
            {day.active ? <View className="mt-xxs h-[5px] w-[5px] rounded-full" style={{ backgroundColor: GREEN }} /> : null}
          </View>
        ))}
      </View>
    </View>

    {/* Goal / ring card */}
    <View className="mt-md rounded-2xl p-lg" style={{ borderRadius: 24, backgroundColor: GREEN_CARD }}>
      <View className="mb-md flex-row items-center">
        <View className="mr-xs h-[8px] w-[8px] rounded-full" style={{ backgroundColor: GREEN_RING }} />
        <Txt variant="body-sm" weight="600" className="text-ink">
          Goal 1650
        </Txt>
      </View>
      <View className="flex-row items-center justify-between">
        <ProgressRing progress={0.43} size={120} strokeWidth={14} color={GREEN_RING} trackColor="#FFFFFF">
          <View className="items-center">
            <Txt weight="600" className="text-ink" style={{ fontSize: 30 }}>
              670
            </Txt>
            <Txt variant="caption" className="text-body">
              43%
            </Txt>
          </View>
        </ProgressRing>
        <View className="gap-md">
          <MacroRow color={MACRO.protein} value="45/165g" label="Proteins" />
          <MacroRow color={MACRO.carbs} value="78/140g" label="Carbs" />
          <MacroRow color={MACRO.fat} value="15/155g" label="Fats" />
        </View>
      </View>
    </View>
  </View>
);

const MacroBar = ({ color, grams, label }: { color: string; grams: number; label: string }) => {
  // bar width scaled against the largest macro shown (130g) for a quick visual.
  const pct = Math.max(0.12, Math.min(1, grams / 130));
  return (
    <View className="mb-md flex-row items-center">
      <View className="h-[28px] w-[6px] rounded-full" style={{ backgroundColor: color }} />
      <Txt weight="600" className="ml-sm text-ink" style={{ fontSize: 20 }}>
        {grams}
        <Txt variant="body-sm" className="text-body">
          g
        </Txt>
      </Txt>
      <Txt variant="body-sm" className="ml-xs flex-1 text-body">
        {label}
      </Txt>
      <View className="h-[6px] w-[90px] overflow-hidden rounded-full bg-canvas-soft">
        <View className="h-full rounded-full" style={{ width: `${pct * 100}%`, backgroundColor: color }} />
      </View>
    </View>
  );
};

const StatCard = ({
  label,
  value,
  onChange,
  step,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  max: number;
}) => (
  <View className="flex-1 rounded-2xl bg-surface p-md" style={{ borderRadius: 20 }}>
    <Txt variant="body-sm" className="mb-sm text-body">
      {label}
    </Txt>
    <Stepper value={value} onChange={onChange} step={step} max={max} />
  </View>
);

const Page3 = ({ width }: { width: number }) => {
  const [target, setTarget] = useState(2000);
  const [meals, setMeals] = useState(3);
  return (
    <View style={{ width }} className="flex-1 px-md pb-md">
      <View className="flex-row items-start justify-between">
        <Txt weight="600" className="mt-md flex-1 text-ink" style={{ fontSize: 30, lineHeight: 36, letterSpacing: -1 }}>
          Personalized{'\n'}Custom Plan
        </Txt>
        <ImageSlot className="ml-md" source={PHOTOS.meals} style={{ width: 96, height: 96, borderRadius: 48 }} />
      </View>

      <View className="mt-lg">
        <MacroBar color={MACRO.protein} grams={105} label="Proteins" />
        <MacroBar color={MACRO.carbs} grams={130} label="Carbs" />
        <MacroBar color={MACRO.fat} grams={12} label="Fat" />
      </View>

      <View className="mt-md flex-row gap-md">
        <StatCard label="Daily Target" value={target} onChange={setTarget} step={50} max={6000} />
        <StatCard label="Daily Meals" value={meals} onChange={setMeals} step={1} max={8} />
      </View>

      <View className="mt-md items-center rounded-2xl bg-surface p-lg" style={{ borderRadius: 24 }}>
        <Txt variant="body-lg" weight="600" className="text-center text-ink">
          Personal Meals, Your Way, Anytime.
        </Txt>
      </View>
    </View>
  );
};

type Page = { key: string; render: (width: number) => ReactNode };
const PAGES: Page[] = [
  { key: 'meals', render: (w) => <Page1 width={w} /> },
  { key: 'tracking', render: (w) => <Page2 width={w} /> },
  { key: 'plan', render: (w) => <Page3 width={w} /> },
];

// ── Swipe-to-continue control ────────────────────────────────────────────────
// A polished swipe-to-confirm CTA (reference design): a clean light pill with a
// green double-chevron knob on the left that you DRAG (or tap) toward a check
// pad on the right. A ghost chevron drifts toward the check to hint the gesture;
// the label fades and a soft-green fill grows as you swipe; on completion the
// check pad turns from grey (inactive) to lime (active). RN Animated +
// PanResponder only — no extra deps.
const KNOB = 54;
const CHECK = 48;
const PAD = 6;
const INK = '#101114'; // dark label/glyph ink — fixed (the pill is always light)
const KNOB_SHADOW = {
  shadowColor: '#2C4A07',
  shadowOpacity: 0.28,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 4,
} as const;

function SwipeButton({ label, onComplete }: { label: string; onComplete: () => void }) {
  const haptic = useHaptics();
  const [trackW, setTrackW] = useState(0);
  // The knob travels from the left edge until it meets the check pad on the right.
  const maxTravel = Math.max(0, trackW - PAD - KNOB - 6 - CHECK - PAD);

  // Refs so the once-created PanResponder never reads stale values / closures.
  const maxRef = useRef(0);
  maxRef.current = maxTravel;
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const hapticRef = useRef(haptic);
  hapticRef.current = haptic;

  const dragX = useRef(new Animated.Value(0)).current;
  const hint = useRef(new Animated.Value(0)).current;
  const startedAt = useRef(0);

  // Looping swipe hint — a ghost chevron drifting toward the check, then fading.
  useEffect(() => {
    if (maxTravel <= 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(550),
        Animated.timing(hint, { toValue: 1, duration: 1100, useNativeDriver: false }),
        Animated.timing(hint, { toValue: 0, duration: 0, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [maxTravel, hint]);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3,
      onPanResponderGrant: () => {
        startedAt.current = Date.now();
      },
      onPanResponderMove: (_, g) => {
        dragX.setValue(Math.min(maxRef.current, Math.max(0, g.dx)));
      },
      onPanResponderRelease: (_, g) => {
        const max = maxRef.current;
        const x = Math.min(max, Math.max(0, g.dx));
        const isTap = Math.abs(g.dx) < 6 && Date.now() - startedAt.current < 250;
        if (max <= 0 && isTap) {
          completeRef.current();
          return;
        }
        if (isTap || x >= max * 0.6) {
          Animated.timing(dragX, { toValue: max, duration: 140, useNativeDriver: false }).start(() => {
            hapticRef.current.success();
            completeRef.current();
            dragX.setValue(0);
          });
        } else {
          Animated.spring(dragX, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
        }
      },
    }),
  ).current;

  const progress = dragX.interpolate({
    inputRange: [0, Math.max(1, maxTravel)],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const labelOpacity = progress.interpolate({ inputRange: [0, 0.55], outputRange: [1, 0], extrapolate: 'clamp' });
  const fillWidth = dragX.interpolate({
    inputRange: [0, Math.max(1, maxTravel)],
    outputRange: [KNOB + PAD * 2, trackW || KNOB + PAD * 2],
    extrapolate: 'clamp',
  });
  const checkBg = progress.interpolate({ inputRange: [0.7, 1], outputRange: ['#E6E8EC', GREEN], extrapolate: 'clamp' });
  const hintX = hint.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, maxTravel * 0.5)] });
  const hintOpacity = hint.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.5, 0.5, 0] });

  return (
    <View
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
      className="justify-center overflow-hidden rounded-pill"
      style={{ height: 64, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECEDF1', ...KNOB_SHADOW, shadowOpacity: 0.1 }}
    >
      {/* soft-green fill that grows as you swipe */}
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: fillWidth, backgroundColor: GREEN_CARD }}
      />

      {/* centered label — fades out as the knob advances */}
      <Animated.View pointerEvents="none" style={{ opacity: labelOpacity }}>
        <Txt variant="body-lg" weight="600" className="text-center" style={{ color: INK, paddingHorizontal: KNOB + CHECK }}>
          {label}
        </Txt>
      </Animated.View>

      {/* ghost chevron drifting toward the check (swipe hint) */}
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', left: KNOB + PAD * 2 + 6, opacity: hintOpacity, transform: [{ translateX: hintX }] }}
      >
        <Chevrons color={GREEN_RING} size={22} />
      </Animated.View>

      {/* destination check pad — grey (inactive) → lime (active) on completion */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: PAD,
          height: CHECK,
          width: CHECK,
          borderRadius: CHECK / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: checkBg,
        }}
      >
        <Check color={INK} size={20} />
      </Animated.View>

      {/* draggable green knob with double-chevron */}
      <Animated.View
        {...responder.panHandlers}
        style={{
          position: 'absolute',
          left: PAD,
          height: KNOB,
          width: KNOB,
          borderRadius: KNOB / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: GREEN,
          transform: [{ translateX: dragX }],
          ...KNOB_SHADOW,
        }}
      >
        <Chevrons color={INK} size={22} />
      </Animated.View>
    </View>
  );
}

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

  const finish = async () => {
    haptic.success();
    track({ name: 'onboarding_intro_completed' });
    await setIntroSeen(true);
    router.replace('/welcome'); // pre-auth: hand off to the welcome / sign-up screen
  };

  const onAdvance = () => {
    if (!isLast) {
      const next = index + 1;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      // Update progress immediately — a programmatic scroll does not reliably
      // fire onMomentumScrollEnd, so the segments would otherwise never advance.
      setIndex(next);
      haptic.select();
      return;
    }
    void finish();
  };

  const onSkip = async () => {
    await setIntroSeen(true);
    router.replace('/welcome');
  };

  const renderItem = ({ item }: ListRenderItemInfo<Page>) => <>{item.render(width)}</>;

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      {/* Top bar — wordmark + Skip */}
      <View className="flex-row items-center justify-between px-md pt-xs">
        <Logo height={18} />
        <Pressable onPress={onSkip} hitSlop={8} accessibilityRole="button" accessibilityLabel="Skip onboarding">
          <Txt variant="body-sm" weight="500" className="text-body">
            Skip
          </Txt>
        </Pressable>
      </View>

      {/* Progress segments */}
      <View className="mt-md flex-row gap-xs px-md">
        {PAGES.map((p, i) => (
          <View
            key={p.key}
            className="h-[4px] flex-1 rounded-full"
            style={{ backgroundColor: i <= index ? GREEN : TRACK }}
          />
        ))}
      </View>

      {/* Swipeable pages */}
      <View className="flex-1">
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

      {/* CTA bar */}
      <View className="px-md pb-md pt-sm">
        <SwipeButton label={isLast ? 'Swipe to start' : 'Swipe to continue'} onComplete={onAdvance} />
      </View>
    </Screen>
  );
}
