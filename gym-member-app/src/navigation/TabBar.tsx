import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Icon, Txt, useThemeColors, type IconName } from '../design-system';

/**
 * Information architecture (reference redesign): five evenly-spaced flat tabs —
 * Home · Search · Progress · Advice · Profile — no centre FAB. The active tab is
 * tinted with the brand accent (filled icon + coloured label); the rest sit muted.
 * Built as a custom `tabBar` so the Geist styling lives in one place rather than
 * fighting react-navigation's default bar. Workout / Classes / Community / Rewards
 * / Membership etc. are reached from the Search (discover) and Profile (account)
 * hubs; check-in lives on the Home header.
 */
const TAB_META: Record<string, { label: string; icon: IconName }> = {
  home: { label: 'Home', icon: 'home' },
  search: { label: 'Search', icon: 'search' },
  progress: { label: 'Progress', icon: 'chart' },
  advice: { label: 'Advice', icon: 'message' },
  profile: { label: 'Profile', icon: 'user' },
};

/** Tab order, left → right. */
const TAB_ORDER = ['home', 'search', 'progress', 'advice', 'profile'] as const;

/**
 * Minimal structural type for the subset of react-navigation's `BottomTabBarProps`
 * we use. `emit`/`navigate` are declared as methods (not arrow properties) so their
 * params are bivariant — that lets expo-router's richer prop type assign cleanly
 * without importing from its vendored build path.
 */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    navigate(name: string): void;
    // Return is react-navigation's EventArg; we only read `.defaultPrevented`.
    // Typed `any` so expo-router's richer prop type assigns without a fragile
    // import from its vendored react-navigation build path.
    emit(e: { type: string; target?: string; canPreventDefault?: boolean }): any;
  };
};

export function FitTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const theme = useThemeColors();

  function renderTab(name: string) {
    const meta = TAB_META[name];
    if (!meta) return null;
    const routeIndex = state.routes.findIndex((r) => r.name === name);
    const route = state.routes[routeIndex];
    if (!route) return null;
    const focused = state.index === routeIndex;
    // Active = brand green (vibrant lime icon + AA-readable green label); muted otherwise.
    const iconTint = focused ? theme.primary : theme.mute;
    const labelTint = focused ? theme.accent : theme.mute;

    const onPress = () => {
      Haptics.selectionAsync();
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
    };

    return (
      <Pressable
        key={name}
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : {}}
        accessibilityLabel={meta.label}
        onPress={onPress}
        className="flex-1 items-center justify-center gap-[3px]"
        hitSlop={8}
      >
        <Icon name={meta.icon} color={iconTint} size={23} filled={focused} />
        <Txt
          variant="caption"
          weight={focused ? '500' : '400'}
          style={{ color: labelTint, fontSize: 10.5 }}
        >
          {meta.label}
        </Txt>
      </Pressable>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.canvasSoft,
        borderTopColor: theme.hairline,
        borderTopWidth: 1,
        height: 60 + insets.bottom,
        paddingBottom: insets.bottom + 6,
        paddingTop: 8,
      }}
    >
      {TAB_ORDER.map(renderTab)}
    </View>
  );
}
