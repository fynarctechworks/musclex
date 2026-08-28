import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Empty, Loading, Txt } from '../../src/ui';
import { cn } from '@/lib/utils';
import { Field } from '../../src/ui/Field';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { Notice } from '../../src/ui/Notice';
import { timeOf } from '../../src/lib/datetime';
import { useChatMessages, useChatThreads, useSendChat } from '../../src/api/queries';
import { clearDraft, draftKey, readDraft, writeDraft } from '../../src/lib/drafts';

/** One conversation with a trainer. Polls while open; a person may reply at any time. */
export default function TrainerChatScreen() {
  const insets = useSafeAreaInsets();
  const { trainerId } = useLocalSearchParams<{ trainerId: string }>();
  const { data, isLoading } = useChatMessages(trainerId ?? null);
  const { data: threads } = useChatThreads();
  const send = useSendChat(trainerId ?? '');
  /*
    Seeded from the saved draft. This screen is pushed over a tab, and leaving
    it unmounts the composer — a half-typed message used to vanish silently.
  */
  const draftId = draftKey('chat', String(trainerId));
  const [draft, setDraftState] = useState(() => readDraft(draftId));

  // Single path for changing the text, so nothing can update the box without
  // persisting it.
  const setDraft = (text: string) => {
    setDraftState(text);
    writeDraft(draftId, text);
  };
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
      className="bg-background flex-1" style={{ paddingTop: insets.top }}
    >
      <ScreenHeader title={name} />
      <ScrollView
        ref={scroller}
        contentContainerClassName="gap-2 px-4"
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
              // FILLED, like the coach thread and unlike the member-to-member
              // DMs: a trainer exchange is read a message at a time, so the
              // stronger contrast is worth it here.
              <View
                key={m.id}
                className={cn(
                  'max-w-[84%] rounded-lg border p-3',
                  mine ? 'border-primary bg-primary self-end' : 'border-border bg-card self-start',
                )}>
                <Txt variant="body" className={mine ? 'text-primary-foreground' : undefined}>
                  {m.body}
                </Txt>
                <Txt
                  variant="caption"
                  tone={mine ? undefined : 't4'}
                  className={cn('mt-1', mine && 'text-primary-foreground/75')}>
                  {timeOf(m.createdAt)}
                </Txt>
              </View>
            );
          })
        )}
      </ScrollView>

      <View
        className="border-border bg-card flex-row gap-2 border-t p-4"
        style={{ paddingBottom: insets.bottom + 12 }}>
        <Field
          value={draft}
          onChangeText={setDraft}
          placeholder={`Message ${name}`}
          accessibilityLabel="Message"
          onSubmitEditing={submit}
          className="flex-1"
        />
        <Button title="Send" size="sm" onPress={submit} disabled={!draft.trim()} loading={send.isPending} />
      </View>
    </KeyboardAvoidingView>
  );
}
