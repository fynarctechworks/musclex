import { Image, type ImageStyle, type StyleProp } from 'react-native';

/**
 * MuscleX brand logo — renders the real transparent art from `assets/brand`
 * (keyed-out + trimmed from `asserts/logo` via `scripts/make-logos.js`).
 *
 * Variants:
 *   - `wordmark` (default) — horizontal "MUSCLEX" — top bars, inline headers
 *   - `full` — stacked "MUSCLEX / MX" lockup — splash / hero
 *   - `mark` — "MX" monogram — compact / square contexts
 *
 * The art is red + black, so it reads on light surfaces. Set `height`; width is
 * derived from the asset aspect ratio.
 */
const SOURCES = {
  wordmark: require('../../assets/brand/logo-wordmark.png'),
  full: require('../../assets/brand/logo-full.png'),
  mark: require('../../assets/brand/logo-mark.png'),
} as const;

// width / height of each trimmed asset (see make-logos.js output).
const ASPECT = { wordmark: 6.964, full: 2.302, mark: 3.105 } as const;

export type LogoVariant = keyof typeof SOURCES;

export function Logo({
  height = 18,
  variant = 'wordmark',
  style,
}: {
  /** Rendered height in px; width follows the asset aspect ratio. */
  height?: number;
  variant?: LogoVariant;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={SOURCES[variant]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="MuscleX"
      // Set width explicitly (= height × aspect) as well as aspectRatio: on
      // react-native-web the <img> otherwise falls back to its natural intrinsic
      // width and blows out flex rows; this matches the native aspectRatio result.
      style={[{ height, width: height * ASPECT[variant], aspectRatio: ASPECT[variant] }, style]}
    />
  );
}
