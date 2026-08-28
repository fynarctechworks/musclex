import { View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { MX_PATHS, MX_RED, MX_VIEWBOX } from './logo-paths';
import { Txt } from './index';
import { Row } from './index';

/**
 * ────────────────────────────────────────────────────────────────
 * THE MARK
 * ────────────────────────────────────────────────────────────────
 *
 * Two lockups, drawn from the same source:
 *
 *   <LogoMark/>      the MX monogram alone — square-ish, for tight spaces
 *   <Wordmark/>      MUSCLEX set in type, which is what sign-in has always
 *                    used and what the app's own typography can render
 *                    crisply at any size
 *
 * The monogram is VECTOR rather than one of the PNGs beside it in
 * asserts/logo. Those are 1536x1024 with the artwork floating in the middle of
 * a white plate: rendered at 40pt the mark itself would occupy about a third
 * of that box, surrounded by white that fights every surface it sits on. The
 * paths carry no background at all, so the mark sits on the card, the dark
 * sheet, or the splash equally well.
 *
 * `react-native-svg` is already a dependency — react-native-qrcode-svg is
 * built on it — so this costs nothing new. There is deliberately no SVG *file*
 * import: that needs a Metro transformer this project does not have, and
 * adding one to render a single logo is a poor trade.
 */

/** The MX monogram. Height drives it; width follows the artwork's ratio. */
export function LogoMark({
  height = 28,
  /** Overrides both brand colours — for a one-colour context such as a
   *  monochrome icon or a dark sheet where the black stroke would vanish. */
  tint,
}: {
  height?: number;
  tint?: string;
}) {
  const width = (MX_VIEWBOX.width / MX_VIEWBOX.height) * height;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="MuscleX"
      style={{ width, height }}>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${MX_VIEWBOX.width} ${MX_VIEWBOX.height}`}>
        {MX_PATHS.map((p, i) => (
          <G key={i} transform={`translate(${p.tx}, ${p.ty})`}>
            <Path d={p.d} fill={tint ?? p.fill} />
          </G>
        ))}
      </Svg>
    </View>
  );
}

/**
 * MUSCLEX as type.
 *
 * Set rather than drawn, because it has to sit on a baseline with the sentence
 * underneath it and match the weight of the screen around it — which a bitmap
 * of a wordmark cannot do as the type scale changes.
 */
export function Wordmark({ variant = 'display' }: { variant?: 'display' | 'title' }) {
  return (
    <Row
      className="justify-start gap-1"
      accessibilityRole="header"
      accessibilityLabel="MuscleX">
      <Txt variant={variant}>MUSCLE</Txt>
      <Txt variant={variant} tone="accent">
        X
      </Txt>
    </Row>
  );
}

/** The red the mark is drawn in, for anything that must match it exactly. */
export { MX_RED };
