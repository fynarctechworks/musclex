import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from './tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface RingSpec {
  /** 0–1; clamped. Real progress toward a real, labelled target — never faked. */
  progress: number;
  /** Saturated category accent (see `health` tokens). */
  color: string;
  trackColor?: string;
}

interface RingProps {
  spec: RingSpec;
  center: number;
  r: number;
  strokeWidth: number;
  animate: boolean;
}

/** One concentric ring; owns its own fill animation. */
function Ring({ spec, center, r, strokeWidth, animate }: RingProps) {
  const circumference = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, spec.progress));
  const target = circumference * (1 - p);
  const offset = useSharedValue(circumference);

  useEffect(() => {
    offset.value = animate
      ? withTiming(target, { duration: 900, easing: Easing.bezier(0.33, 0, 0.2, 1) })
      : target;
  }, [target, animate, offset]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));

  return (
    <>
      <Circle
        cx={center}
        cy={center}
        r={r}
        stroke={spec.trackColor ?? colors.surface2}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <AnimatedCircle
        cx={center}
        cy={center}
        r={r}
        stroke={spec.color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        animatedProps={animatedProps}
        transform={`rotate(-90 ${center} ${center})`}
      />
    </>
  );
}

/**
 * Concentric activity rings — the most recognisable Samsung Health / One UI
 * widget, adapted to our dark-first design system. Each ring is one real metric
 * scored 0–1 against a real target; pass a centre label via `children`.
 *
 * Pure presentation: it computes no progress and invents no goals — callers feed
 * `progress` from real data only (per CLAUDE.md: no fake/unverified metrics).
 * Built on the already-installed `react-native-svg` + `react-native-reanimated`
 * — no Skia / victory dependency.
 */
export function ActivityRings({
  rings,
  size = 120,
  strokeWidth = 12,
  gap = 4,
  animate = true,
  children,
}: {
  /** Outermost first. 1–3 reads cleanly; more gets cramped. */
  rings: RingSpec[];
  size?: number;
  strokeWidth?: number;
  /** Space between concentric rings, in px. */
  gap?: number;
  animate?: boolean;
  children?: ReactNode;
}) {
  const center = size / 2;

  return (
    <View
      style={{ width: size, height: size }}
      className="items-center justify-center"
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {rings.map((spec, i) => {
          const r = (size - strokeWidth) / 2 - i * (strokeWidth + gap);
          if (r <= strokeWidth / 2) return null; // ran out of room
          return (
            <Ring
              key={i}
              spec={spec}
              center={center}
              r={r}
              strokeWidth={strokeWidth}
              animate={animate}
            />
          );
        })}
      </Svg>
      {children}
    </View>
  );
}
