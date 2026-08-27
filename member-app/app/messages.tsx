import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Card, Empty, Loading, Row, Txt, Badge } from '../src/ui';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { whenOf } from '../src/lib/datetime';
import { useChatThreads } from '../src/api/queries';

/**
 * TRAINER THREADS — real people, one thread per trainer the member is assigned
 * to. Distinct from /coach, which is the AI advisor; conflating the two would
 * make members expect a human answer from a model.
 */
export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading } = useChatThreads();

  if (isLoading) return <Loading label="Loading messages" />;
  const threads = data?.threads ?? [];

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Messages" />
      <ScrollView contentContainerClassName="gap-2 px-4 pb-32">
        {threads.length === 0 ? (
          <Empty
            title="No trainers yet"
            body="When your gym assigns you a trainer, your conversation appears here."
          />
        ) : (
          threads.map((t) => (
            <Pressable
              key={t.trainerId}
              onPress={() => router.push(`/chat/${t.trainerId}`)}
              accessibilityRole="button"
              accessibilityLabel={`Open chat with ${t.trainerName}`}
            >
              <Card>
                <Row className="items-start">
                  <View className="flex-1 pr-3">
                    <Row className="justify-start gap-2">
                      <Txt variant="bodyStrong">{t.trainerName}</Txt>
                      <Badge
                        count={t.unreadCount}
                        label={`${t.unreadCount} unread from ${t.trainerName}`}
                      />
                    </Row>
                    <Txt variant="small" tone="t2" numberOfLines={1} style={{ marginTop: 3 }}>
                      {t.lastMessage ?? 'Say hello to your trainer'}
                    </Txt>
                    {t.lastMessageAt ? (
                      <Txt variant="caption" tone="t4" style={{ marginTop: 3 }}>
                        {whenOf(t.lastMessageAt)}
                      </Txt>
                    ) : null}
                  </View>
                  <Icon name="chevron" size={16} tone="t4" decorative />
                </Row>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}
