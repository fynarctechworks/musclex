import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Empty, Loading, Txt } from '../../src/ui';
import { font, color, radius, space } from '../../src/ui/theme';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { Notice } from '../../src/ui/Notice';
import { timeOf } from '../../src/lib/datetime';
import { useChatMessages, useChatThreads, useSendChat } from '../../src/api/queries';

/** One conversation with a trainer. Polls while open; a person may reply at any time. */
export default function TrainerChatScreen() {
  const insets = useSafeAreaInsets();
  const { trainerId } = useLocalSearchParams<{ trainerId: string }>();
  const { data, isLoading } = useChatMessages(trainerId ?? null);
  const { data: threads } = useChatThreads();
  const send = useSendChat(trainerId ?? '');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<ScrollView>(null);

  const messages = data?.messages ?? [];
  const name =
    threads?.threads.find((t) => t.trainerId === trainerId)?.trainerName ?? 'Trainer';

  useEffect(() => {
    scroller.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  if (isLoading) return <Loading label="Loading conversation" />;

  async function submit() {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    setError(null);
    try {
      await send.mutateAsync(body);
    } catch (e) {
      setDraft(body); // give the text back rather than losing it
      setError(e instanceof Error ? e.message : 'Message not sent.');
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}
    >
      <ScreenHeader title={name} />
      <ScrollView
        ref={scroller}
        contentContainerStyle={{ padding: space.lg, paddingTop: 0, gap: space.sm }}
      >
        {error ? <Notice title="Not sent" body={error} onDismiss={() => setError(null)} /> : null}

        {messages.length === 0 ? (
          <Empty
            title={`Message ${name}`}
            body="Ask about your plan, your form, or anything you want changed."
          />
        ) : (
          messages.map((m) => {
            const mine = m.sender === 'member';
            return (
              <View
                key={m.id}
                style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '84%',
                  backgroundColor: mine ? color.accent : color.surface,
                  borderColor: mine ? color.accent : color.line,
                  borderWidth: 1,
                  borderRadius: radius.lg,
                  padding: space.md,
                }}
              >
                <Txt variant="body" style={{ color: mine ? color.accentInk : color.t1 }}>
                  {m.body}
                </Txt>
                <Txt
                  variant="caption"
                  style={{
                    marginTop: 4,
                    color: mine ? 'rgba(255,255,255,0.75)' : color.t4,
                  }}
                >
                  {timeOf(m.createdAt)}
                </Txt>
              </View>
            );
          })
        )}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          gap: space.sm,
          padding: space.lg,
          paddingBottom: insets.bottom + space.md,
          borderTopWidth: 1,
          borderTopColor: color.line,
          backgroundColor: color.surface,
        }}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={`Message ${name}`}
          placeholderTextColor={color.t4}
          accessibilityLabel="Message"
          onSubmitEditing={submit}
          style={{
            flex: 1,
            height: 46,
            borderRadius: radius.md,
            backgroundColor: color.surface2,
            borderWidth: 1,
            borderColor: color.line,
            color: color.t1,
            paddingHorizontal: space.lg,
            fontFamily: font,
            fontSize: 15,
          }}
        />
        <Button title="Send" size="sm" onPress={submit} disabled={!draft.trim()} loading={send.isPending} />
      </View>
    </KeyboardAvoidingView>
  );
}
