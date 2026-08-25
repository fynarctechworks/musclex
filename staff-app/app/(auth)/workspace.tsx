import React from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { RowCard } from '@/ui/RowCard';
import { EmptyState } from '@/ui/States';
import { selectWorkspace } from '@/api/auth';
import { useSession } from '@/auth/SessionProvider';
import type { Workspace } from '@/auth/types';
import { tokens } from '@/ui/tokens';

/**
 * Step 3 — pick a studio when the account spans several.
 *
 * Uses switchWorkspace (not signIn) so the query cache is cleared as part of
 * the change: selecting a different gym must never leave the previous gym's
 * data in memory.
 */
export default function WorkspaceSelect() {
  const params = useLocalSearchParams<{ workspaces?: string }>();
  const { switchWorkspace } = useSession();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const workspaces: Workspace[] = React.useMemo(() => {
    try { return params.workspaces ? JSON.parse(params.workspaces) : []; }
    catch { return []; }
  }, [params.workspaces]);

  async function choose(w: Workspace) {
    setBusy(w.studio_id); setError(null);
    try {
      const session = await selectWorkspace(w.studio_id);
      await switchWorkspace(session);
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open that gym');
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.background }}>
      <View className="flex-1 gap-4 p-6">
        <View className="gap-1">
          <Text className="text-2xl font-semibold text-foreground">Choose a gym</Text>
          <Text className="text-sm text-muted-foreground">
            Your account has access to more than one.
          </Text>
        </View>

        {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

        {workspaces.length === 0 ? (
          <EmptyState
            title="No gyms available"
            body="This account is not linked to a gym yet. Ask an owner to invite you."
          />
        ) : (
          <View className="gap-2">
            {workspaces.map((w) => (
              <RowCard
                key={w.studio_id}
                title={w.studio_name}
                subtitle={w.roles.join(' · ')}
                meta={busy === w.studio_id ? 'Opening…' : undefined}
                onPress={() => { if (!busy) void choose(w); }}
              />
            ))}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
