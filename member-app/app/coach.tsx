import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Loading, Txt } from '../src/ui';
import { cn } from '@/lib/utils';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { useAskCoach, useCoach } from '../src/api/queries';

/** Placeholder ink — ink-4. RN takes a colour value, not a class. */
const PLACEHOLDER = '#a6a09b';

/** A chat bubble. Mine is the filled one, so its text takes the inverse ink. */
const BUBBLE = 'max-w-[86%] rounded-lg border p-3';

/**
 * COACH — the AI advisor thread. Member messages are echoed optimistically so
 * the conversation never appears to stall while the model thinks.
 */
export default function CoachScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useCoach();
  const ask = useAskCoach();
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const scroller = useRef<ScrollView>(null);

  const messages = data?.messages ?? [];

  useEffect(() => {
    scroller.current?.scrollToEnd({ animated: true });
  }, [messages.length, pending]);

  if (isLoading) return <Loading label="Loading coach" />;

  async function send() {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    setPending(text);
    try {
      await ask.mutateAsync(text);
    } finally {
      setPending(null);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="bg-background flex-1"
      style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Coach" />
      <ScrollView
        ref={scroller}
        contentContainerClassName="gap-3 px-4">
        {messages.length === 0 && !pending ? (
          <Card>
            <Txt variant="bodyStrong">Ask your coach anything</Txt>
            <Txt variant="small" tone="t2" className="mt-2">
              Training, form, recovery or what to eat. Answers use your own logged history, so
              they are about your training rather than generic advice.
            </Txt>
          </Card>
        ) : null}

        {messages.map((m, i) => {
          const mine = m.role === 'member';
          return (
            <View
              key={m.id ?? i}
              className={cn(
                BUBBLE,
                mine
                  ? 'border-primary bg-primary self-end'
                  : 'border-border bg-card self-start',
              )}>
              <Txt
                variant="body"
                className={mine ? 'text-primary-foreground' : undefined}>
                {m.content}
              </Txt>
            </View>
          );
        })}

        {pending ? (
          <>
            {/* The optimistic echo, dimmed until the real message lands so it
                reads as in-flight rather than sent. */}
            <View className={cn(BUBBLE, 'border-primary bg-primary self-end opacity-70')}>
              <Txt variant="body" className="text-primary-foreground">
                {pending}
              </Txt>
            </View>
            <Txt variant="caption" tone="t3" className="self-start">
              Coach is typing…
            </Txt>
          </>
        ) : null}
      </ScrollView>

      <View
        className="border-border flex-row gap-2 border-t p-4"
        style={{ paddingBottom: insets.bottom + 12 }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask a question"
          placeholderTextColor={PLACEHOLDER}
          accessibilityLabel="Message"
          onSubmitEditing={send}
          className="border-border bg-secondary text-foreground h-12 flex-1 rounded-md border px-4 text-base"
        />
        <Button title="Send" size="sm" onPress={send} disabled={!draft.trim()} loading={ask.isPending} />
      </View>
    </KeyboardAvoidingView>
  );
}
