import React from 'react';
import { ScrollView, View } from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BarChart3, CalendarDays, Boxes, DoorOpen, Dumbbell, HeartPulse, LogOut, Megaphone, Package, Receipt, Settings, ShoppingCart,
  ShieldCheck, Sparkles, Tablet, UserCog, Users2, type LucideIcon,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { RowCard } from '@/ui/RowCard';
import { BranchSwitcher } from '@/features/BranchSwitcher';
import { useSession } from '@/auth/SessionProvider';
import { useCan } from '@/rbac/Gate';
import { PremiumTag } from '@/rbac/Gate';
import { useFeatureState } from '@/rbac/Gate';
import type { FeatureKey } from '@/rbac/entitlements';
import type { Action, Module } from '@/rbac/permissions';
import { tokens } from '@/ui/tokens';

/**
 * The "More" hub — everything that does not earn a tab.
 *
 * Entries are filtered by ROLE (hidden when not permitted) and decorated by
 * PLAN (shown locked with the required tier). That asymmetry is the web app's
 * rule and must not invert: hiding a plan-gated feature deletes the upsell,
 * showing a role-gated one leaks a module across roles.
 */
type Entry = {
  href: string;
  label: string;
  icon: LucideIcon;
  /**
   * The permission module this entry needs, or `null` for an entry that is
   * about the SIGNED-IN PERSON rather than about the gym. Every role can reach
   * a `null` entry.
   */
  module: Module | null;
  action?: Action;
  feature?: FeatureKey;
  phase: string;
};

export const ENTRIES: Entry[] = [
  /*
   * These two are REAL routes, not placeholders.
   *
   * Only MAX_PRIMARY_TABS candidates fit in the tab bar, so anything further
   * down CANDIDATE_TABS is cut for a role that can otherwise see it — and is
   * then reachable ONLY from here. Schedule sits 5th and POS 6th, so a front
   * desk user had the classes permission and no way to open the schedule.
   *
   * `src/__tests__/nav.test.ts` asserts every candidate tab is reachable one
   * way or the other, so adding a tab without an escape hatch now fails.
   */
  { href: '/(tabs)/schedule', label: 'Schedule', icon: CalendarDays, module: 'classes', phase: '' },
  { href: '/(tabs)/pos', label: 'Shop / POS', icon: ShoppingCart, module: 'inventory', action: 'create', phase: '' },
  // Kiosk turns the device into an unattended check-in station, so it is gated
  // on being allowed to RECORD a check-in — not merely to view them.
  { href: '/kiosk/setup', label: 'Kiosk mode', icon: Tablet, module: 'check_ins', action: 'create', phase: '' },
  // PT sessions read on staff.view, which a trainer HAS — completing one needs
  // staff.edit and is gated inside the screen.
  { href: '/pt-sessions', label: 'PT sessions', icon: HeartPulse, module: 'staff', phase: '' },
  { href: '/more/staff',      label: 'Staff',        icon: UserCog,   module: 'staff',     feature: 'staff_management',    phase: '' },
  // Points at the TAB route, like Reports. 'marketing' is 7th in
  // CANDIDATE_TABS, so a marketing manager gets it as a tab while everyone
  // else reaches it here — and a stub at the tab route would have shown that
  // persona 'Not built yet' for a screen that exists.
  { href: '/(tabs)/marketing', label: 'Leads',       icon: Megaphone, module: 'marketing', feature: 'marketing_campaigns', phase: '' },
  { href: '/more/inventory',  label: 'Inventory',    icon: Package,   module: 'inventory', phase: '' },
  { href: '/more/expenses',   label: 'Expenses',     icon: Receipt,   module: 'payments',  phase: '' },
  // Points at the REAL tab route, not a '/more/reports' that never existed.
  // Reports is 8th in CANDIDATE_TABS, so only a role whose earlier candidates
  // are filtered out (the accountant) gets it as a tab; for an owner this
  // entry is the only way in, and it was pointing at nothing.
  { href: '/(tabs)/reports',  label: 'Reports',      icon: BarChart3, module: 'reports',   feature: 'basic_reports',       phase: '' },
  { href: '/more/training',   label: 'Training',     icon: Dumbbell,  module: 'members',   phase: '' },
  // No screen yet, and the backend advisor is not connected to a model, so the
  // row is inert. Reads "Coming soon", not "Not built yet — Phase 6": our
  // internal phase numbering means nothing to a gym paying for the product.
  { href: '/more/ai',         label: 'AI advisor',   icon: Sparkles,  module: 'ai',        feature: 'ai_advisor',          phase: 'Coming soon' },
  { href: '/more/branches',   label: 'Branches',     icon: Boxes,     module: 'branches',  feature: 'multi_branch',        phase: '' },
  { href: '/more/memberships',label: 'Memberships',  icon: Users2,    module: 'members',   phase: '' },
  { href: '/more/visits',     label: 'Visits',       icon: DoorOpen,  module: 'check_ins',  phase: '' },
  { href: '/more/settings',   label: 'Settings',     icon: Settings,  module: 'settings',  phase: '' },
  /*
   * NOT gated on a module permission, unlike everything above it.
   *
   * This is the signed-in person's own two-factor setting, not gym
   * configuration — a front-desk staffer with no settings.view has exactly as
   * much right to protect their own account as an owner does. Gating it would
   * mean the roles most likely to be sharing a handset are the ones who
   * cannot secure it.
   */
  { href: '/more/security',   label: 'Security',     icon: ShieldCheck, module: null, phase: '' },
];

export default function More() {
  const { session, signOut } = useSession();
  const can = useCan();
  const user = session?.user;

  const initials = (user?.full_name ?? '?')
    .split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  async function onSignOut() {
    await signOut();
    router.replace('/(auth)/sign-in');
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
        {/* Who am I, and which gym am I in — the two things staff check first. */}
        <View className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-4">
          <Avatar alt={user?.full_name ?? 'Signed in user'}>
            <AvatarFallback><Text>{initials}</Text></AvatarFallback>
          </Avatar>
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="text-base font-medium text-foreground">
              {user?.full_name ?? 'Signed in'}
            </Text>
            <Text numberOfLines={1} className="text-sm text-muted-foreground">
              {session?.studio?.name ?? '—'}
            </Text>
          </View>
          <Badge variant="secondary">
            <Text>{(user?.role ?? '').replace(/_/g, ' ')}</Text>
          </Badge>
        </View>

        <BranchSwitcher />

        <View className="gap-2">
          {ENTRIES.filter((e) => e.module === null || can(e.module, e.action ?? 'view')).map((e) => (
            <MoreRow key={e.href} entry={e} />
          ))}
        </View>

        {/* Dev surface — not gated by role, it ships only in development. */}
        {__DEV__ ? (
          <Link href="/gallery" asChild>
            <Button variant="ghost"><Text>Design system (dev)</Text></Button>
          </Link>
        ) : null}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" testID="sign-out">
              <LogOut size={16} color={tokens.destructive} />
              <Text className="text-destructive">Sign out</Text>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out?</AlertDialogTitle>
              <AlertDialogDescription>
                {/* Front-desk phones are shared — say what actually happens. */}
                This device will forget your session and any cached gym data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel><Text>Cancel</Text></AlertDialogCancel>
              <AlertDialogAction onPress={onSignOut}><Text>Sign out</Text></AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ScrollView>
    </SafeAreaView>
  );
}

function MoreRow({ entry }: { entry: Entry }) {
  const state = useFeatureState(entry.feature ?? 'member_management');
  const locked = Boolean(entry.feature) && state === 'locked';
  const Icon = entry.icon;
  const built = entry.phase === '';

  const row = (
    <RowCard
      title={entry.label}
      subtitle={locked || built ? undefined : entry.phase}
      leading={<Icon size={20} color={locked ? tokens.mutedForeground : tokens.foreground} />}
      trailing={locked && entry.feature ? <PremiumTag feature={entry.feature} /> : undefined}
      // Locked entries stay visible and inert: the lock IS the upsell.
      onPress={locked || built ? undefined : () => {}}
      chevron={!locked}
    />
  );

  // Built destinations navigate; unbuilt ones render inert with their phase.
  return built && !locked ? <Link href={entry.href} asChild>{row}</Link> : row;
}
