import React from 'react';
import { View } from 'react-native';

import { tokens } from '@/ui/tokens';

/**
 * A thin capacity bar. Deliberately not the Progress primitive: this is used
 * inline in dense rows and needs a fixed small height with no animation.
 */
export function Meter({
  value, max, tint = tokens.foreground,
}: { value: number; max: number; tint?: string }) {
  // Guard max<=0: a class with no capacity set must not divide by zero.
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: tint }} />
    </View>
  );
}
