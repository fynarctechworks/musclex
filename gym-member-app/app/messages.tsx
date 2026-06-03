import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  MeshGradient,
  Screen,
  SkeletonCard,
  Txt,
} from '../src/design-system';
import { BackButton } from '../src/navigation/BackButton';
import { useChatThreads } from '../src/api/queries';
import { relativeFromNow } from '../src/lib/format';

/**
 * Trainer Chat — conversation list (V2.3). One thread per assigned trainer, with
 * the last message + unread badge. Polls in the background (useChatThreads).
 */
export default function MessagesScreen() {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useChatThreads();
  const threads = data?.threads ?? [];

  return (
    <Screen scroll padded={false} onRefresh={refetch} refreshing={isRefetching}>
      <View className="overflow-hidden px-md pb-lg pt-md">
        <MeshGradient opacity={0.4} />
        <BackButton />
        <Txt variant="mono" className="text-ink/70">
          YOUR COACHES
        </Txt>
        <Txt variant="display-lg" weight="600" className="mt-xs text-ink">
          Messages
        </Txt>
      </View>

      <View className="gap-sm px-md">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : isError && !data ? (
          <Card>
            <ErrorState compact onRetry={refetch} retrying={isRefetching} />
          </Card>
        ) : threads.length === 0 ? (
          <Card>
            <EmptyState
              icon="users"
              title="No trainer yet"
              message="When your gym assigns you a personal trainer, you'll be able to message them right here."
            />
          </Card>
        ) : (
          threads.map((t) => (
            <Card
              key={t.trainerId}
              onPress={() =>
                router.push({
                  pathname: `/chat/${t.trainerId}`,
                  params: { name: t.trainerName ?? 'Trainer' },
                })
              }
            >
              <View className="flex-row items-center gap-md">
                <Avatar name={t.trainerName} size={48} />
                <View className="flex-1">
                  <View className="flex-row items-center justify-between">
                    <Txt variant="body-lg" weight="600" className="text-ink">
                      {t.trainerName}
                    </Txt>
                    {t.lastMessageAt ? (
                      <Txt variant="caption" className="text-mute">
                        {relativeFromNow(t.lastMessageAt)}
                      </Txt>
                    ) : null}
                  </View>
                  <View className="mt-xxs flex-row items-center justify-between">
                    <Txt
                      variant="body-sm"
                      className="flex-1 pr-sm text-body"
                      numberOfLines={1}
                    >
                      {t.lastMessage ?? 'Start the conversation'}
                    </Txt>
                    {t.unreadCount ? (
                      <Badge label={String(t.unreadCount)} tone="error" />
                    ) : null}
                  </View>
                </View>
              </View>
            </Card>
          ))
        )}
        <View className="h-2xl" />
      </View>
    </Screen>
  );
}
