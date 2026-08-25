import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';

/**
 * Phase 1 stand-in for a screen that has not been built yet. Named honestly so
 * nobody mistakes an empty shell for a finished feature, and so
 * `grep -r Placeholder app/` lists exactly what is still outstanding.
 *
 * Styled with uniwind classNames against the tokens in src/global.css — the
 * same semantic slots (background/foreground/muted-foreground) that every
 * component pulled from the @rnr registry themes itself from.
 */
export function Placeholder({ title, phase }: { title: string; phase: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Text className="mb-2 text-xl font-semibold text-foreground">{title}</Text>
      <Text className="text-center text-sm text-muted-foreground">
        Not built yet — scheduled for {phase}.
      </Text>
    </View>
  );
}
