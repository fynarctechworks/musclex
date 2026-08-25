import React from 'react';
import { View } from 'react-native';
import { CloudOff, Inbox, TriangleAlert, type LucideIcon } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { tokens } from '@/ui/tokens';

/**
 * Empty / error / offline states.
 *
 * These are separate components rather than one with a `variant`, because they
 * carry different obligations: an EMPTY list should offer the action that fills
 * it, an ERROR must offer a retry, and OFFLINE must say whether what is shown
 * is stale. Collapsing them into one prop invites screens that render "No data"
 * when the request actually failed — which is how staff end up believing a gym
 * has no members.
 */
type BaseProps = { title: string; body?: string; action?: React.ReactNode };

function Shell({ icon: Icon, title, body, action, tint }: BaseProps & { icon: LucideIcon; tint: string }) {
  return (
    <View className="items-center justify-center gap-2 px-6 py-12">
      <Icon size={28} color={tint} />
      <Text className="pt-1 text-base font-medium text-foreground">{title}</Text>
      {body ? <Text className="text-center text-sm text-muted-foreground">{body}</Text> : null}
      {action ? <View className="pt-2">{action}</View> : null}
    </View>
  );
}

export function EmptyState(props: BaseProps) {
  return <Shell {...props} icon={Inbox} tint={tokens.mutedForeground} />;
}

export function ErrorState({
  title = 'Could not load',
  body = 'Something went wrong. Your data is safe.',
  onRetry,
}: Partial<BaseProps> & { onRetry?: () => void }) {
  return (
    <Shell
      icon={TriangleAlert}
      tint={tokens.destructive}
      title={title}
      body={body}
      action={
        onRetry ? (
          <Button variant="outline" onPress={onRetry}>
            <Text>Try again</Text>
          </Button>
        ) : undefined
      }
    />
  );
}

export function OfflineState({
  lastSynced,
  onRetry,
}: { lastSynced?: string; onRetry?: () => void }) {
  return (
    <Shell
      icon={CloudOff}
      tint={tokens.mutedForeground}
      title="You’re offline"
      // Naming the staleness is the point: staff must never act on a figure
      // believing it is live when it is hours old.
      body={lastSynced ? `Showing data from ${lastSynced}.` : 'Reconnect to see current data.'}
      action={
        onRetry ? (
          <Button variant="outline" onPress={onRetry}>
            <Text>Retry</Text>
          </Button>
        ) : undefined
      }
    />
  );
}
