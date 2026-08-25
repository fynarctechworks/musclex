import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { tokens } from '@/ui/tokens';

/** Neutral loading state. Used while the session hydrates and by screens. */
export function Loading({ label }: { label?: string }) {
  return (
    <View className="items-center justify-center gap-2 p-6">
      <ActivityIndicator color={tokens.mutedForeground} />
      {label ? <Text className="text-sm text-muted-foreground">{label}</Text> : null}
    </View>
  );
}
