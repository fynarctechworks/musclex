import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, TextProps, View, ViewProps } from 'react-native';

import { Button as RnrButton } from '@/components/ui/button';
import { Text as RnrText } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { Icon, type IconName } from './Icon';

/**
 * ────────────────────────────────────────────────────────────────
 * PRIMITIVES
 * ────────────────────────────────────────────────────────────────
 *
 * Rebuilt on the design system (shadcn preset bKsI1x32, via uniwind) while
 * keeping every export name and prop signature byte-identical, because 68 files
 * import from here. A screen keeps compiling and keeps working while it waits
 * its turn to be redesigned; nothing has to move in lockstep.
 *
 * What changed is the surface. What did NOT change is the behaviour underneath
 * it — the Dynamic Type ceilings, the disabled handling, the rule that colour
 * never carries meaning alone. Those were right before and are carried over
 * unaltered; a visual redesign is no reason to regress accessibility.
 */

/* ── Text ────────────────────────────────────────────────────── */

type Variant =
  | 'display'
  | 'title'
  | 'heading'
  | 'bodyStrong'
  | 'body'
  | 'small'
  | 'caption'
  | 'label';

/**
 * How far each role is allowed to grow under Dynamic Type / large system text.
 *
 * Text MUST scale — refusing to is an accessibility failure, and capping at 1
 * is the same as refusing. But an unbounded cap breaks the layouts that carry
 * numbers: a `display` stat at 3x turns a two-column row into one column of
 * clipped digits, and the member loses the reading entirely.
 *
 * So the ceiling rises as the type gets smaller. Body and captions, which carry
 * the words people actually need to read, scale furthest. Big display numbers
 * are already large and have the least room, so they scale least — they are
 * also the ones a member can least afford to have clipped.
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

/**
 * Display and title name a real Inter cut rather than asking for a weight.
 * React Native registers each weight as its own family, so `font-bold` alone
 * leaves the family on Regular and iOS fakes the weight — which shows at these
 * sizes and nowhere else. See the note in src/global.css.
 */
const VARIANT: Record<Variant, string> = {
  display: 'text-3xl font-bold-face leading-tight tracking-tight',
  title: 'text-2xl font-bold-face leading-tight tracking-tight',
  heading: 'text-lg font-semibold leading-snug',
  bodyStrong: 'text-base font-semibold leading-normal',
  body: 'text-base leading-normal',
  small: 'text-sm leading-normal',
  caption: 'text-xs leading-normal',
  label: 'text-xs font-medium leading-normal',
};

const TONE = {
  t1: 'text-foreground',
  t2: 'text-ink-2',
  t3: 'text-muted-foreground',
  t4: 'text-ink-4',
  accent: 'text-primary',
  good: 'text-success',
} as const;

export function Txt({
  variant = 'body',
  tone = 't1',
  className,
  ...rest
}: TextProps & {
  variant?: Variant;
  tone?: keyof typeof TONE;
  className?: string;
}) {
  return (
    <RnrText
      maxFontSizeMultiplier={MAX_SCALE[variant]}
      {...rest}
      className={cn(VARIANT[variant], TONE[tone], className)}
    />
  );
}

/**
 * A section label.
 *
 * Was uppercase. It is not any more: STREAK / FUEL / IN GYM stacked down a
 * screen added noise and no information, and more than anything else on the old
 * surface it was what dated it. Sentence case, muted, and quiet enough to read
 * as scaffolding rather than content.
 */
export function Label({ children }: { children: ReactNode }) {
  return (
    <Txt variant="label" tone="t3">
      {children}
    </Txt>
  );
}

/* ── Card ────────────────────────────────────────────────────── */

/**
 * White on the stone-50 canvas, so a card is held by its own lightness plus a
 * hairline rather than by the border alone. That separation is why the canvas
 * token moved off the preset — see src/global.css.
 */
export function Card({
  className,
  tone = 'default',
  ...rest
}: ViewProps & { tone?: 'default' | 'accent' | 'good'; className?: string }) {
  return (
    <View
      {...rest}
      className={cn(
        'bg-card border-border rounded-lg border p-4 shadow-sm shadow-black/5',
        tone === 'accent' && 'border-primary/30 bg-primary/5',
        tone === 'good' && 'border-success/30 bg-success/5',
        className
      )}
    />
  );
}

/* ── Button ──────────────────────────────────────────────────── */

const BTN_VARIANT = {
  primary: 'default',
  secondary: 'secondary',
  quiet: 'ghost',
} as const;

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled,
  loading,
  accessibilityLabel,
  className,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'quiet';
  size?: 'lg' | 'sm';
  disabled?: boolean;
  loading?: boolean;
  /** Overrides the label when the visible title is ambiguous on its own. */
  accessibilityLabel?: string;
  className?: string;
}) {
  const off = disabled || loading;
  return (
    <RnrButton
      variant={BTN_VARIANT[variant]}
      size={size === 'sm' ? 'sm' : 'lg'}
      onPress={off ? undefined : onPress}
      // `disabled` as well as dropping the handler: it stops the press ripple,
      // takes the control out of the touch responder chain, and is what
      // assistive tech actually reads. Dropping onPress alone leaves a control
      // that still looks and behaves pressable.
      disabled={!!off}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!off }}
      className={cn(size === 'lg' && 'h-12', className)}>
      {loading ? (
        // Sized and coloured to sit exactly where the label would, so the
        // button does not resize when it starts working.
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#fef2f2' : '#0c0a09'}
        />
      ) : (
        <RnrText className={cn('font-semibold', size === 'sm' ? 'text-sm' : 'text-base')}>
          {title}
        </RnrText>
      )}
    </RnrButton>
  );
}

/* ── Chip ────────────────────────────────────────────────────── */

export function Chip({ label, on }: { label: string; on?: boolean }) {
  return (
    <View
      className={cn(
        'border-border bg-secondary h-8 flex-row items-center justify-center gap-1 rounded-full border px-3',
        on && 'border-success/40 bg-success/10'
      )}>
      {/* Meaningful, NOT decorative: nothing else in this chip says it is done
          except the green fill, and colour must never be the only indicator.
          The label is what a screen reader has to go on. */}
      {on ? <Icon name="check" size={13} tone="good" accessibilityLabel="done" /> : null}
      <Txt variant="caption" tone={on ? 'good' : 't2'} className="font-semibold">
        {label}
      </Txt>
    </View>
  );
}

/* ── Badge ───────────────────────────────────────────────────── */

/**
 * An unread count. Two screens list conversations and both drew this by hand;
 * the number is the whole message, so it must never be the fill alone.
 *
 * `min-w-5` with horizontal padding rather than a fixed width, so a 2 and a 12
 * are both round-ended rather than one being clipped.
 */
export function Badge({ count, label }: { count: number; label?: string }) {
  if (count <= 0) return null;
  return (
    <View
      className="bg-primary h-5 min-w-5 items-center justify-center rounded-full px-1.5"
      accessible
      accessibilityLabel={label ?? `${count} unread`}>
      <Txt variant="caption" className="text-primary-foreground font-semibold">
        {count}
      </Txt>
    </View>
  );
}

/* ── Meter (occupancy, goals) ────────────────────────────────── */

/**
 * `tint` stays a raw colour string rather than a class: the callers that matter
 * are the nutrition rings, which pass the per-macro hues, and those are chosen
 * at runtime from data rather than written into markup.
 */
export function Meter({ value, max, tint }: { value: number; max: number; tint: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <View className="bg-secondary mt-3 h-2 overflow-hidden rounded-full">
      <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: tint }} />
    </View>
  );
}

/* ── States ──────────────────────────────────────────────────── */

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <View className="items-center justify-center py-16">
      <ActivityIndicator color="#79716b" />
      <Txt variant="small" tone="t3" className="mt-3">
        {label}
      </Txt>
    </View>
  );
}

/**
 * The empty state.
 *
 * This is the most-seen component in the app and the one the old design served
 * worst: a member with no data met a bare `0`, which reads as failure rather
 * than as a starting point. It now takes an ACTION, because an empty screen
 * that only describes its own emptiness leaves the member with nowhere to go.
 *
 * `action` is optional so the 68 existing callers keep working untouched; they
 * get the better typography now and a way forward as each screen is redesigned.
 */
export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <View className="items-center justify-center gap-2 px-6 py-16">
      <Txt variant="bodyStrong" tone="t1">
        {title}
      </Txt>
      {body ? (
        <Txt variant="small" tone="t3" className="text-center">
          {body}
        </Txt>
      ) : null}
      {action ? <View className="mt-2">{action}</View> : null}
    </View>
  );
}

export function Row({ className, ...rest }: ViewProps & { className?: string }) {
  return <View {...rest} className={cn('flex-row items-center justify-between', className)} />;
}

/* ── Lists ───────────────────────────────────────────────────── */

/**
 * A grouped list of links — the single most repeated shape in this app. Train,
 * You and most of the 48 deep routes are lists of "icon, label, hint, chevron",
 * and each one used to hand-roll the row, the divider and the pressed state.
 *
 * Extracted so they cannot drift: one place decides how tall a row is, how it
 * responds to a press, and what a divider looks like.
 */
export function ListCard({ children, className }: { children: ReactNode; className?: string }) {
  return <Card className={cn('overflow-hidden p-0', className)}>{children}</Card>;
}

export function RowLink({
  icon,
  label,
  hint,
  onPress,
  first,
  danger,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  onPress: () => void;
  /** Suppresses the divider on the first row of a group. */
  first?: boolean;
  /** For sign-out and the like. Carries a colour AND stays a plain verb. */
  danger?: boolean;
}) {
  return (
    <View>
      {first ? null : <View className="bg-border ml-14 h-px" />}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        // The hint is part of the label, not a separate announcement: read on
        // its own, "Form cues and your records" gives no idea what it opens.
        accessibilityLabel={hint ? `${label}. ${hint}` : label}
        // 56 is above the 44pt minimum with room for two lines of text at
        // larger Dynamic Type sizes before anything clips.
        className="min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-secondary">
        <Icon name={icon} size={20} tone={danger ? 'accent' : 't2'} decorative />
        <View className="flex-1">
          <Txt variant="body" tone={danger ? 'accent' : 't1'}>
            {label}
          </Txt>
          {hint ? (
            <Txt variant="caption" tone="t3">
              {hint}
            </Txt>
          ) : null}
        </View>
        <Icon name="chevron" size={16} tone="t4" decorative />
      </Pressable>
    </View>
  );
}

/** One row in a LinkGroup. `href` is passed straight back to the caller's router. */
export interface LinkEntry {
  icon: IconName;
  label: string;
  hint?: string;
  href: string;
}

/**
 * A titled group of links, optionally with an action on the right of its
 * heading. Train, Community and You each had their own copy of this — same
 * markup, three chances to drift.
 *
 * The heading sits OUTSIDE the card. A group is not itself a surface, and
 * putting its title inside meant every list started with a line of scaffolding
 * where its first real row should be.
 */
export function LinkGroup({
  title,
  entries,
  onGo,
  action,
  onAction,
  actionLabel,
}: {
  title: string;
  entries: LinkEntry[];
  onGo: (href: string) => void;
  action?: string;
  onAction?: () => void;
  actionLabel?: string;
}) {
  if (entries.length === 0) return null;
  return (
    <View>
      <Row className="mb-2">
        <Label>{title}</Label>
        {action && onAction ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel ?? action}
            hitSlop={10}>
            <Txt variant="caption" tone="t3">
              {action} ›
            </Txt>
          </Pressable>
        ) : null}
      </Row>
      <ListCard>
        {entries.map((e, i) => (
          <RowLink
            key={e.href + e.label}
            icon={e.icon}
            label={e.label}
            hint={e.hint}
            first={i === 0}
            onPress={() => onGo(e.href)}
          />
        ))}
      </ListCard>
    </View>
  );
}

export { Icon, type IconName } from './Icon';
