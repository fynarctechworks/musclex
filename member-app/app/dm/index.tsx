import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Empty, Label, Loading, Row, Txt } from '../../src/ui';
import { Chip } from '../../src/ui/Chip';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { whenOf } from '../../src/lib/datetime';
import { useConversations, useSetMessagePrivacy } from '../../src/api/queries';

/**
 * DIRECT MESSAGES — member to member.
 *
 * Deliberately separate from /messages, which is the member talking to gym
 * STAFF and is gym-scoped. Conflating the two would put a stranger's message
 * in the same list as a trainer's.
 *
 * The privacy control sits at the top rather than buried in settings: the
 * moment somebody wants to shut their inbox is the moment they are looking at
 * it.
 */
const PRIVACY = [
  { key: 'everyone', label: 'Anyone' },
  { key: 'followers', label: 'People I follow' },
  { key: 'nobody', label: 'No one' },
] as const;

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading } = useConversations();
  const privacy = useSetMessagePrivacy();

  if (isLoading) return <Loading label="Loading messages" />;

  const conversations = data?.conversations ?? [];

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Messages" />
      <ScrollView
        contentContainerClassName="gap-3 px-4 pb-32"
      >
        <Card>
          <Label>Who can message you</Label>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {PRIVACY.map((p) => (
              <Chip
                key={p.key}
                label={p.label}
                active={privacy.variables === p.key}
                onPress={() => privacy.mutate(p.key)}
              />
            ))}
          </View>
          <Txt variant="caption" tone="t3" className="mt-3">
            New members start at "People I follow".
          </Txt>
        </Card>

        {conversations.length === 0 ? (
          <Empty
            title="No messages"
            body="Start one from someone's activity in your feed."
          />
        ) : (
          conversations.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/dm/${c.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Conversation with ${c.with.name ?? 'someone'}${
                c.unread ? `, ${c.unread} unread` : ''
              }`}
            >
              <Card>
                <Row className="items-start">
                  <View className="flex-1 pr-3">
                    <Txt variant="bodyStrong">{c.with.name || 'Someone'}</Txt>
                    {c.lastMessage ? (
                      <Txt variant="small" tone="t2" numberOfLines={1} className="mt-0.5">
                        {c.lastMessage.mine ? 'You: ' : ''}
                        {c.lastMessage.body}
                      </Txt>
                    ) : (
                      <Txt variant="small" tone="t3" className="mt-0.5">No messages yet.</Txt>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {c.lastMessage ? (
                      <Txt variant="caption" tone="t4">{whenOf(c.lastMessage.at)}</Txt>
                    ) : null}
                    {c.unread > 0 ? (
                      <View
                        className="bg-primary mt-1 h-5 min-w-5 items-center justify-center rounded-full px-1.5">
                        <Txt variant="caption" className="text-primary-foreground font-semibold">
                          {c.unread}
                        </Txt>
                      </View>
                    ) : null}
                  </View>
                </Row>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}
