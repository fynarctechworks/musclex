import React from 'react';
import { Stack } from 'expo-router';

import { tokens } from '@/ui/tokens';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.background },
      }}
    />
  );
}
