import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from './Icon';
import { Txt } from './index';
import { color, space } from './theme';

/**
 * ────────────────────────────────────────────────────────────────
 * INFO TIP — the "i" that explains a number the member never defined
 * ────────────────────────────────────────────────────────────────
 *
 * Two pieces rather than one component, because the trigger and the
 * explanation belong in different boxes: the "i" sits beside a label inside a
 * header row, while the explanation wants the full width of the card. A single
 * component would be trapped in whichever layout held the trigger.
 *
 * The parent owns the open state. That keeps this presentational, and on a
 * screen with two tips it lets the parent show only one at a time.
 *
 * Deliberately inline rather than a modal: the explanation is one short
 * paragraph about the thing directly above it, and a sheet that covers the
 * number you are asking about is a worse answer than a line under it.
 */

export function InfoDot({
  open,
  onPress,
  label,
}: {
  open: boolean;
  onPress: () => void;
  /** What the "i" explains, e.g. "What counts as a streak day". An icon alone
   *  reads as "i" to a screen reader, which is no help at all. */
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: open }}
      // The glyph is 15px. Without the slop the target is a third of the 44pt
      // minimum — findable with a mouse, a coin-toss with a thumb.
      hitSlop={14}
      style={({ pressed }) => ({ marginLeft: 6, opacity: pressed ? 0.5 : 1 })}
    >
      {/* Darker when open rather than accent: red is this app's alert colour,
          and an "i" that turns red beside a streak reads as a problem. */}
      <Icon name="info" size={15} tone={open ? 't2' : 't4'} decorative />
    </Pressable>
  );
}

/**
 * The explanation itself: a hairline and then quiet text, so an opened tip
 * reads as a footnote to the card rather than a second card inside it.
 */
export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        marginTop: space.lg,
        paddingTop: space.md,
        borderTopWidth: 1,
        borderTopColor: color.line,
        gap: space.xs,
      }}
    >
      {children}
    </View>
  );
}

/** One item in a tip's list. The dot is decorative — the text carries it. */
export function InfoBullet({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      <Txt variant="small" tone="t3">
        •
      </Txt>
      <Txt variant="small" tone="t2" style={{ flex: 1 }}>
        {children}
      </Txt>
    </View>
  );
}
