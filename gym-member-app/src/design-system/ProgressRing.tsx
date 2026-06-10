import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useThemeColors } from './theme';

/**
 * Circular progress ring (Samsung-Health style) for the Home dashboard — daily
 * goal, calories, water, streak. Renders an open track + a rounded progress arc;
 * place a label in `children` to fill the centre.
 */
export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 10,
  color,
  trackColor,
  children,
}: {
  /** 0–1; clamped. */
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  children?: ReactNode;
}) {
  const theme = useThemeColors();
  const arcColor = color ?? theme.cyan;
  const track = trackColor ?? theme.surface2;
  const p = Math.max(0, Math.min(1, progress));
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const center = size / 2;

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={center} cy={center} r={r} stroke={track} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={arcColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - p)}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      {children}
    </View>
  );
}
