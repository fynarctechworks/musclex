import React from 'react';
import { View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { tokens } from '@/ui/tokens';

/**
 * The "More" hub.
 *
 * Phase 3 replaces this with the role-adaptive module list derived from the
 * user's permission map. Until then it carries one entry: a route into the
 * design-system gallery, so the components are reachable by tapping — both for
 * a human and for the idb UI harness (scripts/verify-interactive.sh), which
 * navigates by accessibility label rather than pixel coordinates.
 *
 * SafeAreaView uses `style`, not className: uniwind only augments React Native
 * CORE components, and a dropped `flex-1` here renders a blank screen.
 */
export default function More() {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.background }}>
      <View className="flex-1 gap-4 p-6">
        <Text className="text-2xl font-semibold text-foreground">More</Text>
        <Text className="text-sm text-muted-foreground">
          Modules land here in Phase 3, filtered by the signed-in role.
        </Text>
        <Link href="/gallery" asChild>
          <Button variant="secondary">
            <Text>Design system</Text>
          </Button>
        </Link>
      </View>
    </SafeAreaView>
  );
}
