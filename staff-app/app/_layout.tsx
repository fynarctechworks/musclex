import '../src/global.css';

import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PortalHost } from '@rn-primitives/portal';

import { Providers } from '@/providers';
import { tokens } from '@/ui/tokens';

export default function RootLayout() {
  return (
    <Providers>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tokens.background },
        }}
      />
      {/*
        REQUIRED. Seven registry components (dialog, alert-dialog, select,
        dropdown-menu, popover, context-menu, tooltip) render through a portal
        and mount nothing without a host. The failure mode is silent — the
        trigger presses, no overlay appears, no error — so this is easy to miss
        and hard to diagnose later.
      */}
      <PortalHost />
    </Providers>
  );
}
