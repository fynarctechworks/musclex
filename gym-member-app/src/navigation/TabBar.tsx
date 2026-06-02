import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Icon, Txt, colors, type IconName } from '../design-system';

/**
 * The blueprint information architecture (BLUEPRINT.md §5): five evenly-spaced
 * tabs — Home · Workout · Classes · Progress · Community. The QR check-in FAB
 * floats over content from the layout (bottom-right, Samsung-Health style) so it
 * never collides with the middle tab. Built as a custom `tabBar` so the Geist
 * styling lives in one place rather than fighting react-navigation's default bar.
 */
const TAB_META: Record<string, { label: string; icon: IconName }> = {
  home: { label: 'Home', icon: 'home' },
  workout: { label: 'Workout', icon: 'dumbbell' },
  classes: { label: 'Classes', icon: 'calendar' },
  progress: { label: 'Progress', icon: 'chart' },
  community: { label: 'Community', icon: 'users' },
};

/** Tab order, left → right. The QR FAB floats centered above the bar. */
const TAB_ORDER = ['home', 'workout', 'classes', 'progress', 'community'] as const;

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

  function renderTab(name: string) {
    const meta = TAB_META[name];
    if (!meta) return null;
    const routeIndex = state.routes.findIndex((r) => r.name === name);
    const route = state.routes[routeIndex];
    if (!route) return null;
    const focused = state.index === routeIndex;
    const tint = focused ? colors.ink : colors.mute;

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
        <Icon name={meta.icon} color={tint} size={23} strokeWidth={focused ? 2 : 1.75} />
        <Txt
          variant="caption"
          weight={focused ? '500' : '400'}
          style={{ color: tint, fontSize: 10.5 }}
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
        backgroundColor: colors.canvasSoft,
        borderTopColor: colors.hairline,
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
