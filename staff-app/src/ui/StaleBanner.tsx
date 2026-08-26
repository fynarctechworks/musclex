import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { formatRelative } from '@/lib/format';

/**
 * "You are looking at saved data."
 *
 * Offline caching creates a specific hazard: a screen that looks exactly like
 * a live one but is not. A member list from three hours ago will happily show
 * a lapsed membership as active, and the desk will wave that person through —
 * having been given no reason to doubt it.
 *
 * So the rule is that cached-and-failing NEVER renders identically to live.
 * The banner is deliberately plain rather than alarming: this is a normal
 * condition in a basement gym, and staff who see a red error ten times a day
 * stop reading it.
 */
export function StaleBanner({ updatedAt, testID }: { updatedAt?: number; testID?: string }) {
  return (
    <View
      className="mb-3 rounded-lg border border-border bg-muted px-3 py-2"
      testID={testID ?? 'stale-banner'}
    >
      <Text className="text-sm text-muted-foreground">
        {updatedAt
          ? `Offline — showing data saved ${formatRelative(new Date(updatedAt).toISOString())}.`
          : 'Offline — showing saved data.'}
      </Text>
    </View>
  );
}
