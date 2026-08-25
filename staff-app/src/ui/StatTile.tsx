import React from 'react';
import { View } from 'react-native';
import { TrendingDown, TrendingUp } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { tokens } from '@/ui/tokens';

/**
 * StatTile — a single dashboard metric.
 *
 * Deliberately does NOT colour the value by direction. "Delta up" is not the
 * same as "good": rising churn or rising expenses are both up and both bad.
 * The caller states the intent via `intent`, and the default is neutral, so a
 * tile can never accidentally imply a number is healthy.
 */
export type StatTileProps = {
  label: string;
  value: string;
  /** Signed change, e.g. +12.5 for +12.5%. */
  deltaPercent?: number;
  /** What a RISE means for this metric. Defaults to neutral (no colour). */
  intent?: 'neutral' | 'up-is-good' | 'up-is-bad';
  hint?: string;
  className?: string;
  testID?: string;
};

export function StatTile({
  label, value, deltaPercent, intent = 'neutral', hint, className, testID,
}: StatTileProps) {
  const hasDelta = typeof deltaPercent === 'number' && Number.isFinite(deltaPercent);
  const rising = hasDelta && deltaPercent! > 0;

  let deltaClass = 'text-muted-foreground';
  // Annotated as string: `tokens` is `as const`, so inference would pin this
  // to the literal '#888888' and reject the semantic colours below.
  let deltaColor: string = tokens.mutedForeground;
  if (hasDelta && intent !== 'neutral' && deltaPercent !== 0) {
    const good = intent === 'up-is-good' ? rising : !rising;
    deltaClass = good ? 'text-success' : 'text-destructive';
    deltaColor = good ? tokens.success : tokens.destructive;
  }

  const Arrow = rising ? TrendingUp : TrendingDown;

  return (
    <View
      testID={testID}
      className={cn('rounded-lg border border-border bg-card p-4', className)}>
      <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Text>
      <Text className="pt-1 text-2xl font-semibold text-foreground">{value}</Text>

      {hasDelta ? (
        <View className="flex-row items-center gap-1 pt-1">
          <Arrow size={14} color={deltaColor} />
          <Text className={cn('text-sm', deltaClass)}>
            {Math.abs(deltaPercent!).toFixed(1)}%
          </Text>
          {hint ? <Text className="text-sm text-muted-foreground">{hint}</Text> : null}
        </View>
      ) : hint ? (
        <Text className="pt-1 text-sm text-muted-foreground">{hint}</Text>
      ) : null}
    </View>
  );
}
