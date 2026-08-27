import React from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { useSession } from '@/auth/SessionProvider';
import { tabsForUser } from '@/rbac/nav';
import { tokens } from '@/ui/tokens';

/**
 * A way back from a tab that is NOT in this role's tab bar.
 *
 * Eight screens are candidate tabs but only four fit; the rest are declared
 * with `href: null`, which keeps them addressable while hiding them from the
 * bar. More links to them by their tab route — deliberately, so a marketing
 * manager who HAS Marketing as a tab is not sent to a duplicate screen.
 *
 * The consequence was a trap. Tapping Schedule, Shop, Leads or Reports in More
 * SWITCHES TAB rather than pushing a screen, so there is no back button, and
 * the tab it switched to is not in the bar — leaving no visible way back at
 * all. `router.back()` does not help either: a tab switch is not a push, so
 * there is nothing on the stack to pop.
 *
 * This renders only when the current tab is genuinely absent from the bar, so
 * a role that HAS the tab never sees a redundant control. Which tabs those are
 * is per-role, so it cannot be a fixed list.
 *
 * Not a navigation header: every one of these screens draws its own large
 * title, and a header would print the name twice.
 */
export function TabBackRow({ tab }: { tab: string }) {
  const { session } = useSession();
  const inBar = tabsForUser(session?.user).some((t) => t.name === tab);
  if (inBar) return null;

  return (
    <View className="flex-row">
      <Pressable
        onPress={() => router.navigate('/(tabs)/more')}
        accessibilityRole="button"
        accessibilityLabel="Back to More"
        hitSlop={8}
        // 44pt tall, and only as wide as its content so it does not swallow
        // taps meant for the title beneath it.
        style={{ height: 44, flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: 12 }}
        testID={`tab-back-${tab}`}>
        <ChevronLeft size={20} color={tokens.mutedForeground} />
        <Text className="text-[15px] text-muted-foreground">More</Text>
      </Pressable>
    </View>
  );
}
