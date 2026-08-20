import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Card, Empty, Loading, Row, Txt } from '../src/ui';
import { color, radius, space } from '../src/ui/theme';
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
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <ScreenHeader title="Messages" />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: 120, gap: space.sm }}>
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
                <Row style={{ alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, paddingRight: space.md }}>
                    <Row style={{ justifyContent: 'flex-start', gap: space.sm }}>
                      <Txt variant="bodyStrong">{t.trainerName}</Txt>
                      {t.unreadCount > 0 ? (
                        <View
                          style={{
                            minWidth: 20,
                            height: 20,
                            paddingHorizontal: 6,
                            borderRadius: radius.pill,
                            backgroundColor: color.accent,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Txt variant="caption" style={{ color: color.accentInk, fontWeight: '700' }}>
                            {t.unreadCount}
                          </Txt>
                        </View>
                      ) : null}
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
                  <Icon name="chevron" size={16} tone="t4" />
                </Row>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}
