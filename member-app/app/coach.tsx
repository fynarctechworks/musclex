import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Loading, Txt } from '../src/ui';
import { font, color, radius, space } from '../src/ui/theme';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { useAskCoach, useCoach } from '../src/api/queries';

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
      style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}
    >
      <ScreenHeader title="Coach" />
      <ScrollView
        ref={scroller}
        contentContainerStyle={{ padding: space.lg, paddingTop: 0, gap: space.md }}
      >
        {messages.length === 0 && !pending ? (
          <Card>
            <Txt variant="bodyStrong">Ask your coach anything</Txt>
            <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
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
              style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                maxWidth: '86%',
                backgroundColor: mine ? color.accent : color.surface,
                borderColor: mine ? color.accent : color.line,
                borderWidth: 1,
                borderRadius: radius.lg,
                padding: space.md,
              }}
            >
              <Txt variant="body" style={{ color: mine ? color.accentInk : color.t1 }}>{m.content}</Txt>
            </View>
          );
        })}

        {pending ? (
          <>
            <View
              style={{
                alignSelf: 'flex-end', maxWidth: '86%', backgroundColor: color.accent,
                borderRadius: radius.lg, padding: space.md, opacity: 0.7,
              }}
            >
              <Txt variant="body" style={{ color: color.accentInk }}>{pending}</Txt>
            </View>
            <Txt variant="caption" tone="t3" style={{ alignSelf: 'flex-start' }}>Coach is typing…</Txt>
          </>
        ) : null}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row', gap: space.sm, padding: space.lg,
          paddingBottom: insets.bottom + space.md,
          borderTopWidth: 1, borderTopColor: color.line,
        }}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask a question"
          placeholderTextColor={color.t4}
          accessibilityLabel="Message"
          onSubmitEditing={send}
          style={{
            flex: 1, height: 46, borderRadius: radius.md, backgroundColor: color.surface2,
            borderWidth: 1, borderColor: color.line, color: color.t1,
            paddingHorizontal: space.lg, fontFamily: font, fontSize: 15,
          }}
        />
        <Button title="Send" size="sm" onPress={send} disabled={!draft.trim()} loading={ask.isPending} />
      </View>
    </KeyboardAvoidingView>
  );
}
