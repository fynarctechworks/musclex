import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon, Txt, useThemeColors } from '../design-system';

/**
 * The single app-wide screen header for stack/card routes: a round chevron back
 * button on the left, a centred title, and an optional round action (e.g. the
 * "⋯" overflow) on the right — matching the reference design. Replaces the old
 * text-only {@link BackButton} + bespoke per-screen title markup so every inner
 * page reads identically. Routing-aware, so it lives in navigation/, not the
 * (routing-agnostic) design system.
 *
 * The title is kept perfectly centred via a 3-column layout (fixed-width sides,
 * flexible centre) regardless of whether a right action is present.
 */
const SIDE = 42; // round button + balancing spacer width

export function ScreenHeader({
  title,
  onBack,
  onMore,
  right,
  className = 'mb-md',
}: {
  title?: string;
  /** Override the default `router.back()`. */
  onBack?: () => void;
  /** Renders the round "⋯" overflow button on the right when provided. */
  onMore?: () => void;
  /** Custom right-side node (takes precedence over `onMore`). */
  right?: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const theme = useThemeColors();

  const rightNode = right ?? (onMore ? <RoundButton icon="more" label="More" onPress={onMore} /> : null);

  return (
    <View className={`flex-row items-center justify-between pt-xs ${className}`}>
      <RoundButton icon="chevron-left" label="Go back" onPress={onBack ?? (() => router.back())} />

      <View className="flex-1 px-sm">
        {title ? (
          <Txt
            variant="body-lg"
            weight="600"
            numberOfLines={1}
            className="text-center text-ink"
            accessibilityRole="header"
            style={{ color: theme.ink }}
          >
            {title}
          </Txt>
        ) : null}
      </View>

      {/* Right action, or a spacer the same width as the back button to keep the
         title optically centred. */}
      {rightNode ?? <View style={{ width: SIDE }} />}
    </View>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
}: {
  icon: 'chevron-left' | 'more';
  label: string;
  onPress: () => void;
}) {
  const theme = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)}
      className="h-[42px] w-[42px] items-center justify-center rounded-full border border-hairline bg-surface"
    >
      <Icon name={icon} color={theme.body} size={20} />
    </Pressable>
  );
}
