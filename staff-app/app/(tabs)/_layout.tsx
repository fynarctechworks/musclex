import React from 'react';
import { Tabs } from 'expo-router';

import { useSession } from '@/auth/SessionProvider';
import { can } from '@/rbac/permissions';
import { CANDIDATE_TABS, MAX_PRIMARY_TABS, MORE_TAB } from '@/rbac/nav';
import { tokens } from '@/ui/tokens';

/**
 * Role-adaptive tab bar.
 *
 * expo-router needs a <Tabs.Screen> for every route file, so ALL candidate
 * tabs are declared and the ones the role cannot see are hidden with
 * `href: null` rather than omitted. Omitting them would make those routes
 * unreachable even via a deep link that the role IS allowed to follow.
 *
 * Tabs are derived from the permission map, never from the role NAME: gyms
 * author custom roles via /settings/roles, and a per-role lookup would give
 * them an empty bar.
 *
 * ⚠️ Hiding a tab is UX, not security — the backend guard is the boundary.
 */
export default function TabsLayout() {
  const { session } = useSession();
  const user = session?.user;

  const visible = CANDIDATE_TABS.filter((t) => can(user, t.module, t.action ?? 'view'));
  const primary = new Set(visible.slice(0, MAX_PRIMARY_TABS).map((t) => t.name));

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.foreground,
        tabBarInactiveTintColor: tokens.mutedForeground,
        tabBarStyle: { backgroundColor: tokens.card, borderTopColor: tokens.border },
      }}>
      {CANDIDATE_TABS.map(({ name, title, icon: Icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            // null removes it from the bar but keeps the route addressable.
            href: primary.has(name) ? undefined : null,
            tabBarIcon: ({ color, size }) => <Icon color={color} size={size} />,
          }}
        />
      ))}
      <Tabs.Screen
        name={MORE_TAB.name}
        options={{
          title: MORE_TAB.title,
          tabBarIcon: ({ color, size }) => <MORE_TAB.icon color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
