import '../src/global.css';

import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PortalHost } from '@rn-primitives/portal';

import { AuthGate } from '@/auth/AuthGate';
import { Providers } from '@/providers';
import { tokens } from '@/ui/tokens';

export default function RootLayout() {
  return (
    <Providers>
      <StatusBar style="dark" />
      <AuthGate>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tokens.background },
          /*
            Without this, iOS labels the back button with the previous ROUTE
            name — which for anything pushed from a tab is the expo-router
            group, so the header read a literal "(tabs)". "Back" is what the
            control does; the group name is an implementation detail that
            should never have been on screen.
          */
          headerBackTitle: 'Back',
        }}
      />
      </AuthGate>
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
