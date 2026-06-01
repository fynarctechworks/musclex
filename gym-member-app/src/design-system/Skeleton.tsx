import { useEffect } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * Shimmer skeleton — design.md leans on "skeleton loaders & optimistic UI so the
 * app feels instant" (TRD §11). Renders the card silhouette while data loads.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  rounded = 8,
  style,
}: {
  width?: number | `${number}%` | 'auto';
  height?: number;
  rounded?: number;
  style?: ViewStyle;
}) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.9, { duration: 800 }), -1, true);
  }, [opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: rounded, backgroundColor: '#1F1F1F' },
        animated,
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  return (
    <View className="rounded-lg border border-hairline bg-surface p-lg">
      <Skeleton width="60%" height={20} />
      <View className="h-md" />
      <Skeleton width="100%" height={14} />
      <View className="h-xs" />
      <Skeleton width="80%" height={14} />
    </View>
  );
}
