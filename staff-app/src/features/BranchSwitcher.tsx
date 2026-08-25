import React from 'react';
import { View } from 'react-native';
import { Building2, Check } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/ui/Sheet';
import { Loading } from '@/ui/Loading';
import { useBranches } from '@/api/queries';
import { useSession } from '@/auth/SessionProvider';
import { tokens } from '@/ui/tokens';

/**
 * Branch switcher.
 *
 * Sets `activeBranchId`, which the API client sends as `X-Active-Branch-Id`.
 * The client never filters by branch itself — the backend narrows the query —
 * so changing this clears the query cache (SessionProvider.setActiveBranch),
 * because every cached row belongs to the previous scope.
 *
 * "All branches" (null) is a real option, matching the web app's default.
 */
export function BranchSwitcher() {
  const { session, setActiveBranch } = useSession();
  const [open, setOpen] = React.useState(false);
  const { data: branches, isLoading } = useBranches();

  const activeId = session?.activeBranchId ?? null;
  const activeName =
    activeId ? (branches?.find((b) => b.id === activeId)?.name ?? 'Branch') : 'All branches';

  async function choose(id: string | null) {
    setOpen(false);
    await setActiveBranch(id);
  }

  return (
    <>
      <Button variant="outline" onPress={() => setOpen(true)} testID="branch-switcher">
        <Building2 size={16} color={tokens.foreground} />
        <Text>{activeName}</Text>
      </Button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Branch" snapPoints={['50%']}>
        {isLoading ? (
          <Loading />
        ) : (
          <View className="gap-1">
            <BranchRow label="All branches" selected={activeId === null} onPress={() => choose(null)} />
            {(branches ?? []).map((b) => (
              <BranchRow
                key={b.id}
                label={b.name}
                selected={activeId === b.id}
                onPress={() => choose(b.id)}
              />
            ))}
          </View>
        )}
      </Sheet>
    </>
  );
}

function BranchRow({
  label, selected, onPress,
}: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <View className="flex-row items-center justify-between rounded-md px-1 py-3">
      <Text
        accessibilityRole="button"
        onPress={onPress}
        className="flex-1 text-base text-foreground">
        {label}
      </Text>
      {selected ? <Check size={18} color={tokens.foreground} /> : null}
    </View>
  );
}
