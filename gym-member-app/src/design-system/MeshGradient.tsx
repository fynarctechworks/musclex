import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { meshGradient } from './tokens';

/**
 * The brand mesh gradient — design.md's single decorative element, used only at
 * hero scale (Home header, check-in success, onboarding). Rendered as a layered
 * SVG approximation of the multi-stop sweep. Never miniaturise, never reduce to
 * one colour, never reorder stops.
 */
export function MeshGradient({
  style,
  opacity = 0.9,
}: {
  style?: ViewStyle;
  opacity?: number;
}) {
  return (
    <View style={[StyleSheet.absoluteFill, { opacity }, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="mesh" x1="0%" y1="0%" x2="100%" y2="100%">
            {meshGradient.full.map((c, i) => (
              <Stop
                key={c}
                offset={`${(i / (meshGradient.full.length - 1)) * 100}%`}
                stopColor={c}
              />
            ))}
          </LinearGradient>
          <LinearGradient id="fade" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#0A0A0A" stopOpacity={0} />
            <Stop offset="100%" stopColor="#0A0A0A" stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#mesh)" />
        {/* Fade into the canvas so the hero blends rather than ends abruptly. */}
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#fade)" />
      </Svg>
    </View>
  );
}
