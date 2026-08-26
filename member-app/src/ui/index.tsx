import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextProps,
  View,
  ViewProps,
} from 'react-native';
import { color, radius, shadow, space, type as t } from './theme';
import { Icon } from './Icon';

/* ── Text ────────────────────────────────────────────────────── */

type Variant = keyof typeof t;

/**
 * How far each role is allowed to grow under Dynamic Type / large system text.
 *
 * Text MUST scale — refusing to is an accessibility failure, and capping at 1
 * is the same as refusing. But an unbounded cap breaks the layouts that carry
 * numbers: a `display` stat at 3x turns a two-column row into one column of
 * clipped digits, and the member loses the reading entirely.
 *
 * So the ceiling rises as the type gets smaller. Body and captions, which
 * carry the words people actually need to read, scale furthest. Big display
 * numbers are already large and have the least room, so they scale least —
 * they are also the ones a member can least afford to have clipped.
 */
const MAX_SCALE: Record<Variant, number> = {
  display: 1.4,
  title: 1.5,
  heading: 1.6,
  bodyStrong: 1.8,
  body: 1.8,
  small: 1.9,
  caption: 2,
  label: 2,
};

export function Txt({
  variant = 'body',
  tone = 't1',
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: 't1' | 't2' | 't3' | 't4' | 'accent' | 'good' }) {
  // Accent *text* is a shade darker than the accent fill: #E10600 on white is
  // legible but sits right at the edge, and small text needs the extra step.
  const toneColor =
    tone === 'accent' ? color.accentText : tone === 'good' ? color.good : color[tone];
  return (
    <Text
      maxFontSizeMultiplier={MAX_SCALE[variant]}
      {...rest}
      style={[t[variant] as object, { color: toneColor }, style]}
    />
  );
}

/** Uppercase section label. Always t3 — it is scaffolding, not content. */
export function Label({ children }: { children: ReactNode }) {
  return (
    <Txt variant="label" tone="t3">
      {children}
    </Txt>
  );
}

/* ── Card ────────────────────────────────────────────────────── */

export function Card({
  style,
  tone = 'default',
  ...rest
}: ViewProps & { tone?: 'default' | 'accent' | 'good' }) {
  return (
    <View
      {...rest}
      style={[
        s.card,
        tone === 'accent' && { borderColor: color.accentEdge, backgroundColor: color.accentSoft },
        tone === 'good' && { borderColor: color.goodEdge, backgroundColor: color.goodSoft },
        style,
      ]}
    />
  );
}

/* ── Button ──────────────────────────────────────────────────── */

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled,
  loading,
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'quiet';
  size?: 'lg' | 'sm';
  disabled?: boolean;
  loading?: boolean;
  /** Overrides the label when the visible title is ambiguous on its own. */
  accessibilityLabel?: string;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      // `disabled` as well as dropping the handler: it stops the press ripple,
      // takes the control out of the touch responder chain, and is what
      // assistive tech actually reads. Dropping onPress alone leaves a control
      // that still looks and behaves pressable.
      disabled={!!off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!off }}
      style={({ pressed }) => [
        s.btn,
        size === 'sm' && s.btnSm,
        variant === 'primary' && { backgroundColor: color.accent },
        variant === 'secondary' && {
          backgroundColor: color.surface2,
          borderWidth: 1,
          borderColor: color.line,
        },
        variant === 'quiet' && { backgroundColor: 'transparent' },
        off && { opacity: 0.42 },
        pressed && !off && { opacity: 0.85 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? color.accentInk : color.t1} />
      ) : (
        <Txt
          variant={size === 'sm' ? 'small' : 'bodyStrong'}
          style={{
            fontWeight: '600',
            color: variant === 'primary' ? color.accentInk : color.t1,
          }}
        >
          {title}
        </Txt>
      )}
    </Pressable>
  );
}

/* ── Chip ────────────────────────────────────────────────────── */

export function Chip({ label, on }: { label: string; on?: boolean }) {
  return (
    <View style={[s.chip, on && { backgroundColor: color.goodSoft, borderColor: color.goodEdge }]}>
      {/* Meaningful, NOT decorative: nothing else in this chip says it is
          done except the green fill, and colour must never be the only
          indicator. The label is what a screen reader has to go on. */}
      {on ? <Icon name="check" size={13} tone="good" accessibilityLabel="done" /> : null}
      <Txt variant="caption" tone={on ? 'good' : 't2'} style={{ fontWeight: '600' }}>
        {label}
      </Txt>
    </View>
  );
}

/* ── Meter (occupancy, goals) ────────────────────────────────── */

export function Meter({ value, max, tint }: { value: number; max: number; tint: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <View style={s.meter}>
      <View style={[s.meterFill, { width: `${pct}%`, backgroundColor: tint }]} />
    </View>
  );
}

/* ── States ──────────────────────────────────────────────────── */

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <View style={s.center}>
      <ActivityIndicator color={color.t3} />
      <Txt variant="small" tone="t3" style={{ marginTop: space.md }}>
        {label}
      </Txt>
    </View>
  );
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <View style={s.center}>
      <Txt variant="bodyStrong" tone="t2">
        {title}
      </Txt>
      {body ? (
        <Txt variant="small" tone="t3" style={{ marginTop: space.sm, textAlign: 'center' }}>
          {body}
        </Txt>
      ) : null}
    </View>
  );
}

export function Row({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[s.row, style]} />;
}

const s = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderColor: color.line,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    ...shadow.card,
  },
  btn: {
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: space.sm,
  },
  btnSm: { height: 36, paddingHorizontal: space.lg, borderRadius: radius.sm },
  chip: {
    height: 30,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.surface2,
    borderWidth: 1,
    borderColor: color.line,
    // Row, because the selected state now shows a tick beside the label
    // instead of a "✓ " prefix glued onto the string.
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meter: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: color.surface2,
    overflow: 'hidden',
    marginTop: space.md,
  },
  meterFill: { height: '100%', borderRadius: radius.pill },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: space['3xl'] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

export { Icon, type IconName } from './Icon';
