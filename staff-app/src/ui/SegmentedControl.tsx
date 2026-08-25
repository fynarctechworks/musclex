import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/**
 * SegmentedControl — a small, always-visible set of mutually exclusive filters
 * (Today / Week / Month, All / Due / Paid).
 *
 * Distinct from Tabs: Tabs swap page CONTENT, this filters the data in place.
 * Keeping them separate stops screens from nesting a tab bar inside a tab bar,
 * which is the usual outcome when one component tries to serve both.
 */
export type Segment<T extends string> = { value: T; label: string };

export function SegmentedControl<T extends string>({
  segments, value, onChange, className, testID,
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      className={cn('flex-row rounded-md bg-muted p-1', className)}>
      {segments.map((seg) => {
        const active = seg.value === value;
        return (
          <Pressable
            key={seg.value}
            onPress={() => onChange(seg.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={cn(
              'flex-1 items-center rounded-sm px-3 py-1.5',
              active && 'bg-card',
            )}>
            <Text
              className={cn(
                'text-sm',
                active ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}>
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
