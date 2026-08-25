import React from 'react';
import { Tabs } from 'expo-router';
import { CalendarDays, LayoutGrid, ScanLine, ShoppingCart, Users } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { tokens } from '@/ui/tokens';

/**
 * PHASE 1/2: a STATIC front-desk tab set.
 *
 * This is scaffolding, not the shipping navigation. Phase 3 replaces it with
 * role-adaptive nav derived at runtime from the user's permission map — it
 * cannot be a per-role lookup table, because gyms author their own roles via
 * /settings/roles, so a hardcoded map would simply miss them.
 *
 * The front_desk set is used as the placeholder because front_desk is the
 * first release train (plan §11, Phase 5).
 */
const TABS: { name: string; title: string; icon: LucideIcon }[] = [
  { name: 'index', title: 'Check-in', icon: ScanLine },
  { name: 'members', title: 'Members', icon: Users },
  { name: 'schedule', title: 'Schedule', icon: CalendarDays },
  { name: 'pos', title: 'POS', icon: ShoppingCart },
  { name: 'more', title: 'More', icon: LayoutGrid },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.foreground,
        tabBarInactiveTintColor: tokens.mutedForeground,
        tabBarStyle: {
          backgroundColor: tokens.card,
          borderTopColor: tokens.border,
        },
      }}>
      {TABS.map(({ name, title, icon: Icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            // Without an explicit icon React Navigation renders a default
            // glyph — the "▼" placeholders visible in the first screenshots.
            tabBarIcon: ({ color, size }) => <Icon color={color} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
